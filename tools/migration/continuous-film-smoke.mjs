import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const movies=read('GameStarter/web-demo/public/cinematics.json');
const content=read('content/chapters/wuzhang/chapter-one.script.json'),flow=read('content/chapters/wuzhang/chapter-one.flow.json');
const out=resolve('outputs/continuous-films-20261028');mkdirSync(out,{recursive:true});
const server=createStaticServer({onRequest(req,res){if(req.url==='/film-fixture'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/cinematics.css"><div id="test-host"></div>');return true;}return false;}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
const checks=[],errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 for(const film of movies.chapterDialogue){
  await page.goto(origin+'/film-fixture');
  await page.evaluate(async({content,flow,film})=>{
   const {ChapterSession}=await import('/GameStarter/web-demo/src/chapter-session.js');
   const {CinematicPlayer}=await import('/GameStarter/web-demo/src/cinematics.js');
   const {createStoryFilms}=await import('/GameStarter/web-demo/src/game/story-films.js');
   const host=document.querySelector('#test-host'),game=window.game=new ChapterSession(content,flow,'continuous-film');
   const section=flow.sections.find(s=>s.rows.includes(film.rows[0]));
   game.state.phase='dialogue';game.state.section=section.id;game.state.round=section.round;game.state.scene=section.scene;game.state.lineIndex=section.rows.indexOf(film.rows[0]);game.state.story.current=film.rows[0];
   if(film.id==='C1T06-06')game.state.story.collected.push('T02');
   const cinema=window.cinema=new CinematicPlayer('continuous-film',`test-film:${film.id}`);
   const render=()=>{if(!story.mount(game.snapshot()))host.innerHTML='<p id="next-node">下一处交互</p>';};
   const story=createStoryFilms(host,game,cinema,[film],render);window.render=render;render();
  },{content,flow,film});
  // Variant-dependent films are tested against their actual first line.
  if(!await page.locator('video').count()){checks.push({id:film.id,variant:'not selected by this checkpoint'});continue;}
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&v.duration>0;});
  await page.locator('video').evaluate(v=>{v.currentTime=Math.max(0,v.duration-.12);void v.play();});
  await page.locator('#next-node').waitFor();
  const state=await page.evaluate(()=>({phase:game.snapshot().phase,row:game.row()?.id,completed:game.snapshot().story.completed,flags:game.snapshot().story.flags}));
  if(film.afterPlayback==='dialogue'){assert.equal(state.row,film.rows[0]);assert.ok(!state.completed.includes(film.rows[0]));}
  else {assert.notEqual(state.row,film.rows[0]);assert.ok(film.rows.every(id=>state.completed.includes(id)),film.id);}
  assert.equal(await page.locator('.story-film-confirm:not([hidden])').count(),0);
  if(film.id==='C1T17-15'){assert.equal(state.row,'W07');assert.equal(state.flags.AUTH_WITNESSED,true);}
  checks.push({id:film.id,policy:film.afterPlayback,next:state.row||state.phase});
 }
 // Real chapter-two entry: natural film completion moves exactly once and lands on a choice.
 await page.goto(origin+'/film-fixture');
 await page.evaluate(()=>{localStorage.setItem('wuzhang-runtime-mode-v1','offline');localStorage.setItem('wuzhang-chapter-history-v1',JSON.stringify({version:1,entered:['wuzhang'],completed:['wuzhang']}));});
 await page.goto(origin+'/?chapter=grain');
 for(let i=0;i<4;i++){
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&v.duration>0;});
  const before=await page.locator('#game-root').getAttribute('data-node');
  await page.locator('video').evaluate(v=>{v.currentTime=Math.max(0,v.duration-.12);void v.play();});
  await page.waitForFunction(id=>document.querySelector('#game-root').dataset.node!==id,before);
  const after=await page.locator('#game-root').getAttribute('data-node');checks.push({chapter:2,from:before,to:after});
  if(await page.locator('[data-option]').count())break;
 }
 await page.locator('[data-option]').first().waitFor();const choice=await page.locator('#game-root').getAttribute('data-node');
 await page.waitForTimeout(350);assert.equal(await page.locator('#game-root').getAttribute('data-node'),choice);
 await page.screenshot({path:resolve(out,'chapter-two-choice.png')});
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'verification.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
