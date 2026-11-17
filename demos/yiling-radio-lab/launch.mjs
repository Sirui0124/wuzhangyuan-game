import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url));
const build=spawnSync(process.execPath,['build.mjs'],{cwd:here,stdio:'inherit',windowsHide:true});if(build.status)process.exit(build.status);
async function probe(){let r;try{r=await fetch('http://127.0.0.1:8950/health',{signal:AbortSignal.timeout(1500)});}catch(e){if(e.cause?.code==='ECONNREFUSED')return false;throw Error('无法检查8950端口，请稍后重试。');}let data;try{data=await r.json();}catch{throw Error('8950端口被其他程序占用，未结束该进程。');}if(data.demo!=='yiling-radio-lab'||data.version!==1)throw Error('8950端口不是本独立试玩，未结束其他进程。');return true;}
if(!await probe()){const child=spawn(process.execPath,['server.mjs'],{cwd:here,detached:true,stdio:'ignore',windowsHide:true});child.unref();let started=false;for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,100));if(await probe()){started=true;break;}}if(!started)throw Error('试玩启动未完成，请直接运行node server.mjs查看错误。');}
console.log('夷陵自然语言军令试玩：http://127.0.0.1:8950/');
if(!process.argv.includes('--no-open'))spawn('powershell.exe',['-NoProfile','-Command',"Start-Process 'http://127.0.0.1:8950/'"],{stdio:'ignore',windowsHide:true}).unref();
