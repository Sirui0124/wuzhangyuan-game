import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {createJietingPlaytest} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-three/session.js';
const out='outputs/achievements-20261027';mkdirSync(out,{recursive:true});
const story=JSON.parse(readFileSync('content/chapters/jieting/chapter-three.story.json'));
const fixture=createJietingPlaytest(story,'reinforcement',{aiEnabled:false}).state;
const server=createStaticServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('http://127.0.0.1:8787/**',r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:false}}));
 await context.addInitScript(save=>{if(!localStorage.getItem('jieting-chapter-three-v1'))localStorage.setItem('jieting-chapter-three-v1',JSON.stringify(save));localStorage.setItem('wuzhang-runtime-mode-v1','offline');},fixture);
 const base='http://127.0.0.1:'+server.address().port;await page.goto(base+'/?chapter=jieting');await page.locator('[data-node="JT-R1-FIXED"]').waitFor();
 const achievements=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('wuzhang-achievements-v1')??'{"unlocked":{}}'));
 const initial=await achievements();assert.ok(initial.unlocked['jieting-visits']);assert.ok(!initial.unlocked['jieting-water']);assert.ok(!initial.unlocked['jieting-ten-thousand']);
 const picks={'JT-R1-FIXED':'JT-O132','JT-R2-FIXED':'JT-O167','JT-R2-SAFE-FIXED':'r2-safe-great','JT-R3-FIXED':'JT-O198','JT-R4-FIXED':'r4-none','JT-R5-FIXED':'r5-none'};
 for(let i=0;i<160;i++){
  const unlocked=(await achievements()).unlocked;if(unlocked['jieting-water']&&unlocked['jieting-ten-thousand'])break;
  const id=await page.locator('#game-root').getAttribute('data-node');const options=page.locator('[data-option]');if(await options.count()){assert.ok(picks[id],id);await page.locator('[data-option="'+picks[id]+'"]').click();}else await page.locator('.dialogue-advance').click();
 }
 const earned=await achievements();assert.ok(earned.unlocked['jieting-water']);assert.ok(earned.unlocked['jieting-ten-thousand']);
 await page.reload();await page.locator('#game-root[data-chapter=jieting]').waitFor();assert.deepEqual(await achievements(),earned,'reload preserves counts');
 await page.goto(base+'/?view=chapters');await page.locator('[data-action=achievements]').click();await page.locator('.ending-album').waitFor();
 assert.equal(await page.locator('.album-card').count(),34);assert.match(await page.locator('.album-progress').innerText(),/34/);
 await page.locator('[data-album-action=chapter][data-album-id=grain]').click();assert.equal(await page.locator('.album-card').count(),11);
 await page.locator('[data-album-action=card][data-album-id=grain-letter]').click();assert.match(await page.locator('.album-story-page').innerText(),/确认并送出共同补报/);assert.deepEqual(await achievements(),earned,'inspecting locked card grants nothing');
 await page.screenshot({path:out+'/sealed-detail.png'});await page.locator('[data-album-action=overview]').click();
 await page.locator('[data-album-action=chapter][data-album-id=all]').click();await page.screenshot({path:out+'/catalog-desktop.png'});
 await page.locator('[data-album-action=filter][data-album-id=unlocked]').click();assert.equal(await page.locator('.album-card').count(),3);await page.screenshot({path:out+'/earned-cards.png'});
 await page.locator('[data-album-id=jieting-water][data-album-action=card]').click();assert.match(await page.locator('.album-story-page').innerText(),/护水有兵/);await page.screenshot({path:out+'/earned-detail.png'});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('.ending-album').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:out+'/detail-narrow.png'});
 await page.locator('[data-album-action=overview]').click();await page.locator('[data-album-action=filter][data-album-id=all]').click();await page.screenshot({path:out+'/catalog-narrow.png'});assert.ok(await page.locator('.ending-album').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 await page.keyboard.press('Escape');assert.equal(await page.locator('.ending-album').count(),0);assert.deepEqual(errors,[]);writeFileSync(out+'/browser-verification.json',JSON.stringify({passed:true,cards:34,actualArrivalUnlocks:true,previewDoesNotUnlock:true,reloadPreservesCounts:true,chapterFilter:true,desktopAndNarrow:true,errors},null,2));console.log('PASS: actual arrival unlocks, 34-card archive, chapter filters, sealed/unlocked details, no preview unlocks, reload and narrow layouts.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
