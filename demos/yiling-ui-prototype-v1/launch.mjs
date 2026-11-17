import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('.',import.meta.url));
const built=spawnSync(process.execPath,['build.mjs'],{cwd,stdio:'inherit',windowsHide:true});if(built.status)process.exit(built.status);
async function ready(){try{const r=await fetch('http://127.0.0.1:8956/health',{signal:AbortSignal.timeout(1000)});if((await r.json()).demo!=='yiling-ui-prototype-v1')throw Error('8956端口已被其他程序占用');return true;}catch(e){if(e.cause?.code==='ECONNREFUSED')return false;throw e;}}
if(!await ready()){const child=spawn(process.execPath,['server.mjs'],{cwd,detached:true,stdio:'ignore',windowsHide:true});child.unref();for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,100));if(await ready())break;}}
console.log('交互稿：http://127.0.0.1:8956/');
if(!process.argv.includes('--no-open'))spawn('powershell.exe',['-NoProfile','-Command',"Start-Process 'http://127.0.0.1:8956/'"],{stdio:'ignore',windowsHide:true}).unref();
