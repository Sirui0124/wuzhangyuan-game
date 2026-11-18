import {verifyChapterFour} from '../../../tools/release/chapter-four-check.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { _electron as electron } from 'playwright';
import { listPackage } from '@electron/asar';

// Launch only this run's isolated NSIS installation. Never attach to a player session.
const workspace=resolve(import.meta.dirname,'../../..');
const option=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
assert.ok(option('release-output'),'Specify --release-output for this release to preserve prior evidence');
const releaseOutput=resolve(option('release-output'));
assert.ok(releaseOutput.startsWith(resolve(workspace,'outputs')+sep),'Release evidence must stay in workspace outputs');
const releaseLabel=releaseOutput.split(sep).at(-1).replace(/^windows-release-/,'');
const allowedTestRoot=resolve(process.env.LOCALAPPDATA,'WuzhangyuanReleaseTests');
const testRoot=resolve(option('validation-root') || resolve(allowedTestRoot,releaseLabel));
assert.ok(testRoot.startsWith(allowedTestRoot+sep),'Installed validation must be isolated outside the workspace');
const unpackedProbe=process.argv.includes('--unpacked-probe');
const currentAccess=process.argv.includes('--current-access');
const executable=resolve(process.argv[2] || resolve(testRoot,'app/Wuzhangyuan.exe'));
const allowedExecutableRoot=unpackedProbe?resolve(testRoot,'unpacked'):resolve(testRoot,'app');
assert.ok(executable.startsWith(allowedExecutableRoot+sep),'Validation executable must be inside this run’s isolated install directory or explicit unpacked probe root');
assert.ok(existsSync(executable),'Install the generated NSIS executable before running this test');
const output=resolve(releaseOutput,unpackedProbe?'validation-unpacked':'validation');
const userData=resolve(testRoot,`userdata-${Date.now()}`);
mkdirSync(output,{recursive:true});mkdirSync(userData,{recursive:true});
const env={...process.env};
for(const key of Object.keys(env)) if(/^(?:DEEPSEEK|TTS|VOLC|OPENAI|ARK|DOUBAO|GAME_|NODE_OPTIONS|ELECTRON_RUN_AS_NODE)/i.test(key))delete env[key];
const windows=process.env.SystemRoot || 'C:\\Windows';
env.PATH=resolve(windows,'System32')+';'+windows;
env.Path=env.PATH;
// Non-secret sentinels prove the release launcher does not inherit provider settings.
env.DEEPSEEK_API_KEY='packaging-validation-only-not-a-real-key';
env.TTS_API_KEY='packaging-validation-only-not-a-real-key';
const report={passed:false,mode:unpackedProbe?'unpacked-probe-not-installation':'installed-executable',executable,userData,checks:[],errors:[],missing:[],billableRequests:[],launches:[],lifecycle:[]};
const key='wuzhang-chapter-session-v1';
const saveKeys=[key,'grain-chapter-two-films-v1','jieting-chapter-three-v1'];
saveKeys.push('yiling-command-chapter-v1','jingzhou-chapter-five-v1','luofengpo-chapter-seven-v1');
const recordKeys=[...saveKeys,'windows-install-validation-marker'];
async function completePrerequisite(page,chapter){
 await page.evaluate(chapter=>{
  const historyKey='wuzhang-chapter-history-v1';
  const previous=JSON.parse(localStorage.getItem(historyKey)||'{"version":1,"entered":[],"completed":[]}');
  for(const field of ['entered','completed'])if(!previous[field].includes(chapter))previous[field].push(chapter);
  localStorage.setItem(historyKey,JSON.stringify(previous));
 },chapter);
}
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function waitUntil(fn,label,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){try{const result=await fn();if(result)return result;}catch{}await pause(150);}throw new Error('Timed out: '+label);}
async function launch(index){
 const smoke=resolve(output,`launch-${index}.json`);
 rmSync(smoke,{force:true});
 const app=await electron.launch({executablePath:executable,args:[`--user-data-dir=${userData}`,`--smoke-report=${smoke}`],env,timeout:120000});
 app.process().on('exit',(code,signal)=>report.lifecycle.push({event:'process-exit',index,code,signal,at:new Date().toISOString()}));
 app.on('close',()=>report.lifecycle.push({event:'application-close',index,at:new Date().toISOString()}));
 try{
 const page=await app.firstWindow();page.setDefaultTimeout(30000);
 page.on('crash',()=>report.lifecycle.push({event:'renderer-crash',index,at:new Date().toISOString()}));
 page.on('close',()=>report.lifecycle.push({event:'page-close',index,at:new Date().toISOString()}));
 await page.setViewportSize({width:1440,height:900});
 await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.webContents.setBackgroundThrottling(false);window.hide();});
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('response',response=>{if(response.status()===404)report.missing.push(response.url());});
 page.on('request',request=>{if(request.method()==='POST' && /\/api\/game\/(respond|tts)(?:$|\/)/.test(request.url()) && !request.url().endsWith('/tts/settings'))report.billableRequests.push(request.url());});
 await page.locator('.game-menu').waitFor();
 // ready-to-show may run after the first hide; keep the test window hidden once loaded.
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].hide());
 const meta=await waitUntil(()=>existsSync(smoke)&&JSON.parse(readFileSync(smoke,'utf8')),'launch metadata');
 assert.equal(resolve(meta.userData),userData);assert.equal(meta.packaged,true);
 const runtime=await app.evaluate(({app})=>({version:app.getVersion(),userData:app.getPath('userData'),packaged:app.isPackaged,node:process.versions.node,electron:process.versions.electron,execPath:process.execPath}));
 assert.equal(runtime.packaged,true);assert.equal(resolve(runtime.userData),userData);assert.equal(resolve(runtime.execPath),executable);
 assert.ok(Number(runtime.node.split('.')[0])>=22);
 const health=await fetch(`http://127.0.0.1:${meta.apiPort}/health`).then(r=>r.json());
 assert.equal(health.configured,false,'A clean release must not inherit development credentials');
 const viaRenderer=await page.evaluate(async()=>{const r=await fetch('http://127.0.0.1:8787/health');return {ok:r.ok,data:await r.json()};});
 assert.equal(viaRenderer.ok,true);assert.equal(viaRenderer.data.configured,false);
 const voiceStatus=await page.evaluate(async()=>(await fetch('http://127.0.0.1:8787/api/game/tts/settings')).status);
 assert.equal(voiceStatus,410,'Live voice settings are retired');
 assert.notEqual(meta.staticPort,8812);assert.notEqual(meta.apiPort,8787);
 report.launches.push({index,runtime,meta,healthConfigured:health.configured});
 return {app,page,meta};
 }catch(error){await app.close().catch(()=>{});throw error;}
}
async function closeAndCheck(active){
 const {app,meta}=active;await app.close();
 await waitUntil(async()=>{try{await fetch(`http://127.0.0.1:${meta.apiPort}/health`,{signal:AbortSignal.timeout(500)});return false;}catch{return true;}},'backend shutdown');
 await waitUntil(async()=>{try{await fetch(`http://127.0.0.1:${meta.staticPort}/`,{signal:AbortSignal.timeout(500)});return false;}catch{return true;}},'static server shutdown');
}
async function capture(active,name){
 if(process.argv.includes('--skip-captures')) { (report.skippedCaptures??=[]).push(name); return; }
 // DevTools screenshots can stall while a Windows Electron window is hidden.
 // Electron's native capture explicitly keeps hidden pages awake for the frame.
 const png=await active.app.evaluate(async({BrowserWindow})=>{
  const image=await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
  if(image.isEmpty())throw new Error('Empty installed-app capture');
  return image.toPNG().toString('base64');
 });
 writeFileSync(resolve(output,name),Buffer.from(png,'base64'));
}
let active;
try{
 const installRoot=dirname(executable);
 const manifest=JSON.parse(readFileSync(resolve(releaseOutput,'payload-manifest.json'),'utf8'));
 const payloadFailures=[];
 for(const item of manifest.files){
  const target=resolve(installRoot,item.destination);
  assert.ok(target.startsWith(installRoot+sep),'Manifest path must remain in the installation');
  if(!existsSync(target)){payloadFailures.push({path:item.destination,issue:'missing'});continue;}
  if(statSync(target).size!==item.bytes){payloadFailures.push({path:item.destination,issue:'size'});continue;}
  const hash=createHash('sha256').update(readFileSync(target)).digest('hex');
  if(hash!==item.sha256)payloadFailures.push({path:item.destination,issue:'sha256'});
 }
 report.payload={files:manifest.files.length,failures:payloadFailures};
 assert.deepEqual(payloadFailures,[],'Every payload manifest file must survive installation byte for byte');
 for(const retired of ['GameStarter/server/tts.mjs','GameStarter/server/tts-protocol.mjs','node_modules/ws']){
  assert.equal(existsSync(resolve(installRoot,'resources/game',retired)),false,retired);
 }
 report.checks.push('All manifest file sizes and SHA256 hashes match the installation. Retired voice modules are absent.');
 active=await launch(1);let {page}=active;
 const inlineConfig=await active.app.evaluate(()=>({settingsFile:process.env.GAME_SETTINGS_FILE,hasInheritedKey:!!process.env.DEEPSEEK_API_KEY}));
 assert.equal(resolve(inlineConfig.settingsFile),resolve(userData,'settings/.env'));
 assert.equal(inlineConfig.hasInheritedKey,false);
 report.checks.push('Inline chapter-one and command-map handlers share the player settings path and do not inherit provider credentials.');
 report.checks.push('Installed executable starts with PATH limited to Windows; packaged Node/Electron runtime and isolated userData are active.');
 report.checks.push('Occupied development ports are bypassed by private runtime ports; fixed renderer origins reach the clean packaged backend.');
 await capture(active,'01-installed-home.png');
 await page.locator('.ai-setup-intro').waitFor();
 await page.locator('.ai-setup-intro [data-action=close-modal]').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('wuzhang-ai-setup-seen-v1')),'1');
 report.checks.push('A clean installed profile shows the initial AI Token guidance and can skip it without a model request.');
 await page.locator('[data-action=settings]').click();
 assert.equal(await page.locator('#reduce-motion').count(),0);
 assert.equal(await page.locator('#api-settings').evaluate(node=>node.previousElementSibling?.querySelector('#game-ai-enabled')!==null),true);
 const apiDetails=page.locator('#api-settings');
 if(!await apiDetails.evaluate(node=>node.open))await page.locator('#api-settings > summary').click();
 await page.locator('#api-model:not([disabled])').waitFor();
 assert.equal(await page.locator('#api-key').getAttribute('type'),'password');
 await capture(active,'01b-installed-settings.png');
 await page.locator('.modal-close').click();
 report.checks.push('Installed settings place the expandable API configuration immediately below Enable AI, keep the key masked, and remove the manual reduced-motion option.');
 await page.locator('[data-action=new]').click();await page.locator('[data-action=new-confirmed]').click();await page.locator('video').waitFor();
 await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&v.videoWidth>0;},null,{timeout:60000});
 await page.locator('video').evaluate(v=>{v.muted=true;return v.play();});
 const begin=await page.locator('video').evaluate(v=>v.currentTime);await pause(1200);
 assert.ok(await page.locator('video').evaluate((v,t)=>v.currentTime>t+.3,begin),'Bundled MP4 decodes and plays');
 const videoURL=await page.locator('video').getAttribute('src');
 await capture(active,'02-installed-video.png');
 await page.locator('[data-cinema-action=skip]').click();
 await page.waitForFunction(key=>!!localStorage.getItem(key),key);
 const saved=await page.evaluate(key=>localStorage.getItem(key),key);assert.ok(saved);
 const savedState=JSON.parse(saved);assert.ok(savedState.contentVersion&&savedState.story);
 await page.evaluate(label=>localStorage.setItem('windows-install-validation-marker',label),releaseLabel);
 report.checks.push('New game writes a real chapter save and its bundled video has a decoded frame and advancing playback.');
 // Verify the real chapter gate before supplying prerequisites in isolated test history.
 await page.goto('http://127.0.0.1:8812/?chapter=grain');
 await page.waitForFunction(()=>new URL(location.href).searchParams.get('locked')==='grain');
 assert.equal(await page.evaluate(()=>localStorage.getItem('grain-chapter-two-films-v1')),null);
 report.checks.push('A fresh profile cannot enter the locked second chapter; later chapter probes use explicit isolated prerequisite history without changing plot saves.');
 if(currentAccess){
  for(const chapter of ['grain','jieting','jingzhou','luofengpo']){
   await page.goto(`http://127.0.0.1:8812/?chapter=${chapter}`);
   await page.waitForFunction(id=>new URL(location.href).searchParams.get('locked')===id,chapter);
  }
  report.checks.push('Current release keeps chapters two, three, five and seven closed; authored originals remain in the local workspace.');
 }
 if(!currentAccess){
 await completePrerequisite(page,'wuzhang');
 await page.goto('http://127.0.0.1:8812/?chapter=grain');
 await page.waitForFunction(()=>!!localStorage.getItem('grain-chapter-two-films-v1'));
 await page.waitForFunction(()=>document.querySelector('video,.game-scene,.workspace-screen'));
 await capture(active,'03-installed-chapter-two.png');
 const mediaHandoffPath=resolve(releaseOutput,'media-handoff.json');
 const handoffPath=existsSync(mediaHandoffPath)?mediaHandoffPath:resolve(releaseOutput,'chapter-two-handoff.json');
 if(existsSync(handoffPath)){
  const handoff=JSON.parse(readFileSync(handoffPath,'utf8'));
  report.updatedMediaProbes=[];
  for(const clip of handoff.probeResources??[handoff.playbackResources[0]]){
  assert.ok(clip?.src&&clip?.subtitles,'Video handoff must identify the adopted video and subtitles');
  const probe=await page.evaluate(async clip=>{
   const video=document.createElement('video');video.muted=true;video.playsInline=true;
   video.style.cssText='position:fixed;width:2px;height:2px;left:0;top:0';document.body.append(video);
   try{
    await new Promise((ok,reject)=>{const timer=setTimeout(()=>reject(new Error('Updated clip decode timed out')),20000);video.onloadeddata=()=>{clearTimeout(timer);ok();};video.onerror=()=>{clearTimeout(timer);reject(new Error('Updated clip decode failed'));};video.src=clip.src;video.load();});
    if(clip.probeTime>0)await new Promise((ok,reject)=>{const timer=setTimeout(()=>reject(new Error('Updated voice seek timed out')),15000);video.addEventListener('seeked',()=>{clearTimeout(timer);ok();},{once:true});video.currentTime=clip.probeTime;});
    await video.play();const start=video.currentTime;await new Promise(ok=>setTimeout(ok,800));
    const subtitle=await fetch(clip.subtitles);const vtt=await subtitle.text();
    return{id:clip.id,src:clip.src,subtitles:clip.subtitles,width:video.videoWidth,height:video.videoHeight,advanced:video.currentTime>start+.3,subtitleLoaded:subtitle.ok&&vtt.trimStart().startsWith('WEBVTT'),audioDecodedBytes:video.webkitAudioDecodedByteCount??null,probeTime:clip.probeTime??0};
   }finally{video.pause();video.removeAttribute('src');video.load();video.remove();}
  },clip);
  report.updatedMediaProbes.push(probe);
  assert.ok(probe.width>0&&probe.advanced&&probe.subtitleLoaded);
  if(clip.probeTime!==undefined)assert.ok(probe.audioDecodedBytes>0,'Updated player-voice sample must decode audio from the installed MP4');
  }
  report.updatedChapterTwoMediaProbe=report.updatedMediaProbes.find(probe=>probe.id.startsWith('CH2-'))??report.updatedMediaProbes[0];
  report.checks.push(`${report.updatedMediaProbes.length} adopted media samples decode and advance from installed resources, with matching VTT subtitles; voice handoffs also verify audio decoding.`);
 }
 await completePrerequisite(page,'grain');
 await page.goto('http://127.0.0.1:8812/?chapter=jieting');
 await page.waitForFunction(()=>!!localStorage.getItem('jieting-chapter-three-v1'));
 await page.waitForFunction(()=>document.querySelector('video,.game-scene,.workspace-screen'));
 await capture(active,'04-installed-chapter-three.png');
 }
 {
  await completePrerequisite(page,'jieting');
  const verified=await verifyChapterFour(page,'http://127.0.0.1:8812',`http://127.0.0.1:${active.meta.staticPort}`);
  assert.ok(existsSync(resolve(userData,'yiling-command/saves',verified.id+'.json')));
  report.rescue={id:verified.id,revision:verified.revision};
  await capture(active,'04b-installed-chapter-four.png');
  if(!currentAccess){
  await completePrerequisite(page,'yiling');
  await page.goto('http://127.0.0.1:8812/?chapter=jingzhou');
  await page.locator('#spoken-line').waitFor();
  await page.waitForFunction(()=>!!localStorage.getItem('jingzhou-chapter-five-v1'));
  await capture(active,'04c-installed-chapter-five.png');
  await completePrerequisite(page,'jingzhou');
  await page.goto('http://127.0.0.1:8812/?chapter=luofengpo');
  await page.locator('main[data-node]').waitFor();
  await page.waitForFunction(()=>!!localStorage.getItem('luofengpo-chapter-seven-v1'));
  await capture(active,'04d-installed-finale.png');
  }
 }
 if(currentAccess){
  const origin='http://127.0.0.1:8812';
  const direct=`http://127.0.0.1:${active.meta.staticPort}`;
  const profile=await(await fetch(direct+'/release-profile.json')).json();assert.deepEqual(profile.chapters,['wuzhang','yiling']);
  for(const path of ['/story/chapter-two.json','/story/chapter-three.json','/GameStarter/web-demo/src/chapter-two.js','/GameStarter/web-demo/src/chapter-three.js'])assert.equal((await fetch(direct+path)).status,404,path);
  report.checks.push('Only chapters one/four are packaged; omitted chapter files return 404; chapter-four map contact, shared official/legacy-link session, first-round report and retired API 404 pass.');
 }
 // Release URLs must not request excluded playtest JSON.
 await page.goto('http://127.0.0.1:8812/?playtest=weiyan-second');await page.locator('.game-menu').waitFor();
 assert.equal(new URL(page.url()).searchParams.has('playtest'),false);
 // Capture records after leaving the chapter and settling on the menu.
 const expected=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),recordKeys);
 assert.equal(expected[key],saved);
 writeFileSync(resolve(output,'save-records-before-restart.json'),JSON.stringify(expected,null,2));
 report.checks.push(currentAccess?'Open chapters one and four start from packaged resources; other chapters preserve current closed gates; release entry removes playtest parameters.':`All ${saveKeys.length} chapters start from packaged resources with test prerequisites; release entry removes excluded playtest parameters.`);
 await closeAndCheck(active);active=null;
 active=await launch(2);page=active.page;
 const restored=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),recordKeys);
 writeFileSync(resolve(output,'save-records-after-restart.json'),JSON.stringify(restored,null,2));
 assert.deepEqual(restored,expected,'All chapter records survive a new app process');
 const restoredRescue=await page.evaluate(async id=>(await (await fetch('/api/yiling-command/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenarioId:id})})).json()).session,report.rescue.id);
 assert.equal(restoredRescue.scenarioId,report.rescue.id);assert.equal(restoredRescue.revision,report.rescue.revision);
 await page.locator('[data-action=continue]').click();
 await page.waitForFunction(()=>!document.querySelector('.game-menu'));
 const resumed=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key));
 assert.equal(resumed.contentVersion,savedState.contentVersion);assert.equal(resumed.story.current,savedState.story.current);assert.equal(resumed.section,savedState.section);
 await capture(active,'05-installed-restored.png');
 report.checks.push('A second installed-app process restores all saved records and Continue resumes the real first-chapter progress.');
 await closeAndCheck(active);active=null;
 report.checks.push('Both app exits close their private backend and static listener.');
 const installFiles=[];function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,item.name);item.isDirectory()?walk(p):installFiles.push(p);}}walk(dirname(executable));
 const archive=resolve(dirname(executable),'resources/app.asar');
 const archiveFiles=listPackage(archive);assert.ok(archiveFiles.some(p=>/[\\/]main\.cjs$/.test(p)));
 assert.ok(!archiveFiles.some(p=>/(?:^|[\\/])\.env(?:$|\.)|[\\/]node_modules[\\/]|[\\/](?:outputs|playtest|\.cache)[\\/]/i.test(p)),'Main process archive contains only release launcher files');
 assert.ok(!installFiles.some(p=>/(?:^|[\\/])\.env(?:$|\.(?!example$))|\.profiles\.json$|\.(?:jks|keystore|pfx|pem|key)$/i.test(p)), 'No credentials or signing keys in installed files');
 assert.ok(!installFiles.some(p=>/[\\/]node_modules[\\/](?:typescript|playwright)/.test(p)),'No development TypeScript/Playwright payload');
 report.checks.push('Installed file names contain no environment/profile credentials, signing keys, TypeScript or Playwright dependency payload.');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);assert.deepEqual(report.billableRequests,[]);
 report.video=videoURL;report.passed=true;
}catch(error){report.failure=String(error.stack??error);if(active)await capture(active,'failure.png').catch(()=>{});throw error;}
finally{if(active)await active.app.close().catch(()=>{});writeFileSync(resolve(output,'installed-app-verification.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
