import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const story=JSON.parse(readFileSync('content/chapters/jingzhou/chapter-five.reports.json','utf8'));
const out=resolve('outputs/chapter-five-story-20261028');mkdirSync(out,{recursive:true});
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin=`http://127.0.0.1:${server.address().port}`, key='jingzhou-chapter-five-v1:playtest:reports';
const browser=await chromium.launch({channel:'chrome',headless:true}), errors=[], checks=[];
try {
 const c=await browser.newContext({viewport:{width:1440,height:900}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+'/?chapter=jingzhou&playtest=reports');await p.locator('#spoken-line').waitFor();
 const saved=()=>p.evaluate(key=>localStorage.getItem(key),key);
 const before=await saved();await p.locator('[data-jz=rules]').click();await p.keyboard.press(' ');await p.keyboard.press('Escape');assert.equal(await saved(),before);
 await p.mouse.click(400,250);assert.equal(await p.locator('#game-root').getAttribute('data-story-page'),'1');
 await p.reload();await p.locator('#spoken-line').waitFor();assert.equal(await p.locator('#game-root').getAttribute('data-story-page'),'1');
 for(const [width,height] of [[1440,900],[844,390],[667,375],[390,844]]) {
  await p.setViewportSize({width,height});
  const m=await p.locator('#spoken-line').evaluate(el=>({font:getComputedStyle(el).fontSize,line:getComputedStyle(el).lineHeight,speaker:getComputedStyle(document.querySelector('.dialogue-speaker')).fontSize,overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.deepEqual(m,{font:'24px',line:'43.2px',speaker:'22px',overflow:false});
  await p.screenshot({path:resolve(out,`guanyu-opening-${width}x${height}.png`)});
 }
 await p.setViewportSize({width:667,height:375});await p.locator('.dialogue-advance').focus();await p.keyboard.press(' ');
 assert.equal(await p.locator('#game-root').getAttribute('data-story-page'),'2');
 while(await p.locator('[data-jz=story-next]').count())await p.locator('[data-jz=story-next]').click();
 await p.locator('[data-jz=begin]').click();
 let i=0;
 while(await p.locator('.jz-workspace').count()){
  const id=await p.locator('#game-root').getAttribute('data-active-report'),r=story.reports.find(r=>r.id===id);
  const verdict=(i++<3?r.truth:!r.truth)?'true':'false';
  await p.locator(`[data-jz=judge][data-verdict=${verdict}]`).click();await p.locator('[data-jz=confirm]').click();
 }
 assert.match(await p.locator('.jz-score-line').innerText(),/判断正确 3 条/);
 await p.locator('[data-jz=story-next]').click();
 for(const button of await p.locator('[data-jz=story-reply]').all()){
  assert.equal(await button.evaluate(el=>getComputedStyle(el).fontSize),'20px');await button.scrollIntoViewIfNeeded();
  const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=667&&box.y>=0&&box.y+box.height<=375);
 }
 await p.screenshot({path:resolve(out,'guanyu-choice-667x375.png')});
 await p.locator('[data-reply=people]').click();const replySave=await saved();await p.reload();await p.locator('#spoken-line').waitFor();assert.equal(await saved(),replySave);assert.match(await p.locator('#spoken-line').innerText(),/扶着伤员/);
 for(let n=0;n<3;n++)await p.locator('[data-jz=story-next]').click();
 await p.locator('[data-phase=ending]').waitFor();assert.equal(await p.locator('[data-phase=ending]').getAttribute('data-ending'),'costly');assert.match(await p.locator('.ending-copy').innerText(),/郁郁而终/);
 await p.screenshot({path:resolve(out,'costly-ending-667x375.png')});
 const onward=p.locator('.ending-primary');await onward.scrollIntoViewIfNeeded();
 const onwardBox=await onward.boundingBox();assert.ok(onwardBox.y>=0&&onwardBox.y+onwardBox.height<=375,'ending navigation remains reachable on short screens');
 assert.equal(await p.evaluate(()=>localStorage.getItem('jingzhou-chapter-five-v1')),null);
 checks.push('tap and keyboard advance; modal controls never advance; intro and reply restore exactly','first-three-chapter 24px dialogue, 22px speaker and 20px choices at desktop and mobile sizes','three-correct path reaches costly return with one interaction, isolated from formal saves');
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'story-verification.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({passed:true,checks,errors}));await c.close();
} finally {await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
