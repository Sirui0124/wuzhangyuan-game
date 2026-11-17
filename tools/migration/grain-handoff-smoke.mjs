import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {GrainSession} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import {fixedJudgment} from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/film-dialogue.js';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const story=read('content/chapters/grain/chapter-two.films.json'),rubric=read('content/chapters/grain/chapter-two.films-rubric.json');
const session=new GrainSession(story,undefined,rubric,true);
for(let i=0;i<100&&session.current.id!=='V10';i++)assert.ok(session.advance(session.current.options?.[0]?.id));
assert.equal(session.current.id,'V10');
const baseline=process.argv.includes('--baseline');
const out=resolve('outputs/grain-handoff-20261026',baseline?'before':'after');mkdirSync(out,{recursive:true});
const server=createStaticServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
let responseMode='ok',releaseResponse;
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.route('http://127.0.0.1:8787/**',async route=>{
  const mode=responseMode;
  if(route.request().url().endsWith('/respond')&&mode==='hold')await new Promise(r=>releaseResponse=r);
  await route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:route.request().url().endsWith('/respond')?{text:JSON.stringify(mode==='invalid'?{valid:false}:{valid:true,scores:Object.fromEntries(['trust','rigor','responsibility'].map(k=>[k,{delta:0,quote:'',reason:'界面衔接测试'}]))})}:{configured:true}}).catch(()=>{});
 });
 await context.addInitScript(save=>{if(!localStorage.getItem('grain-chapter-two-films-v1'))localStorage.setItem('grain-chapter-two-films-v1',save);localStorage.setItem('wuzhang-runtime-mode-v1','ai-phone');},JSON.stringify(session.state));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/?chapter=grain`);
 async function sample(selector,ratio,name){await page.locator(selector).evaluate(async(v,ratio)=>{if(v.readyState<2)await new Promise(r=>v.addEventListener('loadeddata',r,{once:true}));v.pause();v.currentTime=Math.min(v.duration-.15,v.duration*ratio);await new Promise(r=>v.addEventListener('seeked',r,{once:true}));},ratio);await page.screenshot({path:resolve(out,name+'.png')});}
 await sample('.cinema-screen video',.99,'01-before-expression');
 await page.locator('[data-cinema-action=skip]').click();
 await page.locator('.speech-add').click();await page.locator('.inventory-place').first().click();
 await page.locator('#player-expression').fill('你救过我，我不想看你去送死。先留下，让我帮你。');
 await page.screenshot({path:resolve(out,'02-expression.png')});
 await page.locator('[data-action=speak]').click();
 await sample('.grain-listener video',.01,'03-listener-start');
 await sample('.grain-listener video',.99,'04-listener-end');
 const listenerViewport=await page.locator('.grain-listener video').boundingBox();
 await page.locator('.grain-listener video').evaluate(v=>v.play());
 await page.locator('.game-scene #spoken-line').waitFor();
 await page.screenshot({path:resolve(out,'05-reply.png')});
 const notesOpen=await page.locator('.thought-inventory').count();
 if(baseline){writeFileSync(resolve(out,'reproduction.json'),JSON.stringify({notesOpen,errors}));}
 else{
  assert.equal(notesOpen,0);assert.equal(await page.locator('.portrait-stage').count(),0);
  assert.equal(await page.locator('.grain-reply-frame').count(),1);
  assert.deepEqual(await page.locator('.grain-reply-frame').boundingBox(),listenerViewport,'End-frame handoff keeps exactly the same viewport');
  assert.equal(await page.locator('.grain-reply-frame').evaluate(el=>getComputedStyle(el).filter),'none');
  assert.equal(await page.locator('#game-root').getAttribute('data-node'),'CH2-LY03-018','Reply awaits player input');
  await page.locator('[data-action=notes]').click();
  const heights=await page.locator('.inventory-entry').evaluateAll(rows=>rows.map(r=>r.getBoundingClientRect().height));assert.ok(heights.every(h=>h<80));
  await page.screenshot({path:resolve(out,'07-manual-notebook.png')});
  await page.locator('[data-action=notes-list]').click();
  await page.locator('[data-action=revise]').click();assert.ok((await page.locator('#player-expression').inputValue()).includes('你救过我'));
  await page.locator('.speech-add').click();await page.locator('[data-action=keep]').click();assert.equal(await page.locator('.thought-inventory').count(),0);
  await page.reload();await page.locator('.grain-reply').waitFor();
  assert.equal(await page.locator('.portrait-stage').count(),0);assert.ok((await page.locator('.scene-image').getAttribute('style')).includes('CH2-listening-end'));
  await page.screenshot({path:resolve(out,'08-restored-reply.png')});
 }
 if(notesOpen)await page.locator('[data-action=notes-list]').click();
 await page.locator('.dialogue-advance').click();
 await sample('.cinema-screen video',.01,'06-next-film');
 if(!baseline){
  // Reach the actual second free conversation through the session's normal paths.
  session.advance();assert.equal(session.current.round,'O1');session.submit(fixedJudgment('O1',0,session.currentRubric).judgment);session.advance();
  for(let i=0;i<150&&session.current.round!=='O2';i++)assert.ok(session.advance(session.current.options?.[0]?.id));
  assert.equal(session.current.round,'O2');
  await page.evaluate(save=>localStorage.setItem('grain-chapter-two-films-v1',save),JSON.stringify(session.state));await page.reload();await page.locator('#player-expression').fill('先停下赴魏的计划，把真实粮情如实报上去。');
  responseMode='hold';await page.locator('[data-action=speak]').click();await page.locator('.grain-listener video').waitFor();
  await page.locator('.grain-listener [data-action=cancel-speech]').click();releaseResponse?.();responseMode='invalid';
  assert.ok((await page.locator('#player-expression').inputValue()).includes('先停下'));
  assert.equal(await page.locator('.grain-listener').count(),0);
  await page.locator('[data-action=speak]').click();await page.locator('.expression-status').filter({hasText:'没听明白'}).waitFor();
  assert.equal(await page.locator('.grain-listener').count(),0);responseMode='ok';
  await page.locator('.speech-add').click();await page.locator('[data-action=speak]').click();
  await page.locator('.grain-listener video').waitFor();
  assert.ok((await page.locator('.grain-listener video').getAttribute('src')).includes('listening-steady'));
  // Let the full three-second film play naturally, including its end-frame handoff.
  await page.locator('.grain-reply').waitFor();assert.equal(await page.locator('.thought-inventory').count(),0);
  await page.screenshot({path:resolve(out,'09-second-round-reply.png')});
  for(const size of [{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(size);const r=await page.locator('.grain-reply-actions').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=size.width&&r.y+r.height<=size.height);
   await page.screenshot({path:resolve(out,`10-reply-${size.width}.png`)});
  }
 }
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(out,'verification.json'),JSON.stringify({baseline,notesOpen,errors,passed:true},null,2));
 console.log(JSON.stringify({baseline,notesOpen,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
