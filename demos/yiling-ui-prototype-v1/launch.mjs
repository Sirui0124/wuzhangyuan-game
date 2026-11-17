import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../../',import.meta.url));
const service=spawnSync(process.execPath,['tools/local-game/launch.mjs','--no-open'],{cwd,stdio:'inherit',windowsHide:true});if(service.status)process.exit(service.status);
console.log('前线军令：http://127.0.0.1:8812/?chapter=yiling&playtest=command');
if(!process.argv.includes('--no-open'))spawn('powershell.exe',['-NoProfile','-Command',"Start-Process 'http://127.0.0.1:8812/?chapter=yiling&playtest=command'"],{stdio:'ignore',windowsHide:true}).unref();
