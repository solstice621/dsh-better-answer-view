import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { runLayoutBrowserTests } from './layout-browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, 'work'), {recursive:true});
const dataDir = await mkdtemp(path.join(root, 'work/browser-'));
const port = Number(process.env.TEST_PORT || 3101);
const origin = `http://127.0.0.1:${port}`;
let server, browser, page;
async function start() {
  server = spawn(process.execPath, ['scripts/demo-server.mjs'], {cwd:root, env:{...process.env, PORT:String(port), WEB_ANSWER_DATA_DIR:dataDir}, stdio:['ignore','pipe','pipe']});
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Demo server timed out.')), 10000);
    server.once('error', reject);
    server.once('exit', code => {clearTimeout(timer); reject(new Error(`Demo server exited: ${code}`));});
    server.stdout.on('data', chunk => {if(chunk.toString().includes('Web Answer demo:')) {clearTimeout(timer);resolve();}});
    server.stderr.on('data', chunk => process.stderr.write(chunk));
  });
}
async function stop() {
  if(server && server.exitCode === null) {const done=once(server,'exit');server.kill();await done;}
}
async function until(check, label) {
  const deadline=Date.now()+10000;
  while(!(await check())) {if(Date.now()>deadline)throw new Error(`Timed out: ${label}`);await new Promise(resolve=>setTimeout(resolve,50));}
}
try {
  await start();
  let executablePath=process.env.CHROME_PATH;
  if(!executablePath && process.platform==='darwin') {const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';try{await access(chrome);executablePath=chrome;}catch{}}
  browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  // Chrome 156 on macOS can lose native pointer routing in an opaque iframe
  // near y=930 with a 1000px emulated viewport (also in a static iframe repro).
  // A normal 900px desktop viewport keeps Playwright's real click/scroll path.
  page=await browser.newPage({viewport:{width:1360,height:900},colorScheme:'light'});
  page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);
  const frame=page.frameLocator('iframe');
  await frame.locator('#reward').waitFor();
  assert.equal(await frame.locator('#reward').inputValue(),'100');
  assert.equal(await frame.locator('[data-stage="2"] .days').innerText(),'30 天');
  const document=await page.evaluate(async()=>fetch('/demo/seed',{method:'POST'}).then(r=>r.json()));
  const query=new URLSearchParams({sessionId:document.sessionId,id:document.id});
  const snapshot=()=>fetch(`${origin}/api/web-answer?${query}`).then(r=>r.json());
  await frame.locator('#reward').fill('150');
  await frame.locator('#reward').dispatchEvent('change');
  await frame.locator('[data-stage="1"]').click();
  await until(async()=>{const v=await snapshot();return v.state.rewardXP===150 && v.state.selectedPhase===1;},'parameter persistence');
  await page.getByRole('button',{name:'展开高度',exact:true}).click();
  assert.equal(await frame.locator('#reward').inputValue(),'150');
  await stop();await start();await page.reload();
  await frame.locator('#reward').waitFor();
  assert.equal(await frame.locator('#reward').inputValue(),'150');
  assert.equal(await frame.locator('[data-stage="1"]').getAttribute('aria-pressed'),'true');
  console.log('PASS: slider calculations, selection, expand, persistence across server restart');

  await page.getByRole('button',{name:'将后期需求降低 30%'}).click();
  await until(async()=> (await page.locator('.wa-meta').textContent()).includes('版本 2'),'page revision update');
  await until(async()=> (await frame.locator('[data-stage="2"] .days').innerText())==='14 天','updated calculation');
  assert.equal(await frame.locator('#reward').inputValue(),'150');
  await page.getByLabel('页面版本').selectOption('1');
  await until(async()=> (await frame.locator('[data-stage="2"] .days').innerText())==='20 天','historical calculation');
  const previousState=(await snapshot()).state;
  await frame.locator('#reward').fill('190');await frame.locator('#reward').dispatchEvent('change');
  await frame.locator('#save-status').filter({hasText:'保存失败'}).waitFor();
  assert.deepEqual((await snapshot()).state,previousState);
  await page.getByLabel('页面版本').selectOption('latest');
  await until(async()=> (await frame.locator('#reward').inputValue())==='150','latest parameter recovery');
  await page.locator('.wa-status').filter({hasText:'页面已就绪 · 参数修改自动保存'}).waitFor();
  console.log('PASS: compatible update preserves state; historical version stays frozen');

  // Exercise accessible keyboard activation in the capped standalone preview;
  // native opaque-frame pointer routing is flaky in Chrome 156 near its edge.
  await frame.locator('#ask').focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('确认追问').waitFor();
  assert.equal(await page.locator('.demo-message').count(),0);
  assert.match(await page.locator('.wa-prompt').textContent(),/"rewardXP":150/);
  await page.getByRole('button',{name:'发送追问',exact:true}).click();
  await page.locator('.demo-message').waitFor();
  assert.match(await page.locator('.demo-message').textContent(),/"revision":2/);
  const boundary=await frame.locator('body').evaluate(()=>{
    let parentBlocked=false,storageBlocked=false;
    try{void parent.document.body;}catch{parentBlocked=true;}
    try{localStorage.setItem('wa-test','x');}catch{storageBlocked=true;}
    return {parentBlocked,storageBlocked};
  });
  assert.deepEqual(boundary,{parentBlocked:true,storageBlocked:true});
  await page.emulateMedia({colorScheme:'dark'});
  await until(async()=> await frame.locator('html').getAttribute('data-theme')==='dark','dark theme');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await frame.locator('html').evaluate(e=>e.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(root,'work/browser-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: explicit follow-up, opaque frame isolation, dark theme and mobile layout');

  await page.route('**/api/web-answer?*',async route=>{
    const response=await route.fetch();
    const data=await response.json();
    if(data.html)data.html='<h1>故障测试</h1><script>throw new Error("deliberate-test-error")</script>';
    await route.fulfill({response,json:data});
  });
  await page.getByRole('button',{name:'刷新',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'deliberate-test-error'}).waitFor();
  assert.equal(await page.locator('.wa-details').getAttribute('open'),'');
  assert.match(await page.locator('.wa-details').innerText(),/6,300/);
  assert.equal(await page.getByRole('button',{name:'查看上一版'}).count(),1);
  console.log('PASS: script failure displays readable fallback and previous-version control');

  await page.unroute('**/api/web-answer?*');
  const readOnlyFixture=await build({bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',stdin:{resolveDir:root,loader:'jsx',contents:`
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {AnswerView,createApi} from './src/view-ui.jsx';
    const base=createApi();
    window.readOnlySaveAttempts=0;
    const api={...base,save:(...args)=>{window.readOnlySaveAttempts++;return base.save(...args);}};
    const receipt=await fetch('/demo/seed',{method:'POST'}).then(response=>response.json());
    createRoot(document.getElementById('root')).render(<AnswerView receipt={receipt} sessionId={receipt.sessionId} api={api} readOnly sendMessage={async text=>{window.lastSent=text;}}/>);
  `}});
  await page.route('**/dist/demo.js',route=>route.fulfill({contentType:'text/javascript',body:readOnlyFixture.outputFiles[0].text}));
  await page.reload();
  await page.getByRole('note').filter({hasText:'此页面来自另一会话'}).waitFor();
  await frame.locator('#reward').waitFor();
  const beforeReadOnly=(await snapshot()).state;
  const readOnlyFailure=await frame.locator('body').evaluate(async()=>{
    try {await window.answer.setState({rewardXP:190,selectedPhase:0});return 'saved';}
    catch(error){return error.message;}
  });
  assert.match(readOnlyFailure,/仅供查看/);
  assert.equal(await page.evaluate(()=>window.readOnlySaveAttempts),0);
  assert.deepEqual((await snapshot()).state,beforeReadOnly);
  await frame.locator('body').evaluate(()=>window.answer.ask('继续分析这个方案'));
  await page.getByLabel('确认追问').waitFor();
  assert.match(await page.locator('.wa-prompt').textContent(),/render_answer 创建当前会话的新页面/);
  assert.doesNotMatch(await page.locator('.wa-prompt').textContent(),/请先调用 get_answer/);
  console.log('PASS: inherited view blocks writes before API calls and prepares a new-page follow-up');

  const embeddedFixture=await build({bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',stdin:{resolveDir:root,loader:'jsx',contents:`
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {AnswerView,createApi} from './src/view-ui.jsx';
    const base=createApi();
    const html='<div id="embedded-block" style="height:1100px"><h2>内嵌图表内容</h2><button id="embedded-ask">继续分析</button><button id="embedded-save">保存参数</button></div><script>document.getElementById("embedded-ask").onclick=()=>window.answer.ask("查看下一种情形");document.getElementById("embedded-save").onclick=()=>window.answer.setState({rewardXP:100,selectedPhase:0}).catch(()=>{});</script>';
    const api={...base,
      get:async(...args)=>({...await base.get(...args),html:window.embeddedRuntimeError?'<h2>故障内容</h2><script>throw new Error("embedded-test-error")</script>':html}),
      save:async(...args)=>{if(window.embeddedSaveConflict)throw Object.assign(new Error('Changed elsewhere'),{code:'CONFLICT'});return base.save(...args);}
    };
    const receipt=await fetch('/demo/seed',{method:'POST'}).then(response=>response.json());
    createRoot(document.getElementById('root')).render(<AnswerView receipt={receipt} sessionId={receipt.sessionId} api={api} embedded sendMessage={async text=>{window.lastSent=text;}}/>);
  `}});
  await page.unroute('**/dist/demo.js');
  await page.route('**/dist/demo.js',route=>route.fulfill({contentType:'text/javascript',body:embeddedFixture.outputFiles[0].text}));
  await page.setViewportSize({width:1360,height:900});
  await page.reload();
  await frame.locator('#embedded-block').waitFor();
  await until(async()=> (await page.locator('iframe').evaluate(element=>element.getBoundingClientRect().height))>=1100,'embedded auto height');
  await until(async()=> (await page.locator('.wa-options .wa-status').textContent())?.includes('页面已就绪'),'embedded readiness');
  assert.equal(await page.locator('.wa-head').count(),0);
  assert.equal(await page.locator('.wa-view').evaluate(element=>getComputedStyle(element).borderTopWidth),'0px');
  assert.equal(await page.getByLabel('页面版本').isVisible(),false);
  assert.equal(await page.getByRole('button',{name:'刷新',exact:true}).isVisible(),false);
  assert.equal(await page.locator('.wa-details').isVisible(),false);
  assert.equal(await page.locator('.wa-status').isVisible(),false);
  assert.equal((await page.locator('.wa-view').innerText()).trim(),'图表选项');
  await page.getByText('图表选项',{exact:true}).click();
  assert.equal(await page.getByLabel('页面版本').isVisible(),true);
  await page.getByText('文字说明',{exact:true}).click();
  assert.match(await page.locator('.wa-details').innerText(),/6,300/);
  await page.getByText('图表选项',{exact:true}).click();
  await frame.locator('#embedded-ask').click();
  await page.getByLabel('确认追问').waitFor();
  assert.equal(await page.evaluate(()=>Boolean(window.lastSent)),false);
  await page.getByRole('button',{name:'取消',exact:true}).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('确认追问').waitFor({state:'detached'});
  assert.equal(await page.getByLabel('确认追问').count(),0);
  await page.evaluate(()=>{window.embeddedSaveConflict=true;});
  await frame.locator('#embedded-save').click();
  await page.getByRole('alert').filter({hasText:'Changed elsewhere'}).waitFor();
  assert.equal(await page.locator('.wa-options').getAttribute('open'),null);
  console.log('PASS: embedded content has natural height and hides chrome and duplicate text; follow-ups and save failures remain visible');

  await page.evaluate(()=>{window.embeddedRuntimeError=true;});
  await page.getByText('图表选项',{exact:true}).click();
  await page.getByRole('button',{name:'刷新',exact:true}).click();
  await page.getByText('图表选项',{exact:true}).click();
  await page.getByRole('alert').filter({hasText:'embedded-test-error'}).waitFor();
  assert.equal(await page.locator('.wa-details').isVisible(),true);
  assert.equal(await page.locator('.wa-details').getAttribute('open'),'');
  assert.match(await page.locator('.wa-details').innerText(),/6,300/);
  assert.equal(await page.getByRole('button',{name:'重新加载',exact:true}).isVisible(),true);
  console.log('PASS: embedded runtime errors expose fallback text and recovery outside collapsed options');
  await runLayoutBrowserTests({page,root,origin});
} catch(error) {
  if(page) {console.error(await page.locator('body').innerText());for(const frame of page.frames().slice(1))console.error('FRAME:',await frame.locator('body').innerText().catch(()=>''));}
  throw error;
} finally {
  await browser?.close();await stop();await rm(dataDir,{recursive:true,force:true});
}
