import { withAuditReceipts } from '../../GameStarter/tests/expression-audit-fixture.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { dialogueFixtures } from '../ai/dialogue-fixtures.mjs';

const f=await dialogueFixtures('GameStarter/web-demo/.build');
const saveKey='wuzhang-chapter-session-v1',filmKey='wuzhang-session-films-v1';
const movies=JSON.parse(readFileSync('GameStarter/web-demo/public/cinematics.json','utf8'));
const film=movies.chapterDialogue.find(film=>film.rows.includes('A-37'));
const s=new f.ChapterSession(f.content,f.flow,f.version);
s.finishCinematic();f.read(s);f.act(s,'read-notice');f.act(s,'meet-first-scout');s.chooseScout('a');f.read(s);
const action=f.flow.actions.find(a=>a.id==='intercept-first');s.move(action.scene);assert.ok(s.act(action.id));
const checkpoint=s.snapshot();
const key=`story:${checkpoint.story.run}:${checkpoint.round}:${checkpoint.section}:${film.id}`;
const output=resolve(process.env.WEIYAN_POLISH_REPORT??'outputs/weiyan-entry-polish-20261025');mkdirSync(output,{recursive:true});
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],cases=[];
async function pageFor(save,mode='offline',completed=false){
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await context.addInitScript(({save,saveKey,filmKey,mode,completed,version,key})=>{
  if(localStorage.getItem(saveKey))return;
  localStorage.setItem(saveKey,JSON.stringify(save));localStorage.setItem('wuzhang-runtime-mode-v1',mode);localStorage.setItem('wuzhang-reduced-motion','1');
  if(completed)localStorage.setItem(filmKey,JSON.stringify({version,completed:[key],active:null}));
 },{save,saveKey,filmKey,mode,completed,version:`${f.version}:${JSON.stringify(movies)}`,key});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.game-menu [data-action=continue]').click();return page;
}
try{
 for(const mode of ['ended','skip','restored']){
  const page=await pageFor(checkpoint,'offline',mode==='restored');
  const phase=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).phase,saveKey);
  if(mode!=='restored'){
   await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
   await page.mouse.click(700,400);assert.equal(await phase(),'dialogue','A click during playback must not skip');
   if(mode==='skip')await page.locator('[data-cinema-action=skip]').click();
   else await page.locator('video').evaluate(video=>{video.muted=true;video.currentTime=video.duration-.12;return video.play();});
  }
  await page.locator('.story-film-confirm:not([hidden])').waitFor();
  assert.match(await page.locator('[data-film-confirm]').innerText(),/组织回应/);
  await page.mouse.move(500,350);await page.mouse.down();await page.mouse.move(650,400,{steps:5});await page.mouse.up();assert.equal(await phase(),'dialogue');
  await page.screenshot({path:resolve(output,`ready-${mode}.png`)});
  if(mode==='ended')await page.mouse.dblclick(700,400);
  else if(mode==='skip')await page.mouse.click(700,400);
  else {await page.locator('[data-story-film]').evaluate(el=>{el.tabIndex=-1;el.focus();});await page.keyboard.press('Space');}
  await page.locator('#player-expression').waitFor();assert.equal(await phase(),'expression');assert.equal(await page.locator('#player-expression').inputValue(),'');
  cases.push({mode,clickToExpression:true,dragIgnored:true});await page.context().close();
 }
 const expr=f.first();for(const id of [...expr.snapshot().story.selected])expr.selectEvidence(id);for(const id of ['C06','C05'])expr.selectEvidence(id);expr.setFocus('我来帮你转达');
 const page=await pageFor(expr.snapshot(),'ai');const responses=[];
 page.on('response',async response=>{if(response.url().endsWith('/api/game/respond'))responses.push({status:response.status(),...(await response.json())});});
 assert.equal(await page.locator('[data-action=generate-expression]').innerText(),'润色表达');
 await page.locator('[data-action=generate-expression]').click();
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).composition.status==='ready',saveKey,{timeout:90000});
 const result=await page.locator('#player-expression').inputValue();
 assert.notEqual(result.replace(/[\p{P}\s]/gu,''),'我来帮你转达');assert.match(result,/转达/);assert.match(await page.locator('.expression-status').innerText(),/润色完成/);
 assert.equal(responses.length,1);assert.ok(responses.every(r=>r.status===200));
 await page.screenshot({path:resolve(output,'live-polish.png')});
 writeFileSync(resolve(output,'live-browser.json'),JSON.stringify({input:'我来帮你转达',selected:['C06','C05'],result,responses},null,2));
 // No-op wording is only valid when the player has not selected any facts to compose.
 while(await page.locator('.speech-evidence [data-use]').count())await page.locator('.speech-evidence [data-use]').first().click();
 let call=0;
 await page.route('http://127.0.0.1:8787/api/game/respond',async route=>{
  const text=++call%2?{status:'ok',text:'我来帮你转达。',evidenceIds:[],itemLinks:[]}:{checks:{intent:true,actors:true,facts:true,items:true,coverage:true},supported:true,reason:'原意相同'};
  const audited=await withAuditReceipts({respond:async()=>({text:JSON.stringify(text)})}).respond({text:route.request().postDataJSON().text});
  return route.fulfill({json:{text:audited.text,responseId:'fixture'},headers:{'Access-Control-Allow-Origin':'*'}});
 });
 await page.locator('[data-action=generate-expression]').click();await page.getByText('已保留原句，可以编辑后说出。',{exact:true}).waitFor();
 const retained=await page.locator('#player-expression').inputValue();
 await page.unroute('http://127.0.0.1:8787/api/game/respond');
 await page.route('http://127.0.0.1:8787/api/game/respond',route=>route.fulfill({status:503,json:{error:'fixture unavailable'},headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.locator('[data-action=generate-expression]').click();await page.getByRole('button',{name:'重新润色',exact:true}).waitFor();
 assert.equal(await page.locator('#player-expression').inputValue(),retained);assert.match(await page.locator('.expression-status').innerText(),/暂时未完成.*上一版文字/);
 cases.push({liveApi:true,writerOnly:responses.slice(0,1).map(r=>r.status),polished:result,noChangeFeedback:true,failurePreservesDraft:true});
 await page.context().close();assert.deepEqual(errors,[]);
 writeFileSync(resolve(output,'verification.json'),JSON.stringify({passed:true,cases,errors},null,2));
 console.log(JSON.stringify({passed:true,cases}));
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
