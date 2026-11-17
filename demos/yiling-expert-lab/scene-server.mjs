import {createServer as httpServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// A separate frontend reuses the existing story service without restarting it.
export function createSceneServer({backend='http://127.0.0.1:8942'}={}){
 const files=new Map(Object.entries({
  '/':['public/scene-playtest.html','text/html; charset=utf-8'],
  '/app.js':['.build/app.js','text/javascript; charset=utf-8'],
  '/scene-view.js':['.build/scene-view.js','text/javascript; charset=utf-8'],
  '/story-engine.js':['.build/story-engine.js','text/javascript; charset=utf-8'],
  '/style.css':['public/style.css','text/css; charset=utf-8'],
  '/scene-view.css':['public/scene-view.css','text/css; charset=utf-8'],
  '/map-layout.json':['public/scene-map-layout.json','application/json'],
  '/scene-view-layout.json':['public/scene-view-layout.json','application/json'],
  '/dialogue-ink.css':['../../GameStarter/web-demo/public/dialogue-ink.css','text/css; charset=utf-8'],
  '/portrait-staging.css':['../../GameStarter/web-demo/public/portrait-staging.css','text/css; charset=utf-8'],
  '/ui/dialogue-ink-wash-v1.png':['../../GameStarter/web-demo/public/ui/dialogue-ink-wash-v1.png','image/png']
 }));
 for(const key of ['camp','river','east','south','imperial','overview'])for(const suffix of ['','-thumb'])files.set(`/art/scenes/${key}${suffix}.webp`,[`public/art/scenes/${key}${suffix}.webp`,'image/webp']);
 return httpServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(path==='/scene-health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({demo:'yiling-scene-playtest',backend}));return;}
  if(path==='/api/action'||path==='/api/health'){
   if((path==='/api/action'&&req.method!=='POST')||(path==='/api/health'&&req.method!=='GET')){res.writeHead(405);res.end();return;}
   try{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>65536){res.writeHead(413);res.end();return;}chunks.push(chunk);}
    const upstream=await fetch(new URL(path,backend),{method:req.method,headers:{'Content-Type':'application/json'},...(req.method==='POST'?{body:Buffer.concat(chunks)}:{}),signal:AbortSignal.timeout(120000)});
    res.writeHead(upstream.status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(Buffer.from(await upstream.arrayBuffer()));
   }catch{res.writeHead(502,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'剧情服务暂未连接，请用“启动场景试玩”重新打开；当前页面的记录仍保留。'}));}
   return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  const file=files.get(path);if(!file){res.writeHead(404);res.end('Not found');return;}
  try{const data=await readFile(new URL(file[0],import.meta.url));res.writeHead(200,{'Content-Type':file[1],'Cache-Control':'no-cache','Content-Length':data.length,'X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);}
  catch{res.writeHead(404);res.end('Missing scene asset. Run build.mjs and prepare-scene-assets.mjs.');}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))createSceneServer().listen(8945,'127.0.0.1',()=>console.log('夷陵场景试玩：http://127.0.0.1:8945/'));
