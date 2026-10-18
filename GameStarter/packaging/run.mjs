import { createStaticServer } from './static.mjs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
const resources=dirname(fileURLToPath(import.meta.url));
const profile=process.env.GAME_PROFILE_DIR || resolve(homedir(),'Library/Application Support/逆转五丈原');
mkdirSync(profile,{recursive:true,mode:0o700});
const envFile=resolve(profile,'.env');
if (!existsSync(envFile) && existsSync(resolve(resources,'api-defaults.json'))) {
 const defaults=JSON.parse(readFileSync(resolve(resources,'api-defaults.json'),'utf8'));
 writeFileSync(envFile,`DEEPSEEK_API_KEY=${JSON.stringify(defaults.apiKey)}\nDEEPSEEK_MODEL=${JSON.stringify(defaults.model)}\nDEEPSEEK_BASE_URL=${JSON.stringify(defaults.baseUrl)}\n`,{mode:0o600});
}
if(existsSync(envFile)) process.loadEnvFile(envFile);
const port=Number(process.env.GAME_PORT || 18911), origin=`http://127.0.0.1:${port}`;
const identity='wuzhang-standalone-v1';
let backend, backendPort=0, stopping=false;
async function startBackend(){
 backend=spawn(process.execPath,[resolve(resources,'backend.mjs')],{env:{...process.env,PORT:'0',GAME_SETTINGS_FILE:envFile},stdio:['ignore','ignore','ignore','ipc']});
 await new Promise((resolveReady,reject)=>{
  const timer=setTimeout(()=>reject(new Error('AI 服务启动超时')),10000);
  backend.once('message',message=>{backendPort=message.port;clearTimeout(timer);resolveReady();});
  backend.once('exit',()=>{backendPort=0;clearTimeout(timer);reject(new Error('AI 服务未能启动'));});
 });
}
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
const server=createStaticServer({root:resolve(resources,'web'),async onRequest(req,res){
 const pathname=new URL(req.url,origin).pathname;
 if(pathname==='/__game/health'){json(res,200,{app:identity,aiReady:!!backendPort});return true;}
 if(pathname==='/api/game/respond'||pathname==='/api/game/settings'){
  if(req.headers.origin && req.headers.origin!==origin){json(res,403,{error:'来源不允许'});return true;}
  const allowed=pathname.endsWith('/settings')?['GET','POST']:['POST'];
  if(!allowed.includes(req.method)){json(res,405,{error:'请求方法不支持'});return true;}
  if(!backendPort){json(res,503,{error:'AI 服务未启动，请重新打开游戏'});return true;}
  const upstream=http.request({hostname:'127.0.0.1',port:backendPort,path:pathname,method:req.method,headers:{'Content-Type':'application/json',...(req.headers['content-length']?{'Content-Length':req.headers['content-length']}:{})}},reply=>{res.writeHead(reply.statusCode,{'Content-Type':'application/json','Cache-Control':'no-store'});reply.pipe(res);});
  upstream.on('error',()=>json(res,502,{error:'AI 服务连接中断，请重试'}));
  res.on('close',()=>upstream.destroy());req.pipe(upstream);return true;
 }
 return false;
}});
function stop(){if(stopping)return;stopping=true;backend?.kill();server.close();setTimeout(()=>process.exit(0),300).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
try{
 await startBackend();
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok);});
 console.log(`WUZHANG_READY ${origin}/`);
 if(!process.argv.includes('--no-open'))spawn('/usr/bin/open',[`${origin}/`],{stdio:'ignore'});
}catch(error){
 backend?.kill();
 if(error.code==='EADDRINUSE'){
  try{const existing=await fetch(origin+'/__game/health').then(r=>r.json());if(existing.app===identity){console.log(`WUZHANG_READY ${origin}/`);process.exit(0);}}catch{}
 }
 console.log('WUZHANG_ERROR 游戏启动失败，请检查游戏是否完整，或关闭占用 18911 端口的程序。');process.exit(1);
}
