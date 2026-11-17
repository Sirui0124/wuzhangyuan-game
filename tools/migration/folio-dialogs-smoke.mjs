import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { ChapterSession, GAME_SAVE_KEY } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const flow=read('content/chapters/wuzhang/chapter-one.flow.json');
const game=new ChapterSession(read('content/chapters/wuzhang/chapter-one.script.json'),flow,read('GameStarter/web-demo/.build/story/session-manifest.json').contentVersion,undefined,undefined,'offline');
const lines=()=>{while(game.snapshot().phase==='dialogue')game.nextLine();};
game.finishCinematic();lines();const action=flow.actions.find(a=>a.id==='read-notice');game.move(action.scene);game.act(action.id);lines();
const expected=game.snapshot().story.completed.flatMap(id=>{const row=game.sourceRow(id);return row?.text.trim()?[row.text]:[];});
const output=resolve('outputs/folio-dialogs-20261026');mkdirSync(output,{recursive:true});
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await context.route('http://127.0.0.1:8787/**',route=>route.fulfill({json:{configured:false,apiKey:'',model:'',baseUrl:''},headers:{'Access-Control-Allow-Origin':'*'}}));
 await context.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,save);localStorage.setItem('wuzhang-runtime-mode-v1','offline');localStorage.setItem('wuzhang-reduced-motion','1');},{key:GAME_SAVE_KEY,save:game.serialize()});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('.game-menu [data-action=continue]').click();
 const before=await page.evaluate(key=>localStorage.getItem(key),GAME_SAVE_KEY);
 async function capture(name,width,height=900){
  await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);
  const fit=await page.locator('.game-modal').evaluate(el=>{const r=el.getBoundingClientRect(),body=el.querySelector('.folio-body');return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&body.scrollWidth<=body.clientWidth+1;});
  assert.ok(fit,`${name} fits ${width}x${height}`);
  await page.screenshot({path:resolve(output,`${name}-${width}.png`)});checks.push(`${name} ${width}x${height}`);
 }
 await page.locator('[data-action=pause]').click();
 await capture('pause-final',1440);await capture('pause-final',390,844);await capture('pause-landscape',844,390);
 await page.setViewportSize({width:1440,height:900});
 await page.locator('[data-page=pause] [data-action=settings]').click();await capture('settings',1440);await capture('settings',390,844);
 await page.keyboard.press('Escape');await page.locator('[data-page=pause]').waitFor();
 await page.locator('[data-action=resume-game]').click();
 await page.setViewportSize({width:1440,height:900});
 await page.locator('.game-hud [data-action=save]').click();await capture('saves',390,844);await capture('saves',1440);
 await page.locator('[data-action=close-modal]').click();
 await page.setViewportSize({width:1440,height:900});
 await page.locator('.game-hud [data-action=records]').click();await page.locator('[data-page=history]').waitFor();
 assert.deepEqual(await page.locator('.history-content p').allTextContents(),expected,'All real records retained verbatim and in order');
 await capture('history-final',1440);await capture('history-final',390,844);
 // Stress the renderer with a long record sequence, without changing any game state.
 const actual=await page.locator('.dialogue-stream').innerHTML();
 await page.locator('.dialogue-stream').evaluate((el,html)=>el.innerHTML=html.repeat(12),actual);
 const scroll=await page.locator('[data-page=history] .folio-body').evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollHeight>el.clientHeight&&el.scrollTop>0;});assert.ok(scroll,'Long records remain scrollable');
 await page.locator('[data-action=close-modal]').click();
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),GAME_SAVE_KEY),before,'Viewing dialogs preserves the save');
 await page.goto(`http://127.0.0.1:${server.address().port}/?chapter=grain`);await page.locator('[data-action=pause]').click();
 await capture('pause-chapter-two',1440);await capture('pause-chapter-two',390,844);
 if(await page.locator('[data-action=pause-restart]').count()){
  await page.locator('[data-action=pause-restart]').click();await capture('restart-confirmation',1440);await capture('restart-confirmation',390,844);
  await page.keyboard.press('Escape');await page.locator('[data-page=pause]').waitFor();
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'layout-verification.json'),JSON.stringify({passed:true,checks,recordsUnchanged:true,saveUnchanged:true,errors},null,2));
 console.log('PASS: folio dialog sizes, controls, verbatim records, scrolling and save preservation.');
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
