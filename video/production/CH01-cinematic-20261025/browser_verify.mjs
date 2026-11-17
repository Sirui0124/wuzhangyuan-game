import { chromium } from 'playwright';
import { createStaticServer } from '../../../GameStarter/web-demo/serve.mjs';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { npcTurn } from '../../../GameStarter/tests/npc-fixture.mjs';
import { firstTransfer } from '../../../GameStarter/tests/dialogue-lines.mjs';
const root=resolve('.'),out=resolve('video/production/CH01-cinematic-20261025/audit');
const config=JSON.parse(readFileSync(resolve(root,'GameStarter/web-demo/public/cinematics.json')));
const integration=JSON.parse(readFileSync(resolve(root,'video/production/CH01-cinematic-20261025/integration.json')));
const manifest=JSON.parse(readFileSync(resolve(root,'GameStarter/web-demo/public/video/media-manifest.json')));
const server=createStaticServer({root:resolve(root,'GameStarter/web-demo/.build')});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}});
const errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()===404)missing.push(r.url());});
const result={passed:false,hashes:[],newFilms:[],variants:[],opening:null,errors,missing,subjectiveListening:false};
try{
 for(const clip of [integration.opening,...integration.dialogue]){
   const bytes=Buffer.from(await(await fetch(base+clip.src)).arrayBuffer());
   const actual=createHash('sha256').update(bytes).digest('hex');
   assert.equal(actual,manifest.clips.find(m=>m.url===clip.src).sha256);result.hashes.push(clip.id);
 }
 await page.goto(base);await page.locator('[data-action=new]').click();
 await page.waitForFunction(src=>document.querySelector('video')?.getAttribute('src')===src,config.opening[0].src);
 await page.locator('video').evaluate(v=>v.addEventListener('ended',()=>window.__openingEnded={duration:v.duration,rate:v.playbackRate,width:v.videoWidth,height:v.videoHeight,audio:v.webkitAudioDecodedByteCount,error:v.error?.message??null},{once:true}));
 await page.waitForFunction(()=>window.__openingEnded,undefined,{timeout:60000});
 result.opening=await page.evaluate(()=>window.__openingEnded);assert.equal(result.opening.rate,1);assert.equal(result.opening.error,null);assert.ok(result.opening.audio>0);assert.equal(result.opening.width*9,result.opening.height*16);
 await page.waitForFunction(()=>document.querySelector('video')?.getAttribute('src')?.includes('SC03'));
 await page.screenshot({path:resolve(out,'new-opening-to-sc03.png')});
 for(const clip of integration.dialogue){
   const info=await page.evaluate(async src=>{
     const v=document.createElement('video');v.muted=true;v.src=src;document.body.append(v);
     await new Promise((ok,no)=>{v.onloadedmetadata=ok;v.onerror=()=>no(Error(v.error?.message));});
     const metadata={duration:v.duration,width:v.videoWidth,height:v.videoHeight};
     v.currentTime=Math.max(0,v.duration-.25);await v.play();await new Promise(ok=>v.onended=ok);
     const r={...metadata,audio:v.webkitAudioDecodedByteCount,error:v.error?.message??null};v.remove();return r;
   },clip.src);
   assert.equal(info.width*9,info.height*16);assert.ok(info.audio>0);assert.equal(info.error,null);result.newFilms.push({id:clip.id,...info});
 }
 const {ChapterSession}=await import(pathToFileURL(resolve(root,'GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js')));
 const content=JSON.parse(readFileSync(resolve(root,'content/chapters/wuzhang/chapter-one.script.json')));
 const flow=JSON.parse(readFileSync(resolve(root,'content/chapters/wuzhang/chapter-one.flow.json')));
 const version=JSON.parse(readFileSync(resolve(root,'GameStarter/web-demo/.build/story/session-manifest.json'))).contentVersion;
 for(const choice of ['a','b']){
   const session=new ChapterSession(content,flow,version,async input=>npcTurn(input,'ok',content.rows.find(r=>r.id==='A-40B').text));
   const drain=()=>{let n=0;while(session.snapshot().phase==='dialogue'&&n++<200)session.nextLine();};
   const act=id=>{const action=flow.actions.find(a=>a.id===id);if(session.snapshot().scene!==action.scene)assert.ok(session.move(action.scene));assert.ok(session.act(id));};
   session.finishCinematic();drain();act('read-notice');drain();act('meet-first-scout');drain();session.chooseScout(choice);drain();act('intercept-first');drain();
   session.setFocus('我来转呈');session.setDraft(firstTransfer);assert.ok(await session.confirmExpression());session.acknowledgeReply();drain();act('deliver-first');
   const raw=session.serialize();assert.equal(session.row().id,'A-42');
   const ctx=await browser.newContext();await ctx.addInitScript(raw=>{localStorage.setItem('wuzhang-chapter-session-v1',raw);localStorage.setItem('wuzhang-voice-muted','1');localStorage.setItem('wuzhang-reduced-motion','1');},raw);
   const view=await ctx.newPage();await view.goto(base);await view.locator('[data-action=continue]').click();
   const expected=choice==='a'?'C1T06-06':'C1FIX06B';await view.waitForFunction(id=>document.querySelector('[data-story-film]')?.getAttribute('data-story-film')?.includes(id),expected);
   const snapshot=()=>view.evaluate(()=>JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1')));
   assert.equal((await snapshot()).story.collected.includes('T02'),choice==='a');
   await view.locator('[data-cinema-action=skip]').click();await view.locator('[data-film-confirm]').click();
   assert.equal((await snapshot()).story.collected.includes('T02'),choice==='a');
   await view.screenshot({path:resolve(out,`handoff-branch-${choice}.png`)});result.variants.push({choice,film:expected,noInventedClue:true});await ctx.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);result.passed=true;
 writeFileSync(resolve(out,'browser-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
