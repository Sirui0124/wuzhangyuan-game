import {aiStatus,handleAI} from './ai.mjs';
import {turnAI} from './turn-ai.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const files=new Map(Object.entries({'/':['public/index.html','text/html; charset=utf-8'],'/app.js':['.build/app.js','text/javascript'],'/engine.js':['.build/engine.js','text/javascript'],'/orders.js':['.build/orders.js','text/javascript'],'/story.js':['.build/story.js','text/javascript'],'/style.css':['public/style.css','text/css'],'/layout.json':['../yiling-expert-lab/public/scene-map-layout.json','application/json']}));
for(const k of ['overview','camp','east','river','south'])files.set(`/art/${k}.webp`,[`../yiling-expert-lab/public/art/scenes/${k}.webp`,'image/webp']);
files.set('/legacy',['public/index.html','text/html; charset=utf-8']);
files.set('/',['public/turn.html','text/html; charset=utf-8']);
files.set('/turn.css',['public/turn.css','text/css']);
for(const k of ['turn-app','turn-engine','turn-story','turn-intro'])files.set(`/${k}.js`,[`.build/${k}.js`,'text/javascript']);
for(const id of ['fu','feng','sha'])files.set(`/art/intro/${id}.png`,[`public/art/intro/${id}.png`,'image/png']);
export function server(){return createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({demo:'yiling-command-lab',version:3}));return;}
 if(path.startsWith('/api/')){
  const send=(code,data)=>{if(!res.destroyed&&!res.writableEnded){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}};
  try{const origin=req.headers.origin;if(origin&&new URL(origin).origin!==`http://${req.headers.host}`){send(403,{error:'请从本机试玩页面操作。'});return;}
   if(path==='/api/ai-status'&&req.method==='GET'){send(200,await aiStatus());return;}
   if(req.method!=='POST'||!['/api/plan','/api/ask','/api/report','/api/turn-plan','/api/turn-ask'].includes(path)){send(404,{error:'接口不存在'});return;}
   let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>180000){send(413,{error:'本次军令过长。'});return;}body+=chunk;}
   const controller=new AbortController();res.once('close',()=>{if(!res.writableEnded)controller.abort();});
   const result=await (path.startsWith('/api/turn-')?turnAI(path.slice(10),JSON.parse(body),AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])):handleAI(path.slice(5),JSON.parse(body),AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])));send(200,result);
  }catch(e){send(502,{error:e.name==='TimeoutError'?'AI暂未回应，原话已保留，可以重试。':e.message.includes('HTTP')?'模型服务暂时不可用，原话已保留。':e.message});}return;
 }
 if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
 const f=files.get(path);if(!f||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end('Not found');return;}
 try{const data=await readFile(new URL(f[0],import.meta.url));res.writeHead(200,{'Content-Type':f[1],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(404);res.end('Missing asset; run build.mjs.');}
 });}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))server().listen(8946,'127.0.0.1',()=>console.log('夷陵三路试玩：http://127.0.0.1:8946/'));
