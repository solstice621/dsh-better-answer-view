import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

/** Exercise the real AnswerView and opaque iframe together, with native wheel input. */
export async function runLayoutBrowserTests({ page, root, origin }) {
  const fixture = await build({bundle:true,write:false,platform:'browser',format:'esm',target:'es2022',stdin:{resolveDir:root,loader:'jsx',contents:`
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {AnswerView} from './src/view-ui.jsx';
    window.layoutSaved={amount:7};
    const view={id:'layout-regression',revision:1,latestRevision:1,title:'自然高度回归',summary:'Natural layout',html:window.layoutHtml,state:window.layoutSaved,stateSchemaVersion:1,stateVersion:1};
    const api={get:async()=>({...view,state:window.layoutSaved}),list:async()=>[{revision:1}],save:async(session,id,payload)=>{window.layoutSaved=payload.state;return {...view,state:payload.state,stateVersion:2};}};
    createRoot(document.getElementById('root')).render(<main style={{width:'100%',maxWidth:760,margin:'0 auto'}}><div id="before-answer" style={{height:90}}>前置说明</div><AnswerView receipt={view} sessionId="layout-test" api={api} embedded sendMessage={async()=>{}}/><div id="after-answer" style={{height:1400}}>后续说明</div></main>);
  `}});
  async function until(check, label) {
    const deadline=Date.now()+10000;
    while(!(await check())) {if(Date.now()>deadline)throw new Error(`Timed out: ${label}`);await new Promise(resolve=>setTimeout(resolve,40));}
  }
  async function show(html, width=1100) {
    await page.unroute('**/dist/demo.js');
    await page.route('**/dist/demo.js',route=>route.fulfill({contentType:'text/javascript',body:`window.layoutHtml=${JSON.stringify(html)};\n${fixture.outputFiles[0].text}`}));
    await page.setViewportSize({width,height:900});
    await page.goto(origin);
    await page.locator('.wa-options .wa-status').filter({hasText:'页面已就绪'}).waitFor({state:'attached'});
    assert.equal(await page.getByRole('button',{name:'展开高度',exact:true}).count(),0,'inline content has no height-expansion control');
    return page.frames().find(frame=>frame!==page.mainFrame());
  }
  async function metrics(frame) {
    return frame.evaluate(()=>({height:innerHeight,bodyBottom:document.body.getBoundingClientRect().bottom,scrollY,scrollX,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:getComputedStyle(document.documentElement).overflowY}));
  }
  async function wheelToOuter(frame) {
    await page.evaluate(()=>scrollTo(0,0));
    const bounds=await page.locator('iframe').boundingBox();
    await page.mouse.move(bounds.x+Math.min(bounds.width/2,160),Math.max(20,Math.min(bounds.y+110,500)));
    const before=await page.evaluate(()=>scrollY);
    await page.mouse.wheel(0,420);
    await until(async()=> (await page.evaluate(()=>scrollY))>before+100,'native wheel over iframe scrolls outer answer');
    assert.equal(await frame.evaluate(()=>scrollY),0,'iframe document must not move');
  }
  const tall=`<style>body{padding:24px}#shell{height:100vh;overflow:auto}#spacer{height:2800px;background:linear-gradient(#f3f7fa,#e8efef)}</style><section id="shell"><div><button id="grow">增加内容</button><button id="shrink">收起内容</button><input id="amount" type="number" value="7"></div><div id="spacer"></div><p id="tail">这行必须完整可见</p></section><script>
    const amount=document.getElementById('amount');amount.value=window.answer.getState().amount;amount.onchange=()=>window.answer.setState({amount:Number(amount.value)});
    document.getElementById('grow').onclick=()=>setTimeout(()=>{document.getElementById('spacer').style.height='4200px';},80);
    document.getElementById('shrink').onclick=()=>setTimeout(()=>{document.getElementById('spacer').style.height='80px';},80);
  </script>`;
  let frame=await show(tall);
  await until(async()=> (await metrics(frame)).height>2800,'tall content exceeds old 2400px maximum');
  let box=await metrics(frame);
  assert.ok(Math.abs(box.height-box.bodyBottom)<=1,JSON.stringify(box));
  assert.ok(await frame.locator('#tail').evaluate(node=>node.getBoundingClientRect().bottom<=innerHeight));
  await wheelToOuter(frame);
  await page.evaluate(()=>scrollTo(0,0));
  await frame.locator('#amount').fill('23');await frame.locator('#amount').dispatchEvent('change');
  await until(async()=> (await page.evaluate(()=>window.layoutSaved.amount))===23,'state before resizing');
  await frame.locator('#grow').click();
  await until(async()=> (await metrics(frame)).height>4200,'asynchronous growth');
  await frame.locator('#shrink').click();
  await until(async()=> (await metrics(frame)).height<500,'asynchronous shrink');
  assert.equal(await frame.locator('#amount').inputValue(),'23');
  assert.equal(await page.evaluate(()=>window.layoutSaved.amount),23);
  box=await metrics(frame);assert.ok(Math.abs(box.height-box.bodyBottom)<=1,JSON.stringify(box));
  console.log('PASS: embedded height grows beyond 2400px and shrinks with body padding; state persists; native wheel scrolls chat');

  frame=await show(`<style>body{padding:19px;min-height:100vh}.app{height:100vh;overflow:hidden}.page{min-height:calc(100vh - 20px)}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.chart{position:relative;height:100px}.bar{position:absolute;left:10px;bottom:5px;width:60%;height:24px;background:#468a71}</style><main class="app"><section class="page"><h2>稳定尺寸</h2><div class="chart"><span class="bar">绝对定位图形</span></div><table class="sr"><tbody>${'<tr><td>屏幕阅读器替代数据</td></tr>'.repeat(100)}</tbody></table><p id="tail">正文结束</p></section></main>`);
  await until(async()=> (await metrics(frame)).height<700,'viewport shell expands to intrinsic content');
  // ResizeObserver may settle a second layout after removing a viewport shell.
  await page.waitForTimeout(160);
  const stableHeight=(await metrics(frame)).height;
  await page.waitForTimeout(700);
  assert.equal((await metrics(frame)).height,stableHeight,'100vh must not feed back into iframe growth');
  assert.equal(await frame.locator('.sr').evaluate(node=>getComputedStyle(node).clip),'rect(0px, 0px, 0px, 0px)');
  assert.equal(await frame.locator('.bar').evaluate(node=>getComputedStyle(node).position),'absolute');
  await wheelToOuter(frame);
  console.log('PASS: viewport shell stabilizes; clipped accessible table stays hidden; absolute chart positioning remains intact');

  frame=await show(`<style>.accordion{height:0;overflow:hidden}.accordion.open{height:auto}.accordion .content{height:820px}.suppressed{content-visibility:hidden;height:20px}</style><button id="toggle" aria-expanded="false">展开或收起</button><section id="panel" class="accordion"><div class="content">按需展开的内容</div></section><details id="details"><summary>可选说明</summary><div style="height:1000px">原生折叠区域</div></details><div class="suppressed"><div style="height:1500px">不应影响测量</div></div><svg viewBox="0 0 100 100" width="60" height="60" aria-label="裁剪图形"><rect width="100" height="1200" fill="#428a70"/></svg><p>后续文字</p><script>document.getElementById('toggle').onclick=event=>{const open=document.getElementById('panel').classList.toggle('open');event.currentTarget.setAttribute('aria-expanded',String(open));};</script>`);
  await until(async()=> (await metrics(frame)).height<450,'closed disclosures occupy only visible content');
  await page.waitForTimeout(160);
  const closedHeight=(await metrics(frame)).height;
  assert.equal(await frame.locator('#panel').evaluate(node=>node.clientHeight),0);
  await frame.locator('#toggle').click();
  await until(async()=> (await metrics(frame)).height>closedHeight+750,'accordion opens naturally');
  await frame.locator('#toggle').click();
  await until(async()=> Math.abs((await metrics(frame)).height-closedHeight)<=1,'accordion closes and frame shrinks');
  assert.equal(await frame.locator('#panel').evaluate(node=>node.clientHeight),0);
  await frame.locator('#details summary').click();
  await until(async()=> (await metrics(frame)).height>closedHeight+950,'native details opens naturally');
  await frame.locator('#details summary').click();
  await until(async()=> Math.abs((await metrics(frame)).height-closedHeight)<=1,'native details closes and frame shrinks');
  console.log('PASS: CSS accordion and native details open and re-collapse without forced heights; hidden content and clipped SVG marks add no gaps');

  frame=await show(`<style>.columns{display:grid;grid-template-columns:400px 400px;gap:20px}.pane{height:100px;overflow:auto}.wide{width:1200px}.table-wrap{overflow:auto}table{min-width:900px}textarea{height:70px;max-height:70px}</style><div class="columns"><section class="pane"><h3>展开的解释</h3>${'<p>内容应完整展开并由聊天统一滚动。</p>'.repeat(12)}</section><section class="wide"><h3>宽表格</h3><div class="table-wrap"><table><tr><th>比较项</th><th>方案</th><th>说明</th></tr><tr><td>长名称必须换行</td><td>ABCDEFGHIJKLMN_OPQRSTUVWXYZ</td><td>没有横向滚动条</td></tr></table></div><label>仍可编辑的多行输入<textarea id="notes">${'文本输入允许保留自己的滚动交互\n'.repeat(12)}</textarea></label></section></div>`,390);
  await until(async()=> await frame.locator('.pane').evaluate(node=>node.scrollHeight<=node.clientHeight+1),'explanatory panel expands');
  box=await metrics(frame);
  assert.ok(box.scrollWidth<=box.width,JSON.stringify(box));
  const overflows=await frame.evaluate(()=>Array.from(document.querySelectorAll('#answer-content *')).filter(node=>node.namespaceURI==='http://www.w3.org/1999/xhtml'&&!node.matches('textarea,script,style')).filter(node=>node.clientWidth&&node.scrollWidth>node.clientWidth+1).map(node=>`${node.tagName}.${node.className}`));
  assert.deepEqual(overflows,[],'responsive layout must wrap, never silently hide a wide table/panel');
  assert.ok(await frame.locator('#notes').evaluate(node=>node.scrollHeight>node.clientHeight),'textarea remains a control');
  await frame.locator('#notes').fill('输入框仍可编辑');
  assert.equal(await frame.locator('#notes').inputValue(),'输入框仍可编辑');
  await page.screenshot({path:`${root}/work/browser-layout-narrow.png`,fullPage:true});
  console.log('PASS: narrow fixed grid and wide table reflow without clipping; explanatory panes expand; textarea interaction is preserved');

  if(process.env.LAYOUT_REGRESSION_HTML) {
    const saved=await readFile(process.env.LAYOUT_REGRESSION_HTML,'utf8');
    for(const width of [1100,390,263]) {
      frame=await show(saved,width);
      await frame.locator('.bar').first().waitFor();
      await until(async()=> (await metrics(frame)).height>200,'saved chart geometry');
      assert.equal(await frame.locator('.sr').evaluate(node=>getComputedStyle(node).clip),'rect(0px, 0px, 0px, 0px)');
      assert.equal(await frame.locator('.bar').first().evaluate(node=>getComputedStyle(node).position),'absolute');
      assert.ok(await frame.locator('.note').evaluate(node=>node.getBoundingClientRect().bottom<=innerHeight));
      const chartGeometry=await frame.evaluate(()=>({
        widths:Array.from(document.querySelectorAll('.tracks')).map(node=>node.getBoundingClientRect().width),
        labels:Array.from(document.querySelectorAll('.value')).map(node=>{const rect=node.getBoundingClientRect();const track=node.parentElement.getBoundingClientRect();return {text:node.textContent,left:rect.left-track.left,right:rect.right-track.right};}),
        metrics:Array.from(document.querySelectorAll('.metric strong')).map(node=>{const range=document.createRange();range.selectNodeContents(node);return {text:node.textContent,lines:range.getClientRects().length,textWidth:range.getBoundingClientRect().width,boxWidth:node.getBoundingClientRect().width};}),
      }));
      assert.ok(Math.max(...chartGeometry.widths)-Math.min(...chartGeometry.widths)<1,`all years must use the same horizontal data scale: ${JSON.stringify(chartGeometry)}`);
      assert.ok(chartGeometry.labels.every(label=>label.left>=-1&&label.right<=1),`numeric labels must remain fully visible: ${JSON.stringify(chartGeometry.labels)}`);
      assert.ok(chartGeometry.metrics.every(metric=>metric.lines===1&&metric.textWidth<=metric.boxWidth+1),`numeric metric tokens must stay intact: ${JSON.stringify(chartGeometry.metrics)}`);
      await wheelToOuter(frame);
      await page.evaluate(()=>scrollTo(0,0));
      await page.waitForTimeout(250);
      await page.screenshot({path:`${root}/work/browser-layout-saved-${width}.png`});
      if(width===263){
        const tightLabel=frame.locator('.value').nth(6);
        assert.equal(await tightLabel.evaluate(node=>getComputedStyle(node).color),'rgb(255, 255, 255)','the crowded value is readable inside its blue bar');
        const inside=await tightLabel.evaluate(node=>{const label=node.getBoundingClientRect();const bar=node.parentElement.querySelector('.bar').getBoundingClientRect();return label.left>=bar.left&&label.right<=bar.right;});
        assert.equal(inside,true,'move the entire crowded value into the bar, not halfway across its edge');
        await page.evaluate(()=>scrollTo(0,420));await page.waitForTimeout(250);await page.screenshot({path:`${root}/work/browser-layout-saved-${width}-chart.png`});
        await page.setViewportSize({width:1100,height:900});
        await page.evaluate(()=>scrollTo(0,0));
        await until(async()=> await tightLabel.evaluate(node=>getComputedStyle(node).translate)==='0px','label anchor restores after widening');
        assert.equal(await tightLabel.evaluate(node=>getComputedStyle(node).color),'rgb(36, 62, 88)','restore the authored label color outside the bar');
      }
    }
    console.log('PASS: actual saved chart at desktop and narrow widths keeps all visible content and passes native outer-wheel scrolling');
  }
}
