import {resolve,dirname,relative} from 'node:path';
import {mkdirSync,existsSync,readFileSync,writeFileSync,copyFileSync,cpSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {stagePayload} from '../../GameStarter/packaging/windows/stage-payload.mjs';
const root=resolve(import.meta.dirname,'../..');
const option=name=>process.argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3);
const label=option('label')||new Date().toISOString().replace(/\D/g,'').slice(0,14);
if(!/^[\w-]+$/.test(label))throw Error('Invalid label');
const build=resolve(root,option('build')||`.cache/mac-web-${label}/web-build`);
const output=resolve(root,`outputs/mac-web-${label}`);
if(existsSync(output))throw Error('Output exists; use a new label');
function run(file,args){const r=spawnSync(file,args,{cwd:root,stdio:'inherit',windowsHide:true});if(r.error)throw r.error;if(r.status!==0)throw Error(`Command failed: ${file} (${r.status})`);}
if(!option('build'))run(process.execPath,['GameStarter/web-demo/build.mjs',build]);
const stage=resolve(root,`.cache/mac-web-${label}/stage`);
stagePayload(build,stage);
const folder=resolve(output,'Wuzhangyuan-Mac-Web');mkdirSync(folder,{recursive:true});
cpSync(resolve(stage,'game'),resolve(folder,'game'),{recursive:true});
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]);}
// The Mac browser uses one stable local origin; the launcher forwards API calls.
for(const file of walk(resolve(folder,'game/web'))){if(/\.(js|html|json)$/.test(file)){const text=readFileSync(file,'utf8');const changed=text.replaceAll('http://127.0.0.1:8787','http://127.0.0.1:18812');if(changed!==text)writeFileSync(file,changed);}}
copyFileSync(resolve(root,'tools/release/mac-launch.mjs'),resolve(folder,'launch.mjs'));
copyFileSync(resolve(root,'tools/release/mac-start.command'),resolve(folder,'启动游戏.command'));
const pins={arm64:'ff6e17d4874b76d272212b908cc020d6e815fba5a6c7eaaa06add725840307fd',x64:'977614af0504c81045e7fd85596dbca0e5f951b96681516dadafedcca8c447f7'};
mkdirSync(resolve(folder,'runtime'),{recursive:true});
for(const [arch,expected] of Object.entries(pins)){
 const name=`node-v24.22.3-darwin-${arch}.tar.gz`,cached=resolve(root,'.cache/release-node',name);mkdirSync(dirname(cached),{recursive:true});
 if(!existsSync(cached)){console.log('Downloading official Node runtime:',name);const r=await fetch(`https://nodejs.org/dist/v24.22.3/${name}`);if(!r.ok)throw Error(`Download failed: ${r.status}`);writeFileSync(cached,Buffer.from(await r.arrayBuffer()));}
 if(createHash('sha256').update(readFileSync(cached)).digest('hex')!==expected)throw Error(`Node checksum mismatch: ${name}`);
 copyFileSync(cached,resolve(folder,'runtime',name));
}
writeFileSync(resolve(folder,'使用说明.txt'),'逆转五丈原 · Mac 本地网页版\n\n解压后，在终端输入 bash 加一个空格，将「启动游戏.command」拖入终端并回车。\n首次启动自动使用包内对应芯片的Node运行时，无需安装Node或npm。支持Apple Silicon及Intel Mac。\n浏览器地址固定为 http://127.0.0.1:18812/ 。请使用同一浏览器及地址保留进度。\n游戏期间保留启动终端；按Ctrl+C退出服务。\nAI密钥在游戏设置中自行配置，安装包不包含作者密钥。\n后端存档与设置保存在 ~/Library/Application Support/WuzhangyuanWeb；普通章节进度存于浏览器。\n升级时替换游戏文件夹，保留上述用户目录和浏览器数据。\n当前构建在Windows检查资源及浏览器流程，尚未进行Mac实机、Safari或Gatekeeper验证。\n');
const files=walk(folder).map(p=>({path:relative(folder,p).replaceAll('\\','/'),bytes:readFileSync(p).length,sha256:createHash('sha256').update(readFileSync(p)).digest('hex')}));
writeFileSync(resolve(folder,'manifest.json'),JSON.stringify({label,node:'24.22.3',files,validation:{macDeviceTested:false}},null,2));
const archive=resolve(output,`Wuzhangyuan-${label}-mac-web.tar.gz`);
run('tar',['-czf',archive,'-C',output,'Wuzhangyuan-Mac-Web']);
writeFileSync(resolve(output,'release-artifacts.json'),JSON.stringify({label,folder,artifacts:[{path:archive,bytes:readFileSync(archive).length,sha256:createHash('sha256').update(readFileSync(archive)).digest('hex')}],validation:{payloadVerified:true,macDeviceTested:false}},null,2));
console.log('Mac web package:',archive);
