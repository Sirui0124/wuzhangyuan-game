import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const label=new Date().toISOString().replace(/\D/g,'').slice(0,14);
function run(file,args){const r=spawnSync(process.execPath,[file,...args],{cwd:root,stdio:'inherit',windowsHide:true});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);}
const build=`.cache/delivery-${label}/web-build`;
run('tools/architecture/check.mjs',[]);
run('node_modules/typescript/bin/tsc',['-p','GameStarter/web-demo/tsconfig.json','--noEmit']);
run('GameStarter/web-demo/build.mjs',[build]);
run('GameStarter/packaging/windows/build-release.mjs',['--build',build,'--stage',`.cache/delivery-${label}/stage`,'--output',`outputs/windows-release-${label}`,'--label',label]);
run('tools/release/build-mac-web.mjs',[`--label=${label}`,`--build=${build}`]);
console.log(`两个版本构建完成。请执行发布验证，再使用 publish-github.mjs 上传。标签：${label}`);
