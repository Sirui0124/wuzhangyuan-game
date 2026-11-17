import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
const build=resolve(process.env.GAME_BUILD??'GameStarter/web-demo/.build'),out=resolve('outputs/release-fixes-20261027/ui-reading');mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8')),mod=p=>import(pathToFileURL(resolve(build,'GameStarter/web-demo/src',p)));
const {ChapterSession,GAME_SAVE_KEY}=await mod('chapter-session.js');
const {GrainSession}=await mod('chapters/chapter-two/session.js');
const {GRAIN_SAVE_KEY}=await mod('chapters/chapter-two/navigation.js');
const {createJietingPlaytest}=await mod('chapters/chapter-three/session.js');
const {dialogueFixtures}=await import('../ai/dialogue-fixtures.mjs');
const f=await dialogueFixtures(build), reading=await f.thoughts();
reading.think();reading.continueThought();reading.placeThought('C06');reading.placeThought('C07');reading.think();assert.ok(reading.followPlan());
while(reading.row()&&reading.row().id!=='J13')reading.nextLine();
const firstRead=reading.snapshot();
const firstChoice=new ChapterSession(read('content/chapters/wuzhang/chapter-one.script.json'),read('content/chapters/wuzhang/chapter-one.flow.json'),firstRead.contentVersion,undefined,undefined,'offline');
firstChoice.finishCinematic();while(firstChoice.row())firstChoice.nextLine();firstChoice.act('read-notice');while(firstChoice.row())firstChoice.nextLine();firstChoice.move('report_post');firstChoice.act('meet-first-scout');while(firstChoice.row())firstChoice.nextLine();assert.equal(firstChoice.snapshot().phase,'choice');
const films=read('content/chapters/grain/chapter-two.films.json'),rubric=read('content/chapters/grain/chapter-two.films-rubric.json');
const secondRead=new GrainSession(films,undefined,rubric,false);for(let i=0;i<100&&secondRead.current.kind!=='line';i++)assert.ok(secondRead.advance(secondRead.current.options?.[0]?.id),secondRead.current.id);assert.equal(secondRead.current.kind,'line');
const secondChoice=new GrainSession(films,undefined,rubric,false);for(let i=0;i<100&&secondChoice.current.kind!=='choice';i++)assert.ok(secondChoice.advance(secondChoice.current.options?.[0]?.id),secondChoice.current.id);assert.equal(secondChoice.current.kind,'choice');
const thirdChoice=createJietingPlaytest(read(resolve(build,'story/chapter-three.story.json')),'reinforcement',{aiEnabled:false});
const thirdRead=createJietingPlaytest(read(resolve(build,'story/chapter-three.story.json')),'reinforcement',{aiEnabled:false});assert.ok(thirdRead.advance('JT-O132'),thirdRead.current.id);for(let i=0;i<100&&thirdRead.current.kind!=='line';i++)assert.ok(thirdRead.advance(thirdRead.options[0]?.id),thirdRead.current.id);assert.equal(thirdRead.current.kind,'line');
const fixtures=[['one-read',GAME_SAVE_KEY,JSON.stringify(firstRead),'/',null],['one-choice',GAME_SAVE_KEY,firstChoice.serialize(),'/', '[data-scout-choice]'],['two-read',GRAIN_SAVE_KEY,JSON.stringify(secondRead.state),'/?chapter=grain',null],['two-choice',GRAIN_SAVE_KEY,JSON.stringify(secondChoice.state),'/?chapter=grain','[data-option]'],['three-read','jieting-chapter-three-v1',JSON.stringify(thirdRead.state),'/?chapter=jieting',null],['three-choice','jieting-chapter-three-v1',JSON.stringify(thirdChoice.state),'/?chapter=jieting','[data-option]']];
const server=createStaticServer({root:build});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[];
try {
 for(const [name,key,save,url,choice]of fixtures)for(const [width,height]of [[667,375],[844,390],[932,430]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'});
  await context.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===base?r.continue():u.hostname==='127.0.0.1'?r.fulfill({json:{configured:false},headers:{'Access-Control-Allow-Origin':'*'}}):r.abort();});
  await context.addInitScript(({key,save})=>{if(!localStorage.getItem(key))localStorage.setItem(key,save);localStorage.setItem('wuzhang-runtime-mode-v1','offline');localStorage.setItem('wuzhang-reduced-motion','1');},{key,save});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));console.log(`checking ${name} ${width}`);await page.goto(base+url);if(name.startsWith('one'))await page.locator('[data-action=continue]').click();
  const box=page.locator('.dialogue-box');await box.waitFor();await page.evaluate(()=>document.fonts.ready);
  const geometry=await box.evaluate(e=>{const r=e.getBoundingClientRect();return {height:r.height,top:r.top,bottom:r.bottom,viewport:innerHeight,scroll:e.scrollWidth,client:e.clientWidth};});
  assert.ok(geometry.height>=70&&geometry.top>=46&&geometry.bottom<=geometry.viewport&&geometry.scroll<=geometry.client+1,name+' readable panel '+JSON.stringify(geometry));
  const before=await page.evaluate(key=>localStorage.getItem(key),key);
  if(choice){const button=page.locator(choice).last();await button.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,`${name}-${width}.png`)});await button.tap();assert.notEqual(await page.evaluate(key=>localStorage.getItem(key),key),before,'Choice tap advances');}
  else {await page.screenshot({path:resolve(out,`${name}-${width}.png`)});await page.locator('.game-hud [data-action=pause]').tap();await page.locator('[data-action=resume-game]').tap();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),before,'Pause does not consume reading');await box.tap();assert.notEqual(await page.evaluate(key=>localStorage.getItem(key),key),before,'Reading tap advances');}
  checks.push({name,width,height,passed:true});await context.close();
 }
 // The old first-chapter document must use the same shell and retain query params.
 const c=await browser.newContext({viewport:{width:667,height:375},hasTouch:true});await c.route('http://127.0.0.1:8787/**',r=>r.fulfill({json:{configured:false},headers:{'Access-Control-Allow-Origin':'*'}}));const p=await c.newPage();
 await p.goto(base+'/chapter-one.html?chapter=grain&playtest=weiyan-second&review=mobile');await p.waitForURL(u=>u.pathname==='/'&&u.searchParams.get('review')==='mobile');assert.equal(new URL(p.url()).searchParams.has('chapter'),false);assert.equal(new URL(p.url()).searchParams.get('playtest'),'weiyan-second');assert.ok(await p.locator('link[href="/mobile-landscape.css"]').count());
 await c.close();
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'verification.json'),JSON.stringify({passed:true,checks,errors},null,2));console.log(`PASS ${checks.length} reading/choice/entry checks.`);
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
