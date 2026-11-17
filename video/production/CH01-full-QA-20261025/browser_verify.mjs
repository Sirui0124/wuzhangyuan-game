import { chromium } from 'playwright';
import { createStaticServer } from '../../../GameStarter/web-demo/serve.mjs';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { npcTurn } from '../../../GameStarter/tests/npc-fixture.mjs';
import { firstTransfer } from '../../../GameStarter/tests/dialogue-lines.mjs';
const root=resolve('.'),out=resolve('video/production/CH01-full-QA-20261025/audit');
const read=p=>JSON.parse(readFileSync(resolve(root,p)));
const config=read('GameStarter/web-demo/public/cinematics.json');
const before=read('video/production/CH01-full-QA-20261025/audit/cinematics-pre-integration.json');
const integration=read('video/production/CH01-full-QA-20261025/integration.json');
const original=read('video/production/CH01-full-QA-20261025/inventory.json');
const media=read('GameStarter/web-demo/public/video/media-manifest.json');
for(const [group,clips] of Object.entries(config))if(Array.isArray(clips))for(const clip of clips){
 const old=before[group].find(c=>c.id===clip.id);assert.ok(old);
 const a={...clip},b={...old};delete a.src;delete b.src;assert.deepEqual(a,b);
 if(!integration.repairs.some(r=>r.id===clip.id))assert.equal(clip.src,old.src);
}
const server=createStaticServer({root:resolve(root,'GameStarter/web-demo/.build'),onRequest:async(req,res)=>{
 if(req.url==='/__media_qa__'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><body></body></html>');return true;}return false;
}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],missing=[],result={passed:false,clips:[],opening:null,variants:[],errors,missing,subjectiveListening:false};
try{
 for(const r of integration.repairs){
  for(const host of [base,'http://127.0.0.1:8812']){
   const response=await fetch(host+r.src);assert.equal(response.status,200);
   const bytes=Buffer.from(await response.arrayBuffer()),sha=createHash('sha256').update(bytes).digest('hex');
   assert.equal(sha,r.sha256);assert.equal(sha,media.clips.find(x=>x.url===r.src).sha256);
  }
 }
 const queue=original.map(x=>({...x,src:config[x.group].find(c=>c.id===x.id).src}));
 await Promise.all(Array.from({length:4},async()=>{
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()===404)missing.push(r.url());});
  // Media-only checks must not replace the game's DOM while its async startup still owns it.
  await page.goto(base+'/__media_qa__');
  while(queue.length){
   const item=queue.shift();
   const info=await page.evaluate(async({url})=>{
    document.body.innerHTML='<video playsinline muted></video>';const v=document.querySelector('video');v.src=url;v.muted=true;v.playbackRate=1;
    const started=performance.now();
    await new Promise((ok,no)=>{v.onloadedmetadata=ok;v.onerror=()=>no(Error(v.error?.message));});
    const done=new Promise((ok,no)=>{v.onended=ok;v.onerror=()=>no(Error(v.error?.message));});
    await v.play();await done;
    return {duration:v.duration,wallSeconds:(performance.now()-started)/1000,rate:v.playbackRate,width:v.videoWidth,height:v.videoHeight,audio:v.webkitAudioDecodedByteCount,error:v.error?.message??null};
   },{url:base+item.src});
   assert.equal(info.rate,1);assert.equal(info.error,null);assert.ok(info.audio>0);assert.equal(info.width*9,info.height*16);
   assert.ok(info.wallSeconds>info.duration-.5);
   result.clips.push({id:item.id,index:item.index,...info});console.log('Played',item.index,item.id,info.duration);
  }
  await page.close();
 }));
 assert.equal(result.clips.length,34);
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('[data-action=new]').click();
 await page.waitForFunction(src=>document.querySelector('video')?.getAttribute('src')===src,config.opening[0].src);
 await page.locator('video').evaluate(v=>v.addEventListener('ended',()=>window.__openingEnded={duration:v.duration,error:v.error?.message??null},{once:true}));
 await page.waitForFunction(()=>window.__openingEnded,undefined,{timeout:65000});
 await page.waitForFunction(()=>document.querySelector('video')?.getAttribute('src')?.includes('SC03'));
 result.opening=await page.evaluate(()=>window.__openingEnded);result.nextVideo=await page.locator('video').getAttribute('src');
 await page.screenshot({path:resolve(out,'opening-to-sc03.png')});await page.close();
 const {ChapterSession}=await import(pathToFileURL(resolve(root,'GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js')));
 const content=read('content/chapters/wuzhang/chapter-one.script.json'),flow=read('content/chapters/wuzhang/chapter-one.flow.json');
 const version=read('GameStarter/web-demo/.build/story/session-manifest.json').contentVersion;
 for(const choice of ['a','b']){
  const session=new ChapterSession(content,flow,version,async input=>npcTurn(input,'ok',content.rows.find(r=>r.id==='A-40B').text));
  const drain=()=>{let n=0;while(session.snapshot().phase==='dialogue'&&n++<200)session.nextLine();};
  const act=id=>{const action=flow.actions.find(a=>a.id===id);if(session.snapshot().scene!==action.scene)assert.ok(session.move(action.scene));assert.ok(session.act(id));};
  session.finishCinematic();drain();act('read-notice');drain();act('meet-first-scout');drain();session.chooseScout(choice);drain();act('intercept-first');drain();
  session.setFocus('我来转呈');session.setDraft(firstTransfer);assert.ok(await session.confirmExpression());session.acknowledgeReply();drain();act('deliver-first');
  const ctx=await browser.newContext();await ctx.addInitScript(raw=>{localStorage.setItem('wuzhang-chapter-session-v1',raw);localStorage.setItem('wuzhang-voice-muted','1');},session.serialize());
  const view=await ctx.newPage();view.on('pageerror',e=>errors.push(e.message));await view.goto(base);await view.locator('[data-action=continue]').click();
  const expected=choice==='a'?'C1T06-06':'C1FIX06B';
  await view.waitForFunction(id=>document.querySelector('[data-story-film]')?.getAttribute('data-story-film')?.includes(id),expected);
  assert.equal(await view.locator('video').getAttribute('src'),config.chapterDialogue.find(c=>c.id===expected).src);
  const state=await view.evaluate(()=>JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1')));
  assert.equal(state.story.collected.includes('T02'),choice==='a');
  await view.locator('[data-cinema-action=skip]').click();await view.locator('[data-film-confirm]').click();
  const after=await view.evaluate(()=>JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1')));
  assert.equal(after.story.collected.includes('T02'),choice==='a');
  result.variants.push({choice,film:expected,noInventedClue:true});await ctx.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);result.passed=true;
}finally{
 result.clips.sort((a,b)=>a.index-b.index);writeFileSync(resolve(out,'browser-verification.json'),JSON.stringify(result,null,2));
 await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));
}
console.log(JSON.stringify({passed:result.passed,played:result.clips.length,variants:result.variants,opening:result.opening}));
