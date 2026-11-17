import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdirSync,openSync,closeSync} from 'node:fs';
const here=fileURLToPath(new URL('.',import.meta.url));
async function alive(){try{const r=await fetch('http://127.0.0.1:8937/api/health',{signal:AbortSignal.timeout(1000)});return r.ok&&(await r.json()).demo==='yiling-field-v1';}catch{return false;}}
if(!await alive()){
 const r=spawnSync(process.execPath,[here+'build.mjs'],{stdio:'inherit',windowsHide:true});if(r.status!==0)process.exit(r.status??1);
 mkdirSync(here+'.cache',{recursive:true});const log=openSync(here+'.cache/server.log','a');const child=spawn(process.execPath,[here+'server.mjs'],{cwd:here,detached:true,windowsHide:true,stdio:['ignore',log,log]});child.unref();closeSync(log);
 for(let i=0;i<40&&!await alive();i++)await new Promise(r=>setTimeout(r,150));
 if(!await alive())throw new Error('未能启动试玩，请查看本目录 .cache/server.log。');
}
console.log('试玩已就绪：http://127.0.0.1:8937/');
