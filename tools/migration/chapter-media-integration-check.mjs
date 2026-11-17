import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';

const baseline=process.env.MEDIA_BASELINE==='1';
const out=resolve('outputs/ch1-ch2-p1p2-integration-20261027/media');mkdirSync(out,{recursive:true});
const compiled=resolve(process.env.MEDIA_COMPILED??`${out}/${baseline?'before-compiled':'compiled'}`);
const movies=JSON.parse(readFileSync('GameStarter/web-demo/public/cinematics.json','utf8'));
const content=JSON.parse(readFileSync('content/chapters/wuzhang/chapter-one.script.json','utf8'));
const flow=JSON.parse(readFileSync('content/chapters/wuzhang/chapter-one.flow.json','utf8'));
const server=createStaticServer({root:resolve('GameStarter/web-demo/.build'),onRequest(req,res){
 const path=new URL(req.url,'http://localhost').pathname;
 const send=(type,value)=>{res.writeHead(200,{'Content-Type':type});res.end(value);return true;};
 if(path==='/integration-fixture')return send('text/html; charset=utf-8','<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/cinematics.css"><div id="test-host"></div>');
 if(['/cinematics.css','/characters.css','/subtitles.css'].includes(path))return send('text/css; charset=utf-8',readFileSync('GameStarter/web-demo/public'+path));
 if(path.startsWith('/GameStarter/')&&path.endsWith('.js')){
  const file=resolve(compiled,'.'+path);
  if(file.startsWith(compiled)&&existsSync(file))return send('text/javascript; charset=utf-8',readFileSync(file,'utf8').replace(/(from\s+['"])(\.[^'"]+)(['"])/g,(_,a,b,c)=>a+(b.endsWith('.js')?b:b+'.js')+c));
 }
 return false;
}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--autoplay-policy=no-user-gesture-required','--mute-audio']});
const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[],checks=[];page.setDefaultTimeout(15000);
page.on('pageerror',error=>errors.push(error.message));
const base=`http://127.0.0.1:${server.address().port}`;
async function startStory(id,suffix=''){
 await page.goto(base+'/integration-fixture');
 await page.evaluate(async({content,flow,movies,id})=>{
  const {ChapterSession}=await import('/GameStarter/web-demo/src/chapter-session.js');
  const {CinematicPlayer}=await import('/GameStarter/web-demo/src/cinematics.js');
  const {createStoryFilms}=await import('/GameStarter/web-demo/src/game/story-films.js');
  const {createCharacterModule}=await import('/GameStarter/web-demo/src/characters/module.js');
  const {chapterOneCharacters}=await import('/GameStarter/web-demo/src/chapters/chapter-one/characters.js');
  const {createGameModals}=await import('/GameStarter/web-demo/src/game/modals.js');
  window.host=document.querySelector('#test-host');window.film=movies.chapterDialogue.find(f=>f.id===id);
  window.game=new ChapterSession(content,flow,'media-integration');
  // Developer checkpoint only; no actual player save is read or written.
  const section=flow.sections.find(s=>s.rows.includes(film.rows[0]));
  game.state.phase='dialogue';game.state.section=section.id;game.state.round=section.round;game.state.scene=section.scene;game.state.lineIndex=section.rows.indexOf(film.rows[0]);game.state.story.current=film.rows[0];
  game.state.story.seen=['A-28','J08'];
  window.people=createCharacterModule({root:host,portraits:{},enabled:true});
  window.player=new CinematicPlayer('integration','integration-'+id,true);
  window.events=[];host.addEventListener('cinema-diagnostic',event=>events.push(event.detail));
  window.render=()=>{if(!story.mount(game.snapshot()))host.innerHTML='<main class="game-scene"><p>下一节点</p></main>';people.sync(chapterOneCharacters(game,true));};
  window.story=createStoryFilms(host,game,player,movies.chapterDialogue,render);
  window.beforeState=game.snapshot();window.modals=createGameModals(game,flow,{scenes:{}},{overlay:'records'},()=>null,()=>'',()=> '');render();
 },{content,flow,movies:suffix?{...movies,chapterDialogue:movies.chapterDialogue.map(f=>f.id===id?{...f,src:f.src+suffix}:f)}:movies,id});
}
const ready=()=>page.waitForFunction(()=>host.querySelector('.cinema-screen')?.dataset.mediaState==='ready');
async function finishNaturally(){
 await ready();await page.locator('video').evaluate(video=>{video.currentTime=Math.max(0,video.duration-.2);void video.play();});
 await page.locator('.story-film-confirm:not([hidden])').waitFor();
}
try{
 await startStory('C1T18-report-20261024');await ready();
 const identity=await page.locator('.character-identity').allTextContents();
 await page.screenshot({path:resolve(out,baseline?'before-formal-report.png':'formal-report.png')});
 if(baseline)assert.equal(identity.length,1);else assert.deepEqual(identity,[]);
 await page.locator('[data-character-open]').first().click();assert.equal(await page.locator('[data-character-select=jiangwei]').count(),1);await page.keyboard.press('Escape');
 await finishNaturally();
 const ended=await page.evaluate(()=>({videos:host.querySelectorAll('video').length,canvases:host.querySelectorAll('canvas').length,source:host.querySelector('video')?.getAttribute('src')??null,error:host.querySelector('video')?.error?.code??null,state:host.querySelector('.cinema-screen')?.dataset.mediaState,completed:game.snapshot().story.completed,events:player.getDiagnostics().map(e=>e.event)}));
 const cdp=await page.context().newCDPSession(page);const ax=await cdp.send('Accessibility.getFullAXTree');
 const axMedia=ax.nodes.filter(n=>/media|video|播放|无法/i.test(n.role?.value+' '+n.name?.value)).map(n=>({role:n.role?.value,name:n.name?.value,ignored:n.ignored}));
 await page.screenshot({path:resolve(out,baseline?'before-ended.png':'ended.png')});
 if(baseline)assert.equal(ended.videos,1);else{assert.equal(ended.videos,0);assert.equal(ended.canvases,1);assert.equal(ended.state,'ended');}
 assert.equal(ended.events.includes('error'),false);assert.deepEqual(ended.completed,[]);
 checks.push({name:'normal-story-end-and-film-identity',identity,ended,axMedia});
 if(!baseline){
  const state=await page.evaluate(()=>game.serialize());await page.locator('[data-film-replay]').click();await ready();
  assert.equal(await page.evaluate(()=>game.serialize()),state);assert.ok(await page.locator('video').evaluate(v=>v.currentTime<2));
  await page.locator('[data-cinema-action=skip]').click();await page.locator('.story-film-confirm:not([hidden])').waitFor();
  assert.equal(await page.evaluate(()=>game.serialize()),state);
 }
 await page.locator('[data-film-confirm]').click();
 const watched=await page.evaluate(()=>({rows:game.snapshot().story.completed,clues:game.collected,records:modals.modalHTML(game.snapshot()),row:game.row()?.id}));
 assert.ok(filmRowsPresent(watched.rows,movies.chapterDialogue.find(f=>f.id==='C1T18-report-20261024').rows));
 await startStory('C1T18-report-20261024');await ready();await page.locator('[data-cinema-action=skip]').click();await page.locator('.story-film-confirm:not([hidden])').waitFor();await page.locator('[data-film-confirm]').click();
 const skipped=await page.evaluate(()=>({rows:game.snapshot().story.completed,clues:game.collected,records:modals.modalHTML(game.snapshot()),row:game.row()?.id}));
 assert.deepEqual(skipped,watched);checks.push({name:'watched-and-skipped-facts-and-records-match',rows:watched.rows,clues:watched.clues,nextRow:watched.row,recordsAvailable:watched.records.includes('dialogue-stream')});
 if(!baseline){
  // This clip grants actual clues; reaching ended uses a near-end seek, not an audio review.
  const outcomes=[];
  for(const skip of [false,true]){
   await startStory('C1T05-05');await ready();
   if(skip){await page.locator('[data-cinema-action=skip]').click();await page.locator('.story-film-confirm:not([hidden])').waitFor();}
   else await finishNaturally();
   await page.locator('[data-film-confirm]').click();
   outcomes.push(await page.evaluate(()=>({rows:game.snapshot().story.completed,clues:game.collected,phase:game.snapshot().phase,records:modals.modalHTML(game.snapshot())})));
  }
  assert.deepEqual(outcomes[0],outcomes[1]);assert.ok(outcomes[0].clues.length>0);
  checks.push({name:'clue-bearing-film-ended-and-skipped-commit-the-same-information',clip:'C1T05-05',rows:outcomes[0].rows,clues:outcomes[0].clues,phase:outcomes[0].phase,recordsAvailable:outcomes[0].records.includes('dialogue-stream'),method:'near-end seek to exercise ended versus explicit skip; no listening review'});
  let release;const gate=new Promise(r=>{release=r});
  await page.route('**/*integration-loading*',async route=>{await gate;await route.continue();});
  await startStory('C1T18-report-20261024','?integration-loading');
  assert.equal(await page.locator('.cinema-screen').getAttribute('data-media-state'),'loading');
  assert.equal(await page.locator('[data-cinema-action=retry]').isVisible(),false);
  const controls=await page.locator('.cinema-controls button').evaluateAll(buttons=>buttons.map(b=>b.getAttribute('aria-label')||b.textContent));
  await page.screenshot({path:resolve(out,'loading.png')});release();await ready();
  let fail=true;await page.route('**/*integration-failed*',route=>fail?route.abort('failed'):route.continue());
  await startStory('C1T18-report-20261024','?integration-failed');
  await page.waitForFunction(()=>host.querySelector('.cinema-screen')?.dataset.mediaState==='error');
  assert.equal(await page.locator('[data-cinema-action=retry]').isVisible(),true);assert.deepEqual(await page.evaluate(()=>game.snapshot().story.completed),[]);
  await page.screenshot({path:resolve(out,'failed-retry.png')});
  fail=false;await page.locator('[data-cinema-action=retry]').click();await ready();
  assert.equal(await page.locator('[data-cinema-action=retry]').isVisible(),false);
  await page.locator('[data-cinema-action=skip]').evaluate(button=>{button.click();button.click();});
  await page.locator('.story-film-confirm:not([hidden])').waitFor();assert.deepEqual(await page.evaluate(()=>game.snapshot().story.completed),[]);
  await page.locator('[data-film-confirm]').click();assert.deepEqual(await page.evaluate(()=>game.snapshot().story.completed),watched.rows);
  checks.push({name:'chapter-one-loading-error-retry-and-repeated-skip',controls,rows:watched.rows,advancedOnce:true});
  await page.goto(base+'/integration-fixture');
  const common=await page.evaluate(async clip=>{
   const {CinematicPlayer}=await import('/GameStarter/web-demo/src/cinematics.js');
   const {createCharacterModule}=await import('/GameStarter/web-demo/src/characters/module.js');
   const {chapterTwoCharacters}=await import('/GameStarter/web-demo/src/chapters/chapter-two/characters.js');
   window.host=document.querySelector('#test-host');window.player=new CinematicPlayer('grain-compare','grain-compare',true);window.finished=0;
   player.mount(host,'grain-v24',[clip],'chapter-two',()=>finished++);
   window.people=createCharacterModule({root:host,portraits:{},enabled:true});
   people.sync(chapterTwoCharacters({current:{id:'V24',kind:'video',speaker:''},state:{visited:['V02','V23']}}));
   return Array.from(host.querySelectorAll('.cinema-controls button')).map(b=>b.getAttribute('aria-label')||b.textContent);
  },movies.chapterTwo.find(f=>f.id==='CH2-V24'));
  assert.deepEqual(common,controls);await ready();assert.equal(await page.locator('.character-identity').count(),0);
  await page.locator('[data-character-open]').click();assert.equal(await page.locator('[data-character-select=old-woman]').count(),1);await page.keyboard.press('Escape');
  await page.locator('[data-cinema-action=skip]').evaluate(button=>{button.click();button.click();});
  assert.equal(await page.evaluate(()=>finished),1);assert.equal(await page.locator('video').count(),0);
  checks.push({name:'two-chapter-common-controls-and-film-identities',sameControls:common,chapterTwoDossierRetained:true,chapterTwoCompletionCount:1,chapterOneEndConfirmationPreserved:true});
 }
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(out,baseline?'baseline.json':'verification.json'),JSON.stringify({passed:true,kind:'isolated developer media regression',baseline,audioReviewed:false,checks,errors},null,2));console.log(JSON.stringify({passed:true,baseline,checks:checks.map(c=>c.name)}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
function filmRowsPresent(completed,rows){return rows.every(id=>completed.includes(id));}
