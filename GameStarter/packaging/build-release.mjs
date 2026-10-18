import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, statSync, renameSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
if (process.platform !== 'darwin') throw new Error('package:mac requires macOS; use npm run build on Windows.');
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.argv[2] || resolve(project, '../releases/macos'));
const app = resolve(output, '逆转五丈原.app');
const resources = resolve(app, 'Contents/Resources');
const site = resolve(resources, 'web');
execFileSync(process.execPath,[resolve(project,'scripts/validate-story.mjs'),resolve(project,'../content/chapters/wuzhang/chapter.json')],{cwd:project,stdio:'inherit'});
mkdirSync(output, { recursive: true });
rmSync(app, {recursive:true,force:true});
mkdirSync(resolve(app, 'Contents/MacOS'), {recursive:true});
execFileSync(process.execPath, [resolve(project,'web-demo/build.mjs'), site], {cwd:project,stdio:'inherit'});
const visualManifest=JSON.parse(readFileSync(resolve(site,'media/manifest.json')));
if(visualManifest.missing.length) throw new Error('发布资源缺失：'+visualManifest.missing.join(','));
// Scene and character aliases can reuse identical artwork in the release.
const artworkByHash=new Map();
for(const group of ['characters','scenes','cinematics','ui'])for(const [id,url] of Object.entries(visualManifest[group])){
 const file=resolve(site,'.'+url), hash=createHash('sha256').update(readFileSync(file)).digest('hex');
 const prior=artworkByHash.get(hash);
 if(prior&&prior!==url){visualManifest[group][id]=prior;rmSync(file);}else artworkByHash.set(hash,url);
}
writeFileSync(resolve(site,'media/manifest.json'),JSON.stringify(visualManifest,null,2));
function walk(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]); }
// Source-only notes, map files, stale tests and preview experiments are never shipped.
for(const file of walk(site)) if (/\.(?:md|map|ts)$/.test(file) || /(?:visual-filters|visual-filter-preview|wuzhang-blame-v01)/.test(file)) rmSync(file);
rmSync(resolve(site,'white.css'),{force:true});
let html = readFileSync(resolve(site,'index.html'),'utf8');
html = html.replace(/<script>const white[\s\S]*?<\/script>/, '<script>document.documentElement.dataset.mode="art";window.WUZHANG_API_BASE=location.origin;</script><link rel="stylesheet" href="/cinematic.css">');
writeFileSync(resolve(site,'index.html'),html);
const appJS = resolve(site,'GameStarter/web-demo/src/app.js');
let js=readFileSync(appJS,'utf8').replace(/const whiteMode = .*?;/,'const whiteMode = false;');
// The release keeps the gameplay help and removes the unused authoring inspector.
js=js.replace(/function conditionHTML\([\s\S]*?(?=function modalHTML\()/,'');
js=js.replace(/else if \(panel === 'logic'\) \{[\s\S]*?\}\s*else if \(panel === 'help'\)/,"else if (panel === 'help')");
js=js.replace("['logic', 'help',", "['help',");
writeFileSync(appJS,js);
const audioPath=resolve(site,'audio/manifest.json');
const audio=JSON.parse(readFileSync(audioPath,'utf8'));
for(const track of Object.values(audio.music)) {
 const old=resolve(site,'.'+track.src), next=old.replace(/\.wav$/,'.m4a');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',old,'-c:a','aac','-b:a','192k','-movflags','+faststart',next]);
 rmSync(old);track.src=track.src.replace(/\.wav$/,'.m4a');
}
writeFileSync(audioPath,JSON.stringify(audio,null,2));
// Include only JavaScript modules reachable from the two runtime entry points.
const reachable=new Set();
function visit(file){if(reachable.has(file))return;reachable.add(file);const code=readFileSync(file,'utf8');for(const match of code.matchAll(/(?:from\s*|import\s*\()['"](\.[^'"]+)['"]/g))visit(resolve(dirname(file),match[1]));}
visit(appJS);visit(resolve(site,'GameStarter/web-demo/src/ending-album-page.js'));
for(const file of walk(site))if(file.endsWith('.js')&&!reachable.has(file))rmSync(file);
cpSync(process.execPath,resolve(resources,'node'));
cpSync(resolve(project,'packaging/NODE-LICENSE.txt'),resolve(resources,'NODE-LICENSE.txt'));
for(const name of ['run.mjs','backend.mjs'])cpSync(resolve(project,'packaging',name),resolve(resources,name));
cpSync(resolve(project,'server/server.mjs'),resolve(resources,'server.mjs'));
// Distributable defaults contain no developer credentials.
const apiDefaults = { DEEPSEEK_API_KEY: '', DEEPSEEK_BASE_URL: 'https://api.deepseek.com', DEEPSEEK_MODEL: 'deepseek-flash' };
writeFileSync(resolve(resources,'api-defaults.json'),JSON.stringify({apiKey:apiDefaults.DEEPSEEK_API_KEY || '',baseUrl:apiDefaults.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',model:apiDefaults.DEEPSEEK_MODEL || 'deepseek-flash'}),{mode:0o600});

cpSync(resolve(project,'web-demo/serve.mjs'),resolve(resources,'static.mjs'));
writeFileSync(resolve(app,'Contents/Info.plist'),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleName</key><string>逆转五丈原</string><key>CFBundleDisplayName</key><string>逆转五丈原</string><key>CFBundleIdentifier</key><string>com.sirui.wuzhang</string><key>CFBundleExecutable</key><string>Wuzhang</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string><key>LSMinimumSystemVersion</key><string>14.0</string><key>NSHighResolutionCapable</key><true/><key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict></dict></plist>`);
execFileSync('clang',['-fobjc-arc','-arch','arm64','-arch','x86_64','-mmacosx-version-min=14.0','-framework','Cocoa','-framework','WebKit',resolve(project,'packaging/launcher.m'),'-o',resolve(app,'Contents/MacOS/Wuzhang')],{stdio:'inherit'});
execFileSync('codesign',['--force','--deep','--sign','-',app],{stdio:'inherit'});
const files=walk(resources).map(file=>({file:relative(resources,file),bytes:statSync(file).size,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')}));
writeFileSync(resolve(output,'package-manifest.json'),JSON.stringify({builtAt:new Date().toISOString(),ai:{provider:'DeepSeek',model:apiDefaults.DEEPSEEK_MODEL || 'deepseek-flash',thinking:'disabled',prefilled:false},node:process.version,platform:'macOS 14+, arm64/x86_64',contentVersion:JSON.parse(readFileSync(resolve(site,'story/manifest.json'))).contentVersion,bytes:files.reduce((n,f)=>n+f.bytes,0),files},null,2));
writeFileSync(resolve(output,'启动说明.txt'),'双击「逆转五丈原.app」启动。无需安装 Node.js、TypeScript 或 Cocos。\n支持 macOS 14 及以上；Apple Silicon 已实测，Intel 尚未实机验证。\n本包默认 DeepSeek 服务、deepseek-flash 模型，关闭思考，不包含密钥。请先在设置填写自己的密钥。自由交涉与润色需要网络及可用服务账户。可在游戏「设置」修改 API 服务网址、模型和密钥；保存后立即生效，重启后保留。\n存档保存在应用的网页存储中，关闭窗口退出游戏。\n此包为本地签名，未做 Apple 公证；其他 Mac 的系统安全策略可能要求通过「隐私与安全性」允许首次打开。\n');
const zip=resolve(output,'逆转五丈原-macOS.zip'), temporaryZip=resolve(output,'.逆转五丈原-macOS.building.zip');rmSync(temporaryZip,{force:true});
execFileSync('ditto',['-c','-k','--sequesterRsrc','--keepParent',app,temporaryZip]);
renameSync(temporaryZip,zip);
console.log(JSON.stringify({app,zip,resourcesBytes:files.reduce((n,f)=>n+f.bytes,0),zipBytes:statSync(zip).size}));
