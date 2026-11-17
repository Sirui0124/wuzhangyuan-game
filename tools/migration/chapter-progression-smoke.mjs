import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
const build=resolve(process.env.GAME_BUILD||'GameStarter/web-demo/.build');
const {JietingSession}=await import(pathToFileURL(resolve(build,'GameStarter/web-demo/src/chapters/chapter-three/session.js')));
const story=JSON.parse(readFileSync(resolve(build,'story/chapter-three.story.json')));
const oldThird=new JietingSession(story,undefined,{aiEnabled:false}).state;
const out=resolve('outputs/chapter-restart-20261028');mkdirSync(out,{recursive:true});
const server=createStaticServer({root:build});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true}),base=`http://127.0.0.1:${server.address().port}`;
const errors=[],checks=[];
async function context(seed={}){
 const c=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await c.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:false}}));
 await c.addInitScript(seed=>{if(!sessionStorage.getItem('sequence-test-seeded')){for(const [key,value]of Object.entries(seed))localStorage.setItem(key,value);sessionStorage.setItem('sequence-test-seeded','1');}localStorage.setItem('wuzhang-runtime-mode-v1','offline');},seed);
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return{c,p};
}
try{
 const {c,p}=await context();await p.goto(base+'/?view=chapters');await p.locator('.chapter-map').waitFor();
 for(const id of ['grain','jieting','jingzhou']){assert.ok(await p.locator(`[data-map-node=${id}]`).evaluate(e=>e.classList.contains('locked')));assert.equal(await p.locator(`[data-map-node=${id}] a`).count(),0);}
 assert.equal(await p.locator('[data-map-node=yiling] a').count(),1);
 assert.equal(await p.locator('[data-map-node=yiling] .map-early-access').innerText(),'抢先体验');
 await p.screenshot({path:resolve(out,'fresh-player.png')});
 for(const path of ['/?chapter=grain','/?chapter=jieting','/?chapter=masu','/?chapter=grain&playtest=open1','/chapter-two.html']){
  await p.goto(base+path);await p.locator('.chapter-map').waitFor();assert.equal(new URL(p.url()).searchParams.get('view'),'chapters');assert.equal(await p.locator('video').count(),0);assert.match(await p.locator('[role=status].map-access-notice').innerText(),/先通关/);
 }
 checks.push('fresh map and all direct/alias/legacy/playtest entries are locked');await c.close();
 const legacy=await context({'jieting-chapter-three-v1:slot:1':JSON.stringify(oldThird)});
 await legacy.p.goto(base+'/?view=chapters');await legacy.p.locator('.chapter-map').waitFor();
 for(const id of ['wuzhang','grain'])assert.match(await legacy.p.locator(`[data-map-node=${id}] .map-chapter-action`).innerText(),/重玩这一章/);
 assert.equal(await legacy.p.locator('[data-map-node=jieting] a').count(),1);assert.equal(await legacy.p.locator('[data-map-node=yiling] a').count(),1);
 await legacy.p.screenshot({path:resolve(out,'legacy-third-chapter.png')});
 await legacy.p.locator('[data-map-node=grain] a').click();await legacy.p.locator('#game-root[data-node=V01] video').waitFor();
 await legacy.p.goto(base+'/?view=chapters');await legacy.p.locator('.chapter-map').waitFor();
 assert.equal(await legacy.p.locator('[data-map-node=jieting] a').count(),1);assert.equal(await legacy.p.locator('[data-map-node=yiling] a').count(),1);
 checks.push('legacy manual save restores predecessor replay and keeps access through earlier chapter restart');await legacy.c.close();
 const completed=await context({'wuzhang-chapter-endings-v2':JSON.stringify({schemaVersion:1,unlocked:{safe:{firstUnlockedAt:'2026-10-27',lastLoopId:'history',times:1}}})});
 await completed.p.goto(base+'/?view=chapters');await completed.p.locator('.chapter-map').waitFor();assert.equal(await completed.p.locator('[data-map-node=grain] a').count(),1);assert.equal(await completed.p.locator('[data-map-node=jieting] a').count(),0);
 await completed.p.locator('[data-map-node=grain] a').click();await completed.p.locator('#game-root[data-node=V01] video').waitFor();
 await completed.p.goto(base+'/?chapter=jieting');await completed.p.locator('.chapter-map').waitFor();assert.equal(await completed.p.locator('[data-map-node=jieting] a').count(),0);
 checks.push('real first-chapter completion opens second, entering second does not open third');await completed.c.close();
 const reset=await context({
  'jieting-chapter-three-v1':JSON.stringify(oldThird),
  'jieting-chapter-three-v1:slot:1':JSON.stringify(oldThird),
  'grain-chapter-two-completed-v1':'true',
  'wuzhang-chapter-endings-v2':JSON.stringify({schemaVersion:1,unlocked:{safe:{firstUnlockedAt:'2026-10-27',times:1}}})
 });
 await reset.p.goto(base+'/?view=chapters');await reset.p.locator('.chapter-map').waitFor();
 assert.equal(await reset.p.locator('[data-map-node=jieting] a').count(),1);
 // Replaying the first chapter from the map must not start a new campaign.
 await reset.p.locator('[data-map-node=wuzhang] [data-action=replay-first]').click();
 await reset.p.goto(base+'/?view=chapters');await reset.p.locator('.chapter-map').waitFor();
 assert.equal(await reset.p.locator('[data-map-node=jieting] a').count(),1);
 await reset.p.locator('[data-action=menu]').click();await reset.p.locator('[data-action=new]').click();
 await reset.p.locator('[data-action=new-confirmed]').waitFor();
 assert.match(await reset.p.locator('.newgame-confirmation').innerText(),/后续章节需要再次逐章通关解锁/);
 await reset.p.locator('[data-action=new-confirmed]').click();
 await reset.p.waitForFunction(()=>JSON.parse(localStorage.getItem('wuzhang-chapter-history-v1'))?.freshStart===true);
 await reset.p.goto(base+'/?view=chapters');await reset.p.locator('.chapter-map').waitFor();
 assert.doesNotMatch(await reset.p.locator('[data-map-node=wuzhang]').innerText(),/已通关/);
 for(const id of ['grain','jieting','jingzhou'])assert.equal(await reset.p.locator(`[data-map-node=${id}] a`).count(),0);
 assert.equal(await reset.p.locator('[data-map-node=yiling] .map-early-access').innerText(),'抢先体验');
 const retained=await reset.p.evaluate(()=>({slot:localStorage.getItem('jieting-chapter-three-v1:slot:1'),auto:localStorage.getItem('jieting-chapter-three-v1'),backup:JSON.parse(localStorage.getItem('wuzhang-chapter-history-v1:before-new')),achievement:localStorage.getItem('wuzhang-chapter-endings-v2')}));
 assert.equal(retained.slot,JSON.stringify(oldThird));assert.equal(retained.auto,null);assert.equal(retained.backup['jieting-chapter-three-v1'],JSON.stringify(oldThird));assert.ok(retained.achievement);
 await reset.p.reload();await reset.p.locator('.chapter-map').waitFor();
 await reset.p.screenshot({path:resolve(out,'new-game-locked.png')});
 for(const path of ['/?chapter=grain','/?chapter=jieting','/?chapter=masu','/?chapter=jingzhou','/?chapter=jieting&restart=1','/chapter-two.html']){
  await reset.p.goto(base+path);await reset.p.locator('.chapter-map').waitFor();assert.equal(new URL(reset.p.url()).searchParams.get('view'),'chapters');
 }
 await reset.p.evaluate(async()=>{const m=await import('/GameStarter/web-demo/src/chapters/progression.js');m.recordChapterHistory('wuzhang',true);});
 await reset.p.goto(base+'/?view=chapters');await reset.p.locator('.chapter-map').waitFor();
 assert.equal(await reset.p.locator('[data-map-node=grain] a').count(),1);assert.equal(await reset.p.locator('[data-map-node=jieting] a').count(),0);
 await reset.p.locator('[data-map-node=grain] a').click();await reset.p.locator('#game-root[data-node=V01] video').waitFor();
 checks.push('new game re-locks all later chapters across refresh and direct links; archives remain; first completion reopens only chapter two at its beginning');await reset.c.close();

 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'browser-verification.json'),JSON.stringify({passed:true,build,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
