import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {createAiService,createSigner} from '../../GameStarter/server/chapter-one-ai.mjs';
import {Dialogue} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/branch-engine.js';
const story=JSON.parse(readFileSync('content/chapters/wuzhang/chapter-one.branch.json','utf8'));
const films=JSON.parse(readFileSync('GameStarter/web-demo/public/cinematics.json','utf8'));
const allowedMedia=new Set([
 ...films.prologue, ...films.opening,
 ...story.nodes.flatMap(node=>node.film?[...(node.film.leadIn??[]),node.film]:[]),
].map(clip=>clip.src));
const server=createStaticServer({root:resolve(process.argv[2]??'GameStarter/web-demo/.build')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,out=resolve('outputs/chapter-one-integration');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
let plan='invite_jiang', modelFail=false, scenario='normal';
const service=createAiService({Dialogue,storyLoader:async()=>story,signer:createSigner('browser-mainline'),model:async input=>{
 if(modelFail)throw Error('测试连接失败');
 if(input.system.includes('语义分类器') && scenario!=='normal')return {text:JSON.stringify({enemy:'missing',enemyQuote:'',plan:'none',planQuote:'',unsupportedClaim:false,claimQuote:'',offense:scenario==='anger'?'grave':'none',offenseQuote:scenario==='anger'?'我要投敌，替魏军打开营门':'',recipientQuote:'',actionQuote:''})};
 if(input.system.includes('语义分类器')){
  const planQuote=plan==='invite_jiang'?'请伯约来听报':plan==='relay_jiang'?'请伯约看报':'我来转呈军报';
  return {text:JSON.stringify({enemy:'understood',enemyQuote:'还没攻营',plan,planQuote,unsupportedClaim:false,claimQuote:'',offense:'none',offenseQuote:'',recipientQuote:plan==='self_relay'?'':'伯约',actionQuote:planQuote})};
 }
 if(input.system.includes('校验魏延'))return {text:'{"valid":true}'};
 if(scenario!=='normal')return {text:JSON.stringify({utterance:story.aiScenes.weiyan_plan.routes[JSON.parse(input.text).outcome].fallback})};
 return {text:JSON.stringify({utterance:story.aiScenes.weiyan_plan.routes[plan==='invite_jiang'?'INVITE_JIANG':plan==='relay_jiang'?'RELAY_JIANG':'SELF_RELAY'].fallback})};
}});
const errors=[],checks=[],media=[],ttsRequests=[];
const key='wuzhang-chapter-session-v1';
async function fixture(offline=false){
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 await ctx.addInitScript(offline=>{localStorage.setItem('wuzhang-runtime-mode-v1',offline?'offline':'ai');localStorage.setItem('wuzhang-ai-setup-v1','acknowledged');localStorage.setItem('wuzhang-voice-muted','1');localStorage.setItem('wuzhang-ai-voice-enabled','1');},offline);
 await ctx.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:true}}));
 await ctx.route('**/api/chapter-one/turn',async route=>{try{const result=await service(route.request().postDataJSON(),AbortSignal.timeout(10000));await route.fulfill({json:result});}catch(e){await route.fulfill({status:502,json:{error:e.message}});}});
 await ctx.route('**/api/chapter-one/polish',r=>r.fulfill({json:{text:'魏军还没攻营，我去请伯约来听报。'}}));
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().includes('/api/game/tts'))ttsRequests.push(r.url());if(r.url().includes('.mp4')&&!p.url().includes('chapter=grain'))media.push(r.url());});
 await p.goto(origin);await p.locator('[data-action="new"]').waitFor();
 if(await p.locator('[data-action="close-modal"]').isVisible())await p.locator('[data-action="close-modal"]').click();
 await p.locator('[data-action="new"]').click();await p.locator('[data-action="new-confirmed"]').click();
 await p.locator('[data-cinema-action="skip"]').waitFor();await p.locator('[data-cinema-action="skip"]').click();
 await p.locator('[data-map-node="wuzhang"] button').click();
 await p.locator('[data-cinema-action="skip"]').waitFor();await p.locator('[data-cinema-action="skip"]').click();await p.locator('.branch-scene').waitFor();
 return {ctx,p};
}
async function click(p,s){await p.locator(s).click();await p.waitForTimeout(100);}
async function settle(p){for(let i=0;i<150;i++){if(await p.locator('[data-branch="notice"]').count()){await click(p,'[data-branch="notice"]');continue;}if(await p.locator('[data-cinema-action=skip]').count()){await click(p,'[data-cinema-action=skip]');continue;}const b=p.locator('.dialogue-advance');if(!await b.count())return;await click(p,'.dialogue-advance');}throw Error('剧情未停止');}
async function choose(p,id){await click(p,`[data-branch="choose"][data-choice="${id}"]`);await settle(p);}
async function toAi(p,known=true,branch='critical'){
 await settle(p);
 await p.screenshot({path:resolve(out,'restored-guard-desktop.png')});
 if(known){await p.locator('#branch-input').fill('还有谁能帮忙处理军情？');await click(p,'[data-branch-form] button[type="submit"]');await settle(p);}else await choose(p,'enemy');
 for(const id of ['meet','concern_joint'])await choose(p,id);
 assert.equal(await p.locator('.branch-hint, .expression-help').count(),0);
}
try{
 for(const [name,known,branch,outcome] of [['coop',true,'critical','E-FORMAL'],['formal',true,'front','E-FORMAL'],['death',false,'critical','E-DEATH']]){
  const {ctx,p}=await fixture();await toAi(p,known,branch);
  if(name==='coop'){
   await p.screenshot({path:resolve(out,'formal-ai-desktop.png')});
   await click(p,'[data-clue-picker]');await p.locator('[data-clue-detail="branch-jiang"] summary').click();await click(p,'[data-action="insert-clue"][data-clue="branch-jiang"]');assert.match(await p.locator('#branch-input').inputValue(),/伯约/);
   await p.locator('#branch-input').fill('魏军还没攻营，我去请伯约来听报。');await click(p,'[data-branch="polish"]');await p.waitForFunction(()=>document.querySelector('#branch-status')?.textContent.includes('已润色'));assert.equal(await p.locator('[data-node="C01-AI-JOINT"]').count(),1);
   if(process.env.WUZHANG_TEST_PC_ONLY!=='1'){
    await p.setViewportSize({width:844,height:390});await p.screenshot({path:resolve(out,'formal-ai-landscape.png')});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.locator('[data-branch-form] button[type="submit"]').scrollIntoViewIfNeeded();assert.ok(await p.locator('[data-branch-form] button[type="submit"]').isVisible());await p.setViewportSize({width:1440,height:900});
   }
   await click(p,'[data-action="save"]');await click(p,'[data-store-slot="1"]');await click(p,'[data-action="close-modal"]');
   await p.reload();await click(p,'[data-action="continue"]');assert.equal(await p.locator('#branch-input').inputValue(),'魏军还没攻营，我去请伯约来听报。');
   modelFail=true;await click(p,'[data-branch-form] button[type="submit"]');await p.waitForFunction(()=>document.querySelector('#branch-status')?.textContent.includes('连接失败'));assert.equal(await p.locator('[data-node="C01-AI-JOINT"]').count(),1);modelFail=false;
  }
  plan=name==='coop'?'invite_jiang':name==='formal'?'relay_jiang':'self_relay';
  await p.locator('#branch-input').fill(`魏军还没攻营，${plan==='invite_jiang'?'我去请伯约来听报':plan==='relay_jiang'?'我拿去请伯约看报':'我来转呈军报'}。`);
  await click(p,'[data-branch-form] button[type="submit"]');await p.waitForFunction(()=>document.querySelector('.dialogue-advance, [data-cinema-action=skip]'));await settle(p);


  assert.equal(await p.locator('.branch-scene').getAttribute('data-ending'),outcome);
  if(name==='death'){
   const unlocked=await p.evaluate(()=>JSON.parse(localStorage.getItem('wuzhang-chapter-endings-v2')).unlocked);
   assert.ok(unlocked['tutorial-sacrifice']);
   assert.equal(unlocked['branch-dismissed'],undefined);
   await choose(p,'rewind');assert.equal(await p.locator('.branch-scene').getAttribute('data-node'),'C01-GUARD-2');
  }
  else {await choose(p,'continue');if(name==='formal'){assert.equal(await p.locator('[data-choice="next"]').count(),0);await choose(p,'stop');await p.locator('.chapter-map').waitFor();checks.push('next-chapter-respects-current-release-lock');}else{await choose(p,'stop');assert.ok(await p.locator('.chapter-map').count());assert.equal(await p.locator('[data-map-node="grain"]').getAttribute('class'),'map-chapter locked');}}
  checks.push(name);await ctx.close();
 }
 for(const mode of ['unclear','anger']){
  scenario=mode;const {ctx,p}=await fixture();await toAi(p);
  for(let i=0;i<(mode==='unclear'?4:1);i++){
   await p.locator('#branch-input').fill(mode==='anger'?'我要投敌，替魏军打开营门。':'将军再等等。');
   await click(p,'[data-branch-form] button[type="submit"]');await p.waitForFunction(()=>document.querySelector('.dialogue-advance, [data-cinema-action=skip]'));await settle(p);
   if(mode==='unclear'&&i<3){assert.equal(await p.locator('[data-node="C01-AI-JOINT"]').count(),1);assert.equal(await p.locator('[data-branch="retry"]').count(),0);}
  }
  assert.equal(await p.locator('.branch-scene').getAttribute('data-ending'),mode==='anger'?'E-ANGER':'E-LAMP');checks.push(mode);await ctx.close();
 }
 for(const name of ['C1END-EXEC-foley-20261029.mp4','CH01-guard-to-dawn-accountability-1.2x-20261119.mp4']){const r=await fetch(origin+'/video/current/'+name,{headers:{Range:'bytes=0-99'}});assert.ok(r.ok);assert.match(r.headers.get('content-type'),/video/);await r.arrayBuffer();}
 const {ctx,p}=await fixture(true);await settle(p);for(const id of ['rules','meet','order','listen'])await choose(p,id);assert.equal(await p.locator('.branch-scene').getAttribute('data-ending'),'E-LAMP');checks.push('offense-lamp');await ctx.close();
 assert.ok(!media.some(url=>/CH01-(J02|F02)-h3-v6-/.test(url)), 'held clips must not play');
 assert.deepEqual(ttsRequests,[]);assert.deepEqual(errors,[]);
 assert.ok(media.length>0);
 for(const url of media)assert.ok(allowedMedia.has(new URL(url).pathname),url);
 writeFileSync(resolve(out,'browser-verification.json'),JSON.stringify({passed:true,checks,errors,expectedFilmsOnly:true,controlledModel:true},null,2));console.log('新第一章正式游戏浏览器检查通过',checks);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
