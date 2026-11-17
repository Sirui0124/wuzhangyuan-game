import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url));
const build=spawnSync(process.execPath,['build.mjs'],{cwd:here,stdio:'inherit',windowsHide:true});if(build.status)process.exit(build.status);
try{const r=await fetch('http://127.0.0.1:8946/health',{signal:AbortSignal.timeout(1500)});const d=await r.json();if(d.demo!=='yiling-command-lab')throw Error('端口8946被其他程序占用');}
catch(e){if(String(e).includes('占用'))throw e;const child=spawn(process.execPath,['server.mjs'],{cwd:here,detached:true,stdio:'ignore',windowsHide:true});child.unref();for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,100));try{const r=await fetch('http://127.0.0.1:8946/health');if((await r.json()).demo==='yiling-command-lab')break;}catch{}}}
console.log('夷陵三路试玩：http://127.0.0.1:8946/');
if(!process.argv.includes('--no-open'))spawn('powershell.exe',['-NoProfile','-Command',"Start-Process 'http://127.0.0.1:8946/'"],{stdio:'ignore',windowsHide:true}).unref();
