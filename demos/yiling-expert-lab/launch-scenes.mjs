import {spawn,spawnSync} from 'node:child_process';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

async function health(url,expected){
 try{const r=await fetch(url,{signal:AbortSignal.timeout(2000)});if(!r.ok||(await r.json()).demo!==expected)throw Error('该端口已被其他服务使用：'+url);return true;}
 catch(e){if(e instanceof TypeError||e.name==='TimeoutError')return false;throw e;}
}
async function ensure(file,url,expected){
 if(await health(url,expected))return;
 const child=spawn(process.execPath,[fileURLToPath(new URL(file,import.meta.url))],{detached:true,stdio:'ignore',windowsHide:true});child.unref();
 for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,200));if(await health(url,expected))return;}
 throw Error('服务未能启动：'+url);
}
try{
 await access(new URL('public/art/scenes/camp.webp',import.meta.url));
 const built=spawnSync(process.execPath,[fileURLToPath(new URL('build.mjs',import.meta.url))],{stdio:'inherit',windowsHide:true});
 if(built.status!==0)throw Error('场景界面构建失败，请查看上方信息。');
 await ensure('story-server.mjs','http://127.0.0.1:8942/api/health','yiling-expert-lab');
 await ensure('scene-server.mjs','http://127.0.0.1:8945/scene-health','yiling-scene-playtest');
 if(!process.argv.includes('--no-open'))spawn('cmd.exe',['/c','start','','http://127.0.0.1:8945/'],{windowsHide:true,stdio:'ignore'}).unref();
 console.log('场景试玩已就绪：http://127.0.0.1:8945/');
}catch(e){console.error(e.message);process.exitCode=1;}
