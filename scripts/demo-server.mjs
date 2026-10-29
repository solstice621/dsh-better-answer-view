import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ViewStore } from '../src/view-store.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = path.resolve(process.env.WEB_ANSWER_DATA_DIR || path.join(root, 'work/demo-data'));
const store = new ViewStore(dataDir);
const sessionId = 'demo-web-answer';
const port = Number(process.env.PORT || 3091);
const allowed = new Map([['/', 'examples/demo.html'], ['/dist/demo.js', 'dist/demo.js']]);
let demoId;
async function seed() {
  if (!demoId) {try {demoId = (await readFile(path.join(dataDir,'demo-id'),'utf8')).trim();} catch(error) {if(error.code !== 'ENOENT') throw error;}}
  if (demoId) return store.get(sessionId, demoId);
  const view = await store.create(sessionId, { title:'升级节奏分析', html:await readFile(path.join(root,'examples/leveling.html'),'utf8'), summary:'虚构演示：每天完成 3 次任务，前、中、后期分别需要 900、3,600、9,000 XP。修改奖励可立即观察耗时变化，参数会保存。', initialState:{rewardXP:100,selectedPhase:2} });
  await mkdir(dataDir,{recursive:true});
  demoId = view.id;
  await writeFile(path.join(dataDir,'demo-id'), demoId);
  return view;
}
let mutation = Promise.resolve();
function receipt(view) {return {kind:'web-answer',id:view.id,revision:view.revision,title:view.title,summary:view.summary,sessionId};}
function statusFor(error) {return error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : error.code === 'INVALID_INPUT' ? 400 : 500;}
createServer(async (req,res) => {
  const origin = `http://127.0.0.1:${port}`;
  function json(value,status=200) {res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
  try {
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) return json({error:{message:'Invalid host'}},403);
    if (req.method === 'POST' && req.headers.origin && ![origin,`http://localhost:${port}`].includes(req.headers.origin)) return json({error:{message:'Invalid origin'}},403);
    const url = new URL(req.url,origin);
    if (req.method === 'GET' && allowed.has(url.pathname)) {
      const file = allowed.get(url.pathname);
      res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});
      return res.end(await readFile(path.join(root,file)));
    }
    if (req.method === 'POST' && ['/demo/seed','/demo/update'].includes(url.pathname)) {
      const work = mutation.catch(()=>{}).then(async()=>{
        const current=await seed();
        if(url.pathname==='/demo/seed')return current;
        const html=(await readFile(path.join(root,'examples/leveling.html'),'utf8')).replace('const thresholds = [900, 3600, 9000];','const thresholds = [900, 3600, 6300];');
        return store.update(sessionId,current.id,{expectedRevision:current.revision,html,summary:'调整后演示：后期需求由 9,000 降为 6,300 XP，前中期不变，保留用户当前参数。'});
      });mutation=work;
      return json(receipt(await work));
    }
    if(url.pathname==='/api/web-answer') {
      if(req.method==='GET') {
        const sid=url.searchParams.get('sessionId'), id=url.searchParams.get('id');
        return json(url.searchParams.get('action')==='list'?await store.list(sid,id):await store.get(sid,id,url.searchParams.has('revision')?Number(url.searchParams.get('revision')):undefined));
      }
      if(req.method==='POST') {
        if(!req.headers['content-type']?.startsWith('application/json'))return json({error:{message:'Expected JSON'}},415);
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>32768)return json({error:{message:'Request too large'}},413);}
        let data;try{data=JSON.parse(body);}catch{return json({error:{message:'Invalid JSON'}},400);}
        if(data.action!=='state')return json({error:{message:'Unknown action'}},400);
        return json(await store.saveState(data.sessionId,data.id,{revision:data.revision,expectedStateVersion:data.expectedStateVersion,state:data.state}));
      }
    }
    json({error:{message:'Not found'}},404);
  } catch(error) {json({error:{code:error.code||'INTERNAL',message:error.message}},statusFor(error));}
}).listen(port,'127.0.0.1',()=>console.log(`Web Answer demo: http://127.0.0.1:${port}`));
