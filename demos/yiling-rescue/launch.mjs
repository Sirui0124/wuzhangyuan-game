import {spawn,spawnSync} from 'node:child_process';
import {mkdirSync,openSync,closeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const folder=fileURLToPath(new URL('.',import.meta.url));
try{const r=await fetch('http://127.0.0.1:8828/api/health',{signal:AbortSignal.timeout(1500)});if(r.ok&&(await r.json()).demo==='yiling-rescue-v1'){console.log('试玩已运行：http://127.0.0.1:8828/');process.exit(0);}}catch{}
const build=spawnSync(process.execPath,[folder+'build.mjs'],{stdio:'inherit',windowsHide:true});if(build.status!==0)process.exit(build.status??1);
mkdirSync(folder+'.cache',{recursive:true});const log=openSync(folder+'.cache/server.log','a');
const child=spawn(process.execPath,[folder+'server.mjs'],{cwd:folder,detached:true,windowsHide:true,stdio:['ignore',log,log]});child.unref();closeSync(log);
for(let i=0;i<30;i++){await new Promise(ok=>setTimeout(ok,200));try{const r=await fetch('http://127.0.0.1:8828/api/health');if(r.ok){console.log('试玩已启动：http://127.0.0.1:8828/');process.exit(0);}}catch{}}
throw new Error('试玩未能启动，请查看 demos/yiling-rescue/.cache/server.log');
