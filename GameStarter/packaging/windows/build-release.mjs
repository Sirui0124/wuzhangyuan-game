import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const project=dirname(fileURLToPath(import.meta.url));
const workspace=resolve(project,'../../..');
const require=createRequire(import.meta.url);
const argumentsMap=new Map();
for(let i=2;i<process.argv.length;i++){
  const key=process.argv[i];
  if(key==='--skip-stage'||key==='--dir')argumentsMap.set(key,true);
  else if(key.startsWith('--')&&process.argv[i+1]&&!process.argv[i+1].startsWith('--'))argumentsMap.set(key,process.argv[++i]);
  else throw new Error(`Unknown or incomplete argument: ${key}`);
}
const allowed=new Set(['--build','--stage','--output','--version','--label','--skip-stage','--dir','--prepackaged']);
for(const key of argumentsMap.keys())if(!allowed.has(key))throw new Error(`Unknown argument: ${key}`);
const label=argumentsMap.get('--label')||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace(/[^\d]/g,'');
if(!/^[A-Za-z0-9_-]+$/.test(label))throw new Error('Release label must contain only letters, digits, hyphens or underscores');
const buildRoot=argumentsMap.get('--build')?resolve(workspace,argumentsMap.get('--build')):null;
const stage=resolve(workspace,argumentsMap.get('--stage')||`.cache/windows-release-${label}`);
const output=resolve(workspace,argumentsMap.get('--output')||`outputs/windows-release-${label}`);
const directoryOnly=argumentsMap.has('--dir');
const prepackaged=argumentsMap.has('--prepackaged')?resolve(workspace,argumentsMap.get('--prepackaged')):null;
if(directoryOnly&&prepackaged)throw new Error('--dir and --prepackaged cannot be combined');
const insideWorkspace=path=>{const child=relative(workspace,path);return child&&!isAbsolute(child)&&child!=='..'&&!child.startsWith('..'+sep);};
if(!insideWorkspace(stage)||!insideWorkspace(output))throw new Error('Release stage and output must remain inside the intended workspace');
if(prepackaged&&prepackaged!==resolve(output,'win-unpacked'))throw new Error('Prepackaged application must be this release output/win-unpacked');
const pkg=JSON.parse(readFileSync(resolve(project,'package.json'),'utf8'));
const version=argumentsMap.get('--version')||pkg.version;
if(!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version))throw new Error('Release version must be a semantic version');
const installerName=`Wuzhangyuan-${version}-${label}-win-x64-setup.exe`;
if(existsSync(resolve(output,installerName)))throw new Error('This release installer already exists; use a new label/output to preserve it');
mkdirSync(output,{recursive:true});
if(!argumentsMap.get('--skip-stage')){
  if(!buildRoot)throw new Error('Pass --build with the new, validated web build root');
  const result=spawnSync(process.execPath,[resolve(project,'stage-payload.mjs'),buildRoot,stage],{cwd:workspace,stdio:'inherit',windowsHide:true});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Runtime staging failed (${result.status})`);
}
for(const file of [resolve(stage,'game/web/index.html'),resolve(stage,'game/GameStarter/server/server.mjs'),resolve(project,'main.cjs')])if(!existsSync(file))throw new Error(`Missing required packaging input: ${file}`);
process.env.ELECTRON_CACHE=resolve(workspace,'.cache/windows-tooling/electron');
process.env.ELECTRON_BUILDER_CACHE=resolve(workspace,'.cache/windows-tooling/electron-builder');
process.env.CSC_IDENTITY_AUTO_DISCOVERY='false';
for(const name of ['CSC_LINK','CSC_KEY_PASSWORD','WIN_CSC_LINK','WIN_CSC_KEY_PASSWORD'])delete process.env[name];
const configuration=require('./electron-builder.config.cjs')({stage,output,version,label});
writeFileSync(resolve(output,'packaging-config.json'),JSON.stringify({...configuration,afterPack:'verify-payload.cjs (all manifest files, size, SHA256 and bundled ws resolution)'},null,2)+'\n');
const {build,Platform,Arch}=await import('electron-builder');
if(prepackaged)await require('./verify-payload.cjs')({stage,applicationRoot:prepackaged,report:resolve(output,'pre-installer-payload-check.json')});
const artifacts=await build({projectDir:project,targets:Platform.WINDOWS.createTarget([directoryOnly?'dir':'nsis'],Arch.x64),config:configuration,publish:'never',...(prepackaged?{prepackaged}:{})});
for(const name of ['payload-manifest.json','payload-files.txt','payload-verification.json']){
  const source=resolve(stage,name);if(existsSync(source))copyFileSync(source,resolve(output,name));
}
const releases=artifacts.filter(file=>existsSync(file)).map(file=>{const data=readFileSync(file);return{path:file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};});
const record={createdAt:new Date().toISOString(),timeZone:'Asia/Shanghai',label,version,electron:pkg.devDependencies.electron,electronBuilder:pkg.devDependencies['electron-builder'],architecture:'x64',installer:'NSIS current-user',signed:false,compression:configuration.compression,stage,webBuildRoot:buildRoot,output,artifacts:releases,validation:{payloadManifestVerified:true,installerGenerated:!directoryOnly,installed:false,startedAfterInstall:false,uninstalled:false}};
writeFileSync(resolve(output,'release-artifacts.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record,null,2));
