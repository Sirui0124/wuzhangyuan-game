import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
const root=resolve(import.meta.dirname,'../../..');
const label=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date()).replace(/[^0-9]/g,'');
const build=`.cache/windows-release-${label}/web-build`;
function run(file,args){const result=spawnSync(process.execPath,[file,...args],{cwd:root,stdio:'inherit',windowsHide:true});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
if(!existsSync(resolve(root,'GameStarter/packaging/windows/node_modules/electron/dist/electron.exe')))throw new Error('请先安装Windows打包依赖：npm ci --prefix GameStarter/packaging/windows');
run('tools/architecture/check.mjs',[]);
run('GameStarter/web-demo/build.mjs',[build]);
run('GameStarter/packaging/windows/build-release.mjs',['--build',build,'--stage',`.cache/windows-release-${label}/stage`,'--output',`outputs/windows-release-${label}`,'--label',label,...(process.argv.includes('--dir')?['--dir']:[])]);
