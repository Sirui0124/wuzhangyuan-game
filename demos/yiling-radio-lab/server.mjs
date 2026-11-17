import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {handle} from './ai.mjs';
import {modelConfig} from '../yiling-rescue/ai.mjs';
const files=new Map([['/atelier-v2.css',['public/atelier-v2.css','text/css; charset=utf-8']],['/map-ink-v1.png',['public/map-ink-v1.png','image/png']],['/presentation.js',['.build/presentation.js','text/javascript; charset=utf-8']],['/paper.svg',['../../GameStarter/web-demo/public/ui/panel-grain.svg','image/svg+xml']],['/cloth.png',['../../GameStarter/web-demo/public/ui/folio-cover-neutral-v1.png','image/png']],['/',['public/index.html','text/html; charset=utf-8']],['/style.css',['public/style.css','text/css; charset=utf-8']],['/app.js',['.build/app.js','text/javascript; charset=utf-8']],['/engine.js',['.build/engine.js','text/javascript; charset=utf-8']],['/core.js',['.build/core.js','text/javascript; charset=utf-8']]]);
for(const n of ['overview','east','camp','south'])files.set('/art/'+n+'.webp',['../yiling-expert-lab/public/art/scenes/'+n+'.webp','image/webp']);
export function server(){return createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;const send=(status,body)=>{if(!res.destroyed&&!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}};
 if(path==='/health'){send(200,{demo:'yiling-radio-lab',version:1});return;}
 if(path==='/api/status'&&req.method==='GET'){try{const c=await modelConfig();send(200,{configured:!!c.apiKey});}catch{send(200,{configured:false});}return;}
 if(path.startsWith('/api/')){if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){send(403,{error:'请从本机试玩页面发令。'});return;}if(path!=='/api/message'||req.method!=='POST'){send(404,{error:'接口不存在'});return;}
 try{let body='',size=0;for await(const c of req){size+=c.length;if(size>220000){send(413,{error:'本局记录过长，请导出后重开。'});return;}body+=c;}const abort=new AbortController();res.once('close',()=>{if(!res.writableEnded)abort.abort();});send(200,await handle(JSON.parse(body),AbortSignal.any([abort.signal,AbortSignal.timeout(45000)])));}catch(e){send(502,{error:e.name==='TimeoutError'?'军侯暂未回话，原话已保留，可以重试。':e.message==='fetch failed'?'模型服务暂时不可达，原话已保留，可以重试。':e.message});}return;}
 if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}const f=files.get(path);if(!f||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end('Not found');return;}try{const data=await readFile(new URL(f[0],import.meta.url));res.writeHead(200,{'Content-Type':f[1],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(404);res.end('Run build.mjs first.');}
 });}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))server().listen(8950,'127.0.0.1',()=>console.log('夷陵自然语言军令试玩：http://127.0.0.1:8950/'));
