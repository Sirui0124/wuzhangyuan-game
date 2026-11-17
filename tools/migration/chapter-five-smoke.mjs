import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const build=resolve(process.env.GAME_BUILD||'GameStarter/web-demo/.build');
const story=JSON.parse(readFileSync(resolve(build,'story/chapter-five.reports.json'),'utf8'));
const out=resolve('outputs/chapter-five-story-20261028');mkdirSync(out,{recursive:true});
const server=createStaticServer({root:build});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const origin=`http://127.0.0.1:${server.address().port}`,key='jingzhou-chapter-five-v1',errors=[],checks=[];
async function context(seed=true,viewport={width:1440,height:900}){
 const c=await browser.newContext({viewport,reducedMotion:'reduce'});
 await c.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:true}}));
 if(seed)await c.addInitScript(()=>{if(!sessionStorage.getItem('jz-smoke-init')){localStorage.setItem('yiling-chapter-four-completed-v1','true');sessionStorage.setItem('jz-smoke-init','1');}});
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/api/game/respond',route=>{const data=JSON.parse(route.request().postDataJSON().text.split('资料：').at(-1));const r=story.reports.find(r=>r.name===data.soldier.name);const dimension=Object.keys(r.questions).find(d=>r.questions[d]===data.question);return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{text:JSON.stringify({kind:'answer',dimension})}});});return{c,p};
}
const active=async p=>p.locator('#game-root').getAttribute('data-active-report');
async function opening(p){await p.locator('#spoken-line').waitFor();while(await p.locator('[data-jz=story-next]').count())await p.locator('[data-jz=story-next]').click();}
async function closing(p,reply='people'){await p.locator('[data-jz=story-next]').click();await p.locator(`[data-jz=story-reply][data-reply=${reply}]`).click();for(let i=0;i<3;i++)await p.locator('[data-jz=story-next]').click();await p.locator('[data-phase=ending]').waitFor();}
async function ask(p,d){const id=await active(p);await p.locator('#jz-inquiry').fill(story.reports.find(r=>r.id===id).questions[d]);await p.locator('[data-jz=custom-ask]').click();await p.locator('[data-jz=cancel-inquiry]').waitFor({state:'hidden'});}

async function judge(p,id,verdict){await p.locator(`[data-jz=judge][data-id=${id}][data-verdict=${verdict}]`).click();await p.locator('[data-jz=confirm]').click();}
async function layout(p){return p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,dialogue:parseFloat(getComputedStyle(document.querySelector('.dialogue-text')).fontSize),buttons:[...document.querySelectorAll('[data-jz=judge]')].map(e=>({height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width}))}));}
try{
 for(const isolated of [true,false]){
  const migration=await context(!isolated),saveKey=isolated?key+':playtest:reports':key;
  const previous=JSON.stringify({schemaVersion:1,chapterId:'jingzhou',contentVersion:'jingzhou-reports-20261028-v1',seed:42,actions:[{type:'begin'}]});
  await migration.c.addInitScript(({saveKey,previous})=>{if(!sessionStorage.getItem('migration-init')){localStorage.setItem(saveKey,previous);sessionStorage.setItem('migration-init','1');}},{saveKey,previous});
  await migration.p.goto(origin+'/?chapter=jingzhou'+(isolated?'&playtest=reports':''));await migration.p.locator('#spoken-line').waitFor();
  assert.match(await migration.p.locator('.jz-story-notice').innerText(),/上一轮已备份/);
  const migrated=await migration.p.evaluate(saveKey=>({backup:localStorage.getItem(saveKey+':before-story-v2'),current:JSON.parse(localStorage.getItem(saveKey))}),saveKey);
  assert.equal(migrated.backup,previous);assert.equal(migrated.current.contentVersion,story.version);assert.deepEqual(migrated.current.actions,[]);
  await opening(migration.p);await migration.p.locator('[data-jz=begin]').click();await migration.p.reload();await migration.p.locator('.jz-workspace').waitFor();
  assert.equal(await migration.p.evaluate(saveKey=>localStorage.getItem(saveKey+':before-story-v2'),saveKey),previous);await migration.c.close();
 }
 checks.push('both formal and isolated v1 rounds are backed up intact; rewritten testimony starts fresh and v2 progress survives reload');
 const solo=await context(false);await solo.p.goto(origin+'/?chapter=jingzhou&playtest=reports');await opening(solo.p);await solo.p.locator('[data-jz=begin]').click();await ask(solo.p,'time');
 const soloSaved=await solo.p.evaluate(key=>({isolated:localStorage.getItem(key+':playtest:reports'),formal:localStorage.getItem(key),history:localStorage.getItem('wuzhang-chapter-history-v1')}),key);
 assert.ok(soloSaved.isolated);assert.equal(soloSaved.formal,null);assert.equal(soloSaved.history,null);
 await solo.p.reload();await solo.p.locator('.jz-workspace').waitFor();assert.equal(await solo.p.locator('.jz-question').count(),1);await solo.c.close();checks.push('standalone fifth chapter opens without prior chapters and preserves isolated questions without writing formal progress');
 const locked=await context(false);await locked.p.goto(origin+'/?chapter=jingzhou');await locked.p.locator('.chapter-map').waitFor();assert.equal(await locked.p.locator('[data-map-node=jingzhou] a').count(),0);await locked.c.close();checks.push('new-player fifth chapter remains locked');
 const {c,p}=await context();await p.goto(origin+'/?view=chapters');await p.locator('[data-map-node=jingzhou] a').waitFor();await p.locator('[data-map-node=jingzhou] a').click();await opening(p);
 await p.screenshot({path:resolve(out,'intro-desktop.png')});await p.locator('[data-jz=begin]').click();const a=await active(p);
 assert.match(await p.locator('[data-verdict=pending]').innerText(),/剩 2 个空位/);assert.equal(await p.locator('.jz-empty-slot').count(),0);
 const hidden=story.reports.find(r=>r.id===a).answers;
 for(const answer of Object.values(hidden))assert.equal((await p.locator('body').innerText()).includes(answer),false);
 await ask(p,'time');await p.screenshot({path:resolve(out,'interview-with-answer.png')});await judge(p,a,'pending');const b=await active(p);assert.match(await p.locator('[data-verdict=pending]').innerText(),/剩 1 个空位/);await judge(p,b,'pending');const current=await active(p);
 assert.match(await p.locator('[data-verdict=pending]').innerText(),/已满 · 0 个空位/);
 assert.equal(await p.locator('[data-jz=judge][data-verdict=pending]').isDisabled(),true);
 await p.locator(`[data-jz=view][data-id=${a}]`).first().click();
 for(const d of ['source','evidence'])await ask(p,d);
 assert.equal(await p.locator('[data-jz=suggest]:not(:disabled)').count(),0);
 await p.reload();await p.locator('.jz-workspace').waitFor();await p.locator(`[data-jz=view][data-id=${a}]`).first().click();assert.equal(await p.locator('[data-jz=suggest]:not(:disabled)').count(),0);
 await judge(p,a,story.reports.find(r=>r.id===a).truth?'true':'false');assert.equal(await active(p),current);assert.match(await p.locator('[data-verdict=pending]').innerText(),/剩 1 个空位/);
 await p.locator(`[data-jz=view][data-id=${b}]`).first().click();await judge(p,b,story.reports.find(r=>r.id===b).truth?'true':'false');
 await p.locator('[data-jz=rules]').click();await p.keyboard.press('Escape');assert.equal(await p.locator('.game-modal').count(),0);
 await p.locator('[data-jz=rules]').click();await p.locator('[data-action=close-modal]').click();assert.equal(await p.locator('.game-modal').count(),0);
 const metrics=[];
 for(const [width,height]of [[1440,900],[844,390],[667,375],[390,844]]){
  await p.setViewportSize({width,height});const measured=await layout(p);assert.equal(measured.overflow,false);assert.equal(measured.dialogue,24);assert.ok(measured.buttons.every(b=>b.height>=44));metrics.push({width,height,...measured});
  await p.screenshot({path:resolve(out,`interview-${width}x${height}.png`)});
 }
 await p.setViewportSize({width:1440,height:900});
 while(await p.locator('.jz-workspace').count()){
  const id=await active(p);await judge(p,id,story.reports.find(r=>r.id===id).truth?'true':'false');
 }
 assert.match(await p.locator('.jz-score-line').innerText(),/判断正确 6 条/);
 assert.equal(await p.locator('.jz-review,.jz-scores,[data-jz=select]').count(),0);
 await p.screenshot({path:resolve(out,'score-and-guanyu.png')});
 await closing(p);assert.match(await p.locator('[data-phase=ending]').innerText(),/郁郁而终/);
 const saved=await p.evaluate(key=>localStorage.getItem(key),key);await p.reload();await p.locator('[data-phase=ending]').waitFor();assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),saved);
 await p.screenshot({path:resolve(out,'result-desktop.png')});checks.push('pending budgets and irreversible verdicts persist; six judgments lead directly to Guanyu, a single score and the saved ending');
 await p.locator('[data-jz=restart]').first().click();await p.locator('[data-jz=cancel]').click();assert.equal(await p.locator('[data-phase=ending]').count(),1);
 await p.locator('[data-jz=restart]').first().click();await p.locator('[data-jz=restart-confirm]').click();await opening(p);await p.locator('[data-jz=begin]').click();
 while(await p.locator('.jz-workspace').count()){
  const id=await active(p);await judge(p,id,story.reports.find(r=>r.id===id).truth?'false':'true');
 }
 assert.match(await p.locator('.jz-score-line').innerText(),/判断正确 0 条/);
 await closing(p,'stay');assert.match(await p.locator('[data-phase=ending]').innerText(),/被俘身亡/);checks.push('restart backup and all-wrong branch complete without selection or a dead end');
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'browser-verification.json'),JSON.stringify({passed:true,checks,metrics,errors},null,2));console.log(JSON.stringify({passed:true,checks,metrics,errors}));await c.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
