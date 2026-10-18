import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import http from 'node:http';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(project,'../outputs/包体验证_20261011');mkdirSync(output,{recursive:true});
const isolated=mkdtempSync(resolve(tmpdir(),'wuzhang-release-'));
const base='http://127.0.0.1:18912',KEY='wuzhang-white-demo-v1';
const fixture=process.argv.includes('--fixture');
const report={verifiedAt:new Date().toISOString(),mode:fixture?'local-provider-fixture':'live',checks:[],api:[],errors:[],missing:[]};
const browser=await chromium.launch({headless:true,channel:'chrome'});
let runtime, provider, page;
try{
 execFileSync('ditto',['-x','-k',resolve(project,'../releases/macos/逆转五丈原-macOS.zip'),isolated]);
 const resources=resolve(isolated,'逆转五丈原.app/Contents/Resources');
 const manifest=JSON.parse(readFileSync(resolve(project,'../releases/macos/package-manifest.json')));
 report.package={contentVersion:manifest.contentVersion,builtAt:manifest.builtAt,resourcesBytes:manifest.bytes,zipSha256:createHash('sha256').update(readFileSync(resolve(project,'../releases/macos/逆转五丈原-macOS.zip'))).digest('hex'),ai:manifest.ai};
 for(const f of manifest.files){const b=readFileSync(resolve(resources,f.file));assert.equal(b.length,f.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);}
 const key='';
 for(const f of manifest.files){if(!/\.(?:js|mjs|json|html|css|svg|txt)$/.test(f.file))continue;const text=readFileSync(resolve(resources,f.file),'utf8');assert(!text.includes('/Users/sirui/'),f.file);assert(!/sk-[A-Za-z0-9_-]{20,}/.test(text),'possible secret in '+f.file);}
 assert(!manifest.files.some(f=>/(?:verification\/|source-art\/|\.env$|visual-filter|wuzhang-blame-v01)/.test(f.file)));
 execFileSync('codesign',['--verify','--deep','--strict',resolve(isolated,'逆转五丈原.app')]);
 assert.equal(JSON.parse(readFileSync(resolve(resources,'api-defaults.json'))).apiKey,key);
 report.checks.push('ZIP哈希一致、签名有效；默认文件和前端均无密钥，无本机路径/测试报告/旧片/实验页');
 let fixtureEndpoint, settingsProbe;
 {
  provider=http.createServer(async(req,res)=>{
   let body='';for await(const c of req)body+=c;const payload=JSON.parse(body);if(payload.messages[0].content==='settings-probe'){settingsProbe={path:req.url,model:payload.model,keyMatched:req.headers.authorization==='Bearer local-test-fixture-key',thinking:payload.thinking.type};}
   const content=payload.messages[payload.messages.length-1].content;const prompt=typeof content==='string'?content:content.find(c=>c.type==='text').text;let data;try{data=JSON.parse(prompt);}catch{data={kind:'polish'};}
   const answer=data.kind==='polish'?'将军，帐内有要事，我立即将急报交予帐门卫士隔帘转报，请暂候。':data.kind==='classify'?{requestId:data.requestId,choice:'WAIT_OUTSIDE',planQuote:data.playerText,reason:'local protocol fixture'}:{'决策分类':data.decisionCategory,'回应的话':data.immutableAnchor};
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id:'fixture',choices:[{message:{role:'assistant',content:typeof answer==='string'?answer:JSON.stringify(answer)},finish_reason:'stop'}]}));
  });
  await new Promise(ok=>provider.listen(0,'127.0.0.1',ok));fixtureEndpoint=`http://127.0.0.1:${provider.address().port}`; 
 }
 const env={...process.env,PATH:'/usr/bin:/bin',GAME_PROFILE_DIR:resolve(isolated,'profile'),GAME_PORT:'18912'};delete env.DEEPSEEK_API_KEY;delete env.DEEPSEEK_MODEL;delete env.DEEPSEEK_BASE_URL;
 const launch=async()=>{
  runtime=spawn(resolve(resources,'node'),[resolve(resources,'run.mjs'),'--no-open'],{cwd:isolated,env,stdio:['ignore','pipe','pipe']});
  await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(new Error('Launcher readiness timeout')),15000);runtime.stdout.on('data',d=>{if(d.toString().includes('WUZHANG_READY')){clearTimeout(t);ok();}});runtime.once('exit',code=>{clearTimeout(t);fail(new Error('Launcher exited '+code));});});
 };
 await launch();
 const ctx=await browser.newContext({viewport:{width:1440,height:900}}),p=await ctx.newPage();page=p;
 p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.url().includes('/api/game/respond'))report.api.push({status:r.status(),origin:new URL(r.url()).origin});if(r.status()===404)report.missing.push(r.url());});
 await p.goto(base);await p.locator('.main-menu').waitFor();
 assert.equal(statSync(resolve(isolated,'profile/.env')).mode&0o777,0o600);
 assert.equal((await fetch(base+'/__game/health').then(r=>r.json())).aiReady,false);
 assert.equal(await p.locator('[data-action=logic]').count(),0);
 await p.locator('[data-action=settings]').click();await p.locator('#api-key:not(:disabled)').waitFor();
 assert.equal(await p.locator('#api-key').getAttribute('type'),'password');assert.equal(await p.locator('#api-key').inputValue(),key);
 assert.equal(await p.locator('#api-base-url').inputValue(),'https://api.deepseek.com');assert.equal(await p.locator('#api-model').inputValue(),'deepseek-flash');
 await p.screenshot({path:resolve(output,'发布包-API设置.png')});
 const savedStory=await p.evaluate(k=>localStorage.getItem(k),KEY);
 await p.locator('#api-base-url').fill('file:///bad');await p.locator('[data-action=save-api-settings]').click();await p.locator('.api-settings-status.error').waitFor();
 const unchanged=await fetch(base+'/api/game/settings').then(r=>r.json());assert.equal(unchanged.baseUrl,'https://api.deepseek.com');
 await p.locator('#api-base-url').fill(fixtureEndpoint+'/v1/chat/completions');await p.locator('#api-model').fill('configured-model');await p.locator('#api-key').fill('local-test-fixture-key');
 await p.locator('[data-action=save-api-settings]').click();await p.waitForFunction(()=>document.querySelector('.api-settings-status')?.textContent.includes('已保存'));
 assert.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),savedStory);
 const probe=await p.evaluate(async()=>{const r=await fetch('/api/game/respond',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'settings-probe'})});return r.status;});assert.equal(probe,200);
 assert.deepEqual(settingsProbe,{path:'/v1/chat/completions',model:'configured-model',keyMatched:true,thinking:'disabled'});
 const exited=new Promise(ok=>runtime.once('exit',ok));runtime.kill('SIGTERM');await exited;await launch();await p.reload();await p.locator('[data-action=settings]').click();await p.locator('#api-key:not(:disabled)').waitFor();
 assert.equal(await p.locator('#api-base-url').inputValue(),fixtureEndpoint+'/v1/chat/completions');assert.equal(await p.locator('#api-key').inputValue(),'local-test-fixture-key');assert.equal(await p.locator('#api-model').inputValue(),'configured-model');
 await p.locator('#api-base-url').fill(fixture?fixtureEndpoint:'https://api.deepseek.com');await p.locator('#api-model').fill('deepseek-flash');await p.locator('#api-key').fill(fixture?'local-test-fixture-key':key);await p.locator('[data-action=save-api-settings]').click();await p.waitForFunction(()=>document.querySelector('.api-settings-status')?.textContent.includes('已保存'));await p.locator('[data-action=close]').click();
 report.api=[];report.checks.push('空白用户直接启动、默认配置密码框预填；无效网址不覆盖；修改网址/模型/密钥实际生效、关闭思考、重启保留且不改剧情存档；配置权限600');
 for(const clip of JSON.parse(readFileSync(resolve(resources,'web/video/media-manifest.json'))).clips){
  const response=await fetch(base+clip.url,{headers:{Range:'bytes=0-31'}});assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,32);
  assert.equal((await fetch(base+clip.url,{method:'HEAD'})).status,200);
  assert.equal((await fetch(base+clip.url,{headers:{Range:'bytes=999999999-'}})).status,416);
 }
 const music=await p.evaluate(async()=>{const m=await fetch('/audio/manifest.json').then(r=>r.json());const ctx=new AudioContext();const results=[];for(const [name,track] of Object.entries(m.music)){const response=await fetch(track.src);const b=await ctx.decodeAudioData(await response.arrayBuffer());results.push({name,duration:b.duration});}await ctx.close();return results;});
 for(const track of music){const original=JSON.parse(readFileSync(resolve(project,'web-demo/public/audio/manifest.json'))).music[track.name];const duration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',resolve(project,'web-demo/public','.'+original.src)]));assert(Math.abs(duration-track.duration)<0.1);}
 report.music=music;report.checks.push('4段BGM浏览器解码且时长差小于0.1秒；4个视频HEAD/Range/非法Range正确');
 await p.screenshot({path:resolve(output,'发布包-首页.png')});
 const click=(a,id)=>p.locator(`[data-action="${a}"]${id?`[data-id="${id}"]`:''}`).first().click();
 const finish=async()=>{for(let i=0;i<60&&await p.locator('.speech').count();i++)await p.locator('body').press('Enter');};
 const go=async(s,a)=>{await click('scene',s);await click('person',a);};
 const talk=async(s,a,n)=>{await go(s,a);if(await p.locator(`[data-action=topic][data-id="${n}"]`).count())await click('topic',n);await finish();};
 const state=()=>p.evaluate(k=>JSON.parse(JSON.parse(localStorage.getItem(k)).save),KEY);
 const present=async id=>{await click('evidence');await click('toggle-evidence',id);await click('present');await finish();};
 const scout=async teaching=>{await talk('report_post','scout',teaching?'tutorial.scout':'scout.report');await present('entry_notice');await click('choice','scout.notice.question');await finish();};
 const skipMovies=async()=>{for(let i=0;i<5&&await p.locator('video').count();i++){await p.locator('[data-cinema-action=skip]').click();}};
 const submit=async text=>{await click('open-composer');await p.locator('#draft').fill(text);await click('submit');await p.waitForFunction(()=>!document.querySelector('[data-action=cancel-response]')&&(document.querySelector('.speech')||document.querySelector('.reply-service-error')||document.querySelector('.feedback')),null,{timeout:65000});assert.equal(await p.locator('.feedback,.reply-service-error').count(),0,'AI request failed; no false pass');await finish();};
 await click('menu-new');await p.locator('[data-cinematic=opening]').waitFor();await p.waitForFunction(()=>document.querySelector('video').readyState>=2);await skipMovies();await finish();
 await talk('camp_gate','notice','tutorial.notice');await scout(true);await go('report_post','weiyan');await finish();await present('entry_notice');await present('scout_statement');
 await click('open-composer');await p.locator('#draft').fill('帐内有要事，我立即将急报交给帐门卫士，请他隔帘向帐内通报。');await click('reply-polish');await click('generate-polish');await p.waitForFunction(()=>document.querySelector('.reply-polish-status')?.textContent.includes('已填入'),null,{timeout:35000});assert((await p.locator('#draft').inputValue()).length>10);await click('close-composer');
 await submit('将军，禁令已通传，帐内要事不可惊扰，但军报也不能拖。我立即到帐门请帐内能接报的人出来听急报，请将军暂候，我马上回来传话。');
 await skipMovies();await p.locator('[data-ending=tutorial-sacrifice]').waitFor();assert.equal((await state()).flags['loop.result'],'tutorial_execution');
 await click('continue-teaching');await finish();assert.equal((await state()).flags['progress.tutorial_completed'],true);
 assert.equal(await p.locator('[data-action=scene][data-id=camp_gate]').count(),0);
 await talk('notice_front','notice','entry_notice');await talk('notice_front','guard','guard.gossip');await talk('notice_front','relay','relay.jiangwei_line');await talk('jiangwei_tent_front','jiangwei_guard','jiangwei_guard.arrival');await click('choice','v07.request.good');await finish();assert.equal((await state()).flags['loop.jiangwei_approval'],true);await scout(false);await go('report_post','weiyan');await finish();await present('entry_notice');await present('jiangwei_authorization');await present('scout_statement');
 await click('open-composer');await p.locator('#draft').fill('将军，急报不能耽误，但丞相今夜谁也不许入帐，径入恐被问责。姜将军已许可接报定夺，我立即回帐门请甲隔帘向姜将军报明军情，由姜将军当场决定、承担自己的决定，请将军暂候。');
 await click('close-composer');await p.reload();await click('menu-load');await click('menu-continue');await click('open-composer');assert.match(await p.locator('#draft').inputValue(),/姜将军/);await click('close-composer');
 await submit('将军，急报不能耽误，但丞相今夜谁也不许入帐，径入恐被问责。姜将军已许可接报定夺，我立即回帐门请甲隔帘向姜将军报明军情，由姜将军当场决定、承担自己的决定，请将军暂候。');
 await p.locator('[data-campaign=video]').waitFor();assert.equal((await state()).flags['loop.report_status'],'relayed');await skipMovies();await p.locator('[data-ending=safe]').waitFor();await p.screenshot({path:resolve(output,'发布包-生还结局.png')});
 await click('return-home');await p.locator('[data-campaign=map]').waitFor({timeout:15000});await p.screenshot({path:resolve(output,'发布包-通关地图.png')});
 assert.equal(report.api.length,5);assert(report.api.every(r=>r.status===200&&r.origin===base));assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);
 report.checks.push(`从新游戏取证、两轮${fixture?'本地模拟提供商协议':'真实AI'}交涉、牺牲影片、继续复活、二轮草稿刷新读档、生还影片、结局和通关地图全部通过`);
 await ctx.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844}}),mp=await mobile.newPage();await mp.goto(base+'/?white=1');await mp.locator('.main-menu').waitFor();assert.equal(await mp.evaluate(()=>document.documentElement.dataset.mode),'art');assert.equal(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mobile.close();report.checks.push('390宽首页无溢出；发布包忽略白模查询参数');
 report.passed=true;console.log(JSON.stringify({passed:true,checks:report.checks,api:report.api}));
}catch(error){report.passed=false;report.failure=error.message;if(page){report.failureBody=(await page.locator('body').innerText()).slice(-12000);report.failureStorage=await page.evaluate(()=>localStorage.getItem('wuzhang-white-demo-v1'));await page.screenshot({path:resolve(output,'发布包-失败现场.png')});}console.error(error);process.exitCode=1;}
finally{runtime?.kill('SIGTERM');provider?.close();await browser.close();writeFileSync(resolve(output,fixture?'release-fixture-verification.json':'release-verification.json'),JSON.stringify(report,null,2));await new Promise(r=>setTimeout(r,500));rmSync(isolated,{recursive:true,force:true});}
