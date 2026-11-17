import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRuntime} from './fu-runtime.mjs';
import {campaignHandler} from './campaign-runtime.mjs';
const runtime=createRuntime();
const campaign=campaignHandler();
const files={
 '/':['public/index.html','text/html; charset=utf-8'],
 '/style.css':['public/style.css','text/css; charset=utf-8'],
 '/app.js':['.build/campaign-app.js','text/javascript; charset=utf-8'],
 '/campaign-client.js':['.build/campaign-client.js','text/javascript; charset=utf-8'],
 '/campaign-intent.js':['.build/campaign-intent.js','text/javascript; charset=utf-8'],
 '/terrain.png':['../yiling-radio-lab-v6/public/terrain-night-v1.png','image/png'],
 '/ui-heavy.css':['public/ui-heavy.css','text/css; charset=utf-8'],
 '/art/material-atlas-v1.png':['public/art/material-atlas-v1.png','image/png'],
 '/art/ledger-frame.svg':['public/art/ledger-frame.svg','image/svg+xml'],
 '/dispatch-intent.js':['.build/dispatch-intent.js','text/javascript; charset=utf-8'],
 '/fu-client.js':['.build/fu-client.js','text/javascript; charset=utf-8'],
 '/fu-view.js':['.build/fu-view.js','text/javascript; charset=utf-8']
};
function json(res,status,body){if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
http.createServer(async(req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 if(p.startsWith('/api/campaign/'))return campaign(req,res);
 if(p==='/health')return json(res,200,{demo:'yiling-ui-prototype-v1',fuRuntime:'2026-11-17-v3-live'});
 if(p.startsWith('/api/fu/')){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'请用POST提交操作。'});
  if(req.headers.origin&&!['http://127.0.0.1:8956','http://localhost:8956'].includes(req.headers.origin))return json(res,403,{ok:false,error:'请求来源不符。'});
  if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{ok:false,error:'需要JSON请求。'});
  const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]);
  try{
   let body='';for await(const part of req){body+=part.toString('utf8');if(Buffer.byteLength(body)>16000)throw Object.assign(new Error('请求过长。'),{status:413});}
   let input;try{input=JSON.parse(body);}catch{throw Object.assign(new Error('JSON格式错误。'),{status:400});}
   if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(new Error('请求格式错误。'),{status:400});
   const kind=p.slice('/api/fu/'.length);
   const session=kind==='session'?await runtime.session(input.scenarioId):await runtime.act(kind,input,signal);
   return json(res,200,{ok:true,session});
  }catch(e){
   const status=e.name==='TimeoutError'||signal.aborted?504:e.status||502;
   return json(res,status,{ok:false,error:signal.aborted?'等待回复超时，原话已保留。请重试。':e.message,...(e.session?{session:e.session}:{})});
  }
 }
 const f=files[p];if(!f){res.writeHead(404);return res.end('Not found');}
 try{const data=await readFile(new URL(f[0],import.meta.url));res.writeHead(200,{'Content-Type':f[1],'Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(500);res.end('Build the prototype first.');}
}).listen(8956,'127.0.0.1',()=>console.log('第四章傅肜试玩 http://127.0.0.1:8956/'));
