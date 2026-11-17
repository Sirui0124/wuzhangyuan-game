import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const build=resolve(process.env.GAME_BUILD ?? 'GameStarter/web-demo/.build');
const built=async path=>import(pathToFileURL(resolve(build,'GameStarter/web-demo/src',path)));
const { ChapterSession, GAME_SAVE_KEY }=await built('chapter-session.js');
const { GrainSession }=await built('chapters/chapter-two/session.js');
const { GRAIN_SAVE_KEY }=await built('chapters/chapter-two/navigation.js');
const { createJietingPlaytest }=await built('chapters/chapter-three/session.js');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const first = read(resolve(build,'playtest/weiyan-second.json'));
first.story.selected = [];
const one = new ChapterSession(read('content/chapters/wuzhang/chapter-one.script.json'), read('content/chapters/wuzhang/chapter-one.flow.json'), first.contentVersion); one.restore(JSON.stringify(first));
const two = new GrainSession(read('content/chapters/grain/chapter-two.films.json'), undefined, read('content/chapters/grain/chapter-two.films-rubric.json'), true);
for (let i=0;i<100 && two.current.kind!=='open';i++) assert.ok(two.advance(two.current.options?.[0]?.id));

const three=createJietingPlaytest(read(resolve(build,'story/chapter-three.story.json')),'reinforcement',{aiEnabled:true});
const output=resolve(process.env.MOBILE_OUTPUT ?? 'outputs/release-fixes-20261027/ui'); mkdirSync(output,{recursive:true});
// Diagnostic mode reads only source CSS and the standalone viewport helper.
// The default verifies the real unified build without overriding its files.
const sourceStyles=process.env.UI_SOURCE_STYLES==='1';
const server=createStaticServer({root:build,onRequest: sourceStyles ? async(req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 const file=resolve('GameStarter/web-demo/public',p==='/'?'index.html':'.'+p);
 if ((p==='/' || p.endsWith('.css')) && existsSync(file)) {res.writeHead(200,{'Content-Type':p==='/'?'text/html':'text/css'});res.end(readFileSync(file));return true;}
 if(p.endsWith('/src/game/mobile-viewport.js')) {res.writeHead(200,{'Content-Type':'text/javascript'});res.end(ts.transpileModule(readFileSync('GameStarter/web-demo/src/game/mobile-viewport.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);return true;}
 if(p.endsWith('/src/entry.js')) {res.writeHead(200,{'Content-Type':'text/javascript'});const built=readFileSync(resolve(build,'.'+p),'utf8');res.end((built.includes('observeMobileViewport')?'':"import {observeMobileViewport} from './game/mobile-viewport.js'; observeMobileViewport();\n")+built);return true;}
 return false;
}:undefined});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const browser=await chromium.launch({headless:true,channel:'chrome'}), errors=[], checks=[];
const fixtures=[[1,GAME_SAVE_KEY,one.serialize(),'/'],[2,GRAIN_SAVE_KEY,JSON.stringify(two.state),'/?chapter=grain'],[3,'jieting-chapter-three-v1',JSON.stringify(three.state),'/?chapter=jieting']];
try {
 for(const [chapter,key,save,url] of fixtures) for(const [width,height] of [[667,375],[844,390],[932,430]]) {
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',hasTouch:true});
  await context.route('http://127.0.0.1:8787/**',r=>r.fulfill({json:{configured:true},headers:{'Access-Control-Allow-Origin':'*'}}));
  await context.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,save);localStorage.setItem('wuzhang-runtime-mode-v1','ai-phone');localStorage.setItem('wuzhang-reduced-motion','1');},{key,save});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const shot=async name=>page.screenshot({path:resolve(output,`chapter-${chapter}-${width}-${name}.png`)});
  const reachable=async selector=>{
   const locator=page.locator(selector).first();await locator.scrollIntoViewIfNeeded();
   const result=await locator.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y);return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:!!h&&(el===h||el.contains(h)),inView:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1};});
   assert.ok(result.hit&&result.inView,`${chapter}/${width} ${selector}: ${JSON.stringify(result)}`);return result;
  };
  await page.goto(`http://127.0.0.1:${server.address().port}${url}`);if(chapter===1)await page.locator('.game-menu [data-action=continue]').click();
  console.log(`checking chapter ${chapter} ${width}x${height}`); await page.locator('.expression-workspace').waitFor();await page.evaluate(()=>document.fonts.ready);
  await reachable('#player-expression');await shot('expression');
  await page.locator('.speech-add').click();await reachable('.thought-inventory .inventory-row');
  assert.ok(await page.locator('.thought-inventory').evaluate(e=>e.clientWidth>=240),'Readable clue column');
  await page.locator('.thought-inventory .inventory-row').first().click();await reachable('.thought-detail-popover');await shot('clues');
  await page.locator('.speech-add-item').click();await reachable('.thought-inventory .inventory-place');await page.locator('.thought-inventory .inventory-place').first().click();await shot('items');
  assert.ok(await page.locator('.game-hud nav button').evaluateAll(nodes=>nodes.every(e=>{const r=e.getBoundingClientRect();return r.height<55&&r.left>=0&&r.right<=innerWidth;})),'Navigation stays on one line');
  await reachable('.confirm-expression');
  await page.locator('.phone-header [data-action=close-modal]').click();await page.locator('#player-expression').fill('发言输入检查，不发送');await reachable('#player-expression');await reachable('.confirm-expression');await shot('keyboard-expression');
  assert.ok(await page.locator('#player-expression').evaluate(e=>{const r=e.getBoundingClientRect(),button=document.querySelector('.confirm-expression').getBoundingClientRect();return r.height>=80&&r.top>=0&&r.bottom<=button.top+1&&button.bottom<=innerHeight;}),'Editor and Send fit together above keyboard');
  await page.setViewportSize({width,height});await page.locator('[data-action=pause]').first().click();await reachable('.pause-actions [data-action=pause-restart]');await reachable('.pause-actions [data-action=pause-home]');await shot('pause');
  assert.ok(await page.locator('.game-modal').evaluate(e=>e.scrollTop===0),'Pause does not rely on scrolling the hidden outer frame');
  const before=await page.evaluate(key=>localStorage.getItem(key),key);
  await page.locator('.pause-actions [data-action=pause-restart]').click();await reachable('.modal-close');await page.locator('.modal-close').click();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before,'Cancel restart preserves progress');
  await page.locator('.pause-actions [data-action=settings]').click();await reachable('.setting-row input');await shot('settings');await page.keyboard.press('Escape');
  if(await page.locator('[data-action=resume-game]').count())await page.locator('[data-action=resume-game]').click();
  await page.locator('.game-hud [data-action=save]').click();await reachable('.save-leaf:last-child button');await shot('save');
  await page.locator('.modal-close').click();await page.locator('[data-action=pause]').first().click();await page.locator('.pause-actions [data-action=pause-home]').click();
  await page.locator('.game-menu').waitFor();
  if(width===667){await page.mouse.move(350,180);await page.mouse.wheel(0,600);await page.locator('.game-menu [data-action=settings]').tap();await page.locator('.modal-close').click();await shot('home');}
  checks.push({chapter,width,height,passed:true});await context.close();
 }
 const portrait=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await portrait.route('http://127.0.0.1:8787/**',r=>r.fulfill({json:{configured:true},headers:{'Access-Control-Allow-Origin':'*'}}));
 await portrait.addInitScript(({key,save})=>{localStorage.setItem(key,save);localStorage.setItem('wuzhang-runtime-mode-v1','ai-phone');},{key:GAME_SAVE_KEY,save:one.serialize()});
 const narrow=await portrait.newPage();await narrow.goto(`http://127.0.0.1:${server.address().port}/`);await narrow.locator('[data-action=continue]').click();await narrow.locator('.speech-add-item').click();await narrow.locator('.thought-inventory').scrollIntoViewIfNeeded();
 assert.equal(await narrow.locator('.expression-paper').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1,'Pending portrait uses one real column');
 assert.ok(await narrow.locator('.thought-inventory').evaluate(e=>e.clientWidth>=240),'Pending portrait inventory has readable width');
 await narrow.screenshot({path:resolve(output,'chapter-1-390-pending-regression.png')});await portrait.close();
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'verification.json'),JSON.stringify({passed:true,sourceStyles,checks,errors},null,2));console.log(`PASS ${checks.length} chapter/landscape combinations, keyboard-size controls, clues/items, phone, pause, restart cancel, save/settings.`);
} finally {await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
