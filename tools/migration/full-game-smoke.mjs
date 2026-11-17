import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdirSync,writeFileSync,existsSync,readFileSync } from 'node:fs';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const relayFirst=process.env.CH1_RELAY_FIRST==='1';
const output=resolve(process.env.SMOKE_OUTPUT ?? (relayFirst?'outputs/ch1-relay-first-20261023':'outputs/ch1-six-clues-20261025/browser'));mkdirSync(output,{recursive:true});
const draft=process.env.NARRATIVE_DRAFT ? resolve(process.env.NARRATIVE_DRAFT) : '';
const server=createStaticServer({root:resolve(process.argv[2] ?? 'GameStarter/web-demo/.build'), onRequest: draft ? (req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const local=path==='/' ? resolve(draft,'GameStarter/web-demo/public/index.html') : path==='/narrative.css' ? resolve(draft,'GameStarter/web-demo/public/narrative.css') : path.endsWith('.js')&&path.startsWith('/GameStarter/') ? resolve(draft,'GameStarter/web-demo/.build',path.slice(1)) : '';
 if(!local)return false;
 if(!existsSync(local)){res.writeHead(404);res.end();return true;}
 res.setHeader('Content-Type',path==='/'?'text/html; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');res.end(readFileSync(local));return true;
}:undefined});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});
await page.addInitScript(()=>{localStorage.setItem('wuzhang-runtime-mode-v1','ai');localStorage.setItem('wuzhang-reduced-motion','1');localStorage.setItem('wuzhang-voice-muted','1');});
await page.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.origin===base)return route.continue();
 if(url.hostname==='127.0.0.1'&&url.pathname==='/health')return route.fulfill({headers:{'Access-Control-Allow-Origin':base},json:{configured:true}});
 return route.abort();
});
const key='wuzhang-chapter-session-v1';const state=()=>page.evaluate(key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}},key);
const click=async action=>{
 if(action==='next'&&await page.locator('[data-story-film]').count()){
  const confirm=page.locator('[data-film-confirm]');
  if(await confirm.isVisible())return confirm.click();
  return page.locator('[data-cinema-action=skip]').click();
 }
 if(action==='reply'){
  await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1'));return s?.speech?.status==='ready'||['reply','dialogue'].includes(s?.phase);});
  if((await state()).phase!=='spoken')return;
 }
 const current=await state();
 const sceneAction=(action==='next'&&current?.phase==='dialogue')||(action==='revise'&&current?.phase==='reply')||(action==='reply'&&current?.phase==='spoken');
 if(sceneAction){
  if(action==='reply')await page.waitForFunction(()=>{const current=JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1'));return current?.phase==='spoken'&&current.speech?.status==='ready';});
  return page.locator('.game-scene').click({position:{x:24,y:(page.viewportSize()?.height??600)*.4}});
 }
 return page.locator(`[data-action="${action}"]:visible,[data-narrative-choice="${action}"]:visible`).first().click();
};
const errors=[],missing=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()===404)missing.push(r.url());});
const read=async()=>{let i=0;while((await state())?.phase==='dialogue'&&i++<160)await click('next');assert.ok(i<160);};
const act=async(id,scene)=>{if((await state()).scene!==scene)await page.locator(`[data-move="${scene}"]`).click();await page.locator(`[data-scene-action="${id}"]`).click();await read();};
const firstWords='营门尚未突破，眼下不必强闯。今夜帐内有禁令，不能进入。军情交给我，我现在替您转呈，绝不耽误。';
const secondWords='伯约亲口答应在帐外接报。往日敌军闻号即退，今夜不退，还随我军调动换向，可能在试探。请现在随我到帐外，当面交给伯约，不必入帐。';
let modelMode='clarify';
try{
 // Mock the current classifier/reply contract. Player wording still goes through the real adapter.
 await page.route('**/api/game/respond',async route=>{
  const headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  if(modelMode==='failure'){await route.fulfill({status:503,headers,json:{error:'isolated full-game test'}});return;}
  const request=route.request().postDataJSON(),source=JSON.parse(request.text.slice(request.text.lastIndexOf('\n资料：')+4));
  const result=request.temperature===0?{fatal:{type:'none',quote:''},checks:Object.fromEntries(source.checks.map(check=>[check.id,modelMode==='clarify'?'':source.current])),unsupported:''}:{reply:source.intent};
  if(modelMode==='delay')await new Promise(ok=>setTimeout(ok,300));
  try{await route.fulfill({status:200,headers,json:{text:JSON.stringify(result)}});}catch{}
 });
 await page.goto(base);await page.locator('.game-menu').waitFor();await page.screenshot({path:resolve(output,'01-menu.png')});
 await click('new');await click('new-confirmed');await page.locator('video').waitFor();assert.ok((await page.locator('video').getAttribute('src')).includes('PR01'));await page.locator('[data-cinema-action=skip]').click();await read();
 assert.equal((await state()).phase,'explore');await page.screenshot({path:resolve(output,'02-camp.png')});
 await act('read-notice','camp_gate');await act('meet-first-scout','report_post');await page.locator('[data-scout-choice=a]').click();await read();
 await page.locator('[data-scene-action=intercept-first]').click();await page.waitForFunction(()=>Array.from(document.querySelectorAll('.portrait-stage img')).every(i=>i.complete&&i.naturalWidth));await page.screenshot({path:resolve(output,'03-weiyan-dialogue.png')});await read();
 assert.equal(await page.locator('[data-action=suggestion],[data-action=transfer-focus],[data-action=read-evidence]').count(),0);
 await page.locator('#player-expression').fill('将军，可否等到明日再报？');await click('speak');await click('reply');assert.equal((await state()).phase,'reply');await click('revise');modelMode='accept';await page.locator('#player-expression').fill(firstWords);await click('speak');await click('reply');await read();
 await act('deliver-first','camp_gate');await act('stand-watch','camp_gate');await page.locator('[data-cinema-action=skip]').click();await read();
 assert.equal((await state()).phase,'death');await page.screenshot({path:resolve(output,'04-first-death.png')});checks.push('Default new game: actual opening video, navigable camp, first report, canonical death');
 await click('rewind');await read();
 assert.equal(await page.locator('.scene-heading').count(),0);
 const interviews=relayFirst?[['ask-relay','jiangwei_tent_front'],['ask-guard','camp_gate']]:[['ask-guard','camp_gate'],['ask-relay','jiangwei_tent_front']];
 for(const [id,scene] of interviews){await page.locator(`[data-move="${scene}"]`).click();assert.equal(await page.locator(`[data-scene-action="${id}"]`).count(),1);}
 await page.locator('[data-move="report_post"]').click();assert.equal(await page.locator('[data-scene-action="ask-scout"]').count(),0);
 await act(...interviews[0]);assert.ok(!(await state()).story.collected.includes(relayFirst?'C06':'C02'));
 await page.reload();await click('continue');assert.equal((await state()).phase,'explore');
 await page.locator('[data-move="report_post"]').click();assert.equal(await page.locator('[data-scene-action="ask-scout"]').count(),0);
 await act(...interviews[1]);await act('ask-scout','report_post');
 assert.equal((await state()).phase,'thought-prompt');
 assert.equal(await page.locator('.thought-inventory,.reasoning-timeline,.phone-panel,[data-action=notes],[data-action=supplies]').count(),0);
 await page.screenshot({path:resolve(output,'05-story-choice.png')});
 assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED,undefined);
 await click('save');await page.locator('[data-store-slot="1"]').click();await click('close-modal');
 await click('return-to-story');assert.equal((await state()).phase,'explore');
 await click('save');await page.locator('[data-load-slot="1"]').click();
 assert.equal((await state()).phase,'thought-prompt');
 await click('continue-story');await read();
 assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED,true);assert.equal((await state()).story.flags.COMPANION_PRESENT,true);
 checks.push('Both interviews and factual guards retained; narrative choice replaces canvas; manual save/load restores the decision without fabricated authority');
 await act('intercept-weiyan','report_post');assert.equal((await state()).phase,'expression');
 await page.locator('#player-expression').fill(secondWords);await page.screenshot({path:resolve(output,'07-expression.png')});assert.ok(await page.locator('#player-expression').inputValue());
 const edgeCount=(await state()).story.edges.length;
 modelMode='delay';
 await page.locator('#player-expression').fill('我想用自己的话说明，先请将军听我说。');await click('speak');await click('cancel-speech');assert.equal((await state()).speech.status,'cancelled');assert.equal((await state()).story.flags.PERSUADED,undefined);await click('revise');
 modelMode='failure';
 await click('speak');await page.locator('[data-action=revise]').waitFor();assert.equal((await state()).speech.status,'failed');assert.equal((await state()).story.edges.length,edgeCount);assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED,true);await click('revise');modelMode='accept';await page.locator('#player-expression').fill(secondWords);checks.push('Cancelling or failing a mocked free-expression request preserves the full game, draft and actual authorization');
 await click('speak');await page.waitForFunction(key=>{const s=JSON.parse(localStorage.getItem(key));return s.phase==='dialogue'&&s.story.flags.PERSUADED===true;},key);assert.equal((await state()).story.flags.REPORT_CLOSED,undefined);await page.screenshot({path:resolve(output,'08-accepted-reply.png')});
 await page.reload();await click('continue');assert.equal((await state()).phase,'dialogue');assert.equal((await state()).story.flags.REPORT_CLOSED,undefined);
 while((await state()).story.current!=='E03')await click('next');
 assert.equal((await state()).story.flags.FORMAL_REPORT_RECEIVED,undefined);
 if(await page.locator('[data-story-film]').count()){
  await page.locator('[data-cinema-action=skip]').click();
  assert.equal((await state()).story.flags.FORMAL_REPORT_RECEIVED,true);
 } else {
  while((await state()).story.current!=='E04C')await click('next');
  assert.equal((await state()).story.flags.FORMAL_REPORT_RECEIVED,undefined);await click('next');
 }
 assert.equal((await state()).story.flags.FORMAL_REPORT_RECEIVED,true);
 while((await state()).story.current!=='E09')await click('next');
 assert.equal((await state()).story.flags.REPORT_CLOSED,undefined);
 if(await page.locator('[data-story-film]').count()){
  // Natural completion commits only this fixed reply, without an extra confirmation.
  await page.locator('[data-story-film] video').evaluate(video=>video.dispatchEvent(new Event('ended')));
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1')).story.flags.REPORT_CLOSED===true);
  assert.equal(await page.locator('.story-film-confirm:not([hidden])').count(),0);
  await page.reload();await click('continue');
  assert.equal((await state()).story.flags.REPORT_CLOSED,true);
 } else {
  while(!(await state()).story.flags.REPORT_CLOSED)await click('next');
 }
 await page.screenshot({path:resolve(output,'09-returned-order.png')});assert.equal((await state()).story.flags.REPORT_CLOSED,true);await read();
 while((await state()).phase==='cinematic'){await page.locator('[data-cinema-action=skip]').click();await read();}
 assert.equal((await state()).phase,'ending');await page.screenshot({path:resolve(output,'10-ending.png')});checks.push('Real firsthand authorization, companion, P2, confirmed speech reload, complete report and order, two ending movies');
 await click('map');await page.locator('[data-chapter-onward]').waitFor();assert.match(await page.locator('.chapter-onward-copy').innerText(),/祁山/);await page.locator('[data-chapter-onward]').click();await page.locator('#game-root[data-node=V01] video').waitFor();await page.goto(base+'/?view=chapters');await click('achievements');assert.ok(await page.locator('.ending-album').isVisible());await page.locator('[data-album-action=close]').click();await page.screenshot({path:resolve(output,'11-map.png')});checks.push('Actual endings, current achievement collection and campaign map');
 await page.setViewportSize({width:768,height:900});await click('menu');await click('settings');assert.ok(await page.locator('[role=dialog]').isVisible());await page.screenshot({path:resolve(output,'12-settings-tablet.png')});await click('close-modal');
 await click('continue');await click('menu');await click('continue');assert.equal((await state()).phase,'map');checks.push('Tablet settings dialog; menu continue retains the complete session');
 await click('menu');const validRaw=await page.evaluate(key=>localStorage.getItem(key),key);await page.evaluate(key=>localStorage.setItem(key,'invalid-test-save'),key);await click('continue');assert.match(await page.locator('.menu-warning').innerText(),/不兼容/);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'invalid-test-save');await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:validRaw});checks.push('Invalid saved progress produces a visible compatibility message and preserves the original record');
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);writeFileSync(resolve(output,'checks.json'),JSON.stringify({passed:true,checks,errors,missing},null,2));console.log(JSON.stringify({passed:true,checks,errors,missing},null,2));
}catch(error){await page.screenshot({path:resolve(output,'failure.png')});writeFileSync(resolve(output,'checks.json'),JSON.stringify({passed:false,checks,errors,missing,error:error.message},null,2));console.error('STATE',JSON.stringify(await state()));throw error;}
finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
