import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {handleAI} from './ai.mjs';
const files=new Map([['/',['public/index.html','text/html; charset=utf-8']],['/style.css',['public/style.css','text/css; charset=utf-8']],['/app.js',['.build/app.js','text/javascript; charset=utf-8']],['/engine.js',['.build/engine.js','text/javascript; charset=utf-8']]]);
for(const name of ['overview','camp','east','south'])files.set('/art/'+name+'.webp',['../yiling-expert-lab/public/art/scenes/'+name+'.webp','image/webp']);
export function server(){return createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const send=(status,body)=>{if(!res.destroyed&&!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}};
 if(path==='/health'&&req.method==='GET'){send(200,{demo:'yiling-tactics-lab',version:1});return;}
 if(path.startsWith('/api/')){
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){send(403,{error:'请从本机试玩页面操作。'});return;}
  if(req.method!=='POST'||!['/api/plan','/api/ask'].includes(path)){send(404,{error:'接口不存在'});return;}
  try{let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>180000){send(413,{error:'军情记录过长，请导出后重开。'});return;}body+=chunk;}const controller=new AbortController();res.once('close',()=>{if(!res.writableEnded)controller.abort();});send(200,await handleAI(path.slice(5),JSON.parse(body),AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])));}
  catch(e){send(502,{error:e.name==='TimeoutError'?'整理回话超时，原话已保留，可以重试。':e.message==='fetch failed'?'本机模型服务暂不可达，请重试或用分工按钮继续。':e.message});}return;
 }
 if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
 const f=files.get(path);if(!f||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end('Not found');return;}
 try{const data=await readFile(new URL(f[0],import.meta.url));res.writeHead(200,{'Content-Type':f[1],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(404);res.end('Missing asset; run build.mjs.');}
 });}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))server().listen(8947,'127.0.0.1',()=>console.log('夷陵分工与军令试玩：http://127.0.0.1:8947/'));
