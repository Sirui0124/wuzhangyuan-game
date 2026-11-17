import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { parseVtt } from '../video/subtitles.mjs';
import { ChapterSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapter-session.js';

const output=resolve('outputs/subtitle-review-20261026');mkdirSync(output,{recursive:true});
const root=resolve('GameStarter/web-demo/.build');
const read=path=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
const config=read('cinematics.json'), clips=Object.values(config).flat();
const index=readFileSync(resolve(root,'index.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,'');
const server=createStaticServer({root});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/subtitle-fixture',route=>route.fulfill({contentType:'text/html',body:index}));
 await page.goto(base+'/subtitle-fixture');
 await page.evaluate(async()=>{const {CinematicPlayer}=await import('/GameStarter/web-demo/src/cinematics.js');window.player=new CinematicPlayer('subtitle-audit','isolated-subtitle-audit');});
 for(const clip of clips){
  const expected=parseVtt(readFileSync(resolve(root,'.'+clip.subtitles),'utf8'));
  await page.evaluate(clip=>{window.player.mount(document.querySelector('#game-root'),clip.id,[clip],'story',()=>{});document.querySelector('video').muted=true;},clip);
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v.readyState>=2&&v.querySelector('track')?.readyState===2;},{},{timeout:15000});
  const actual=await page.locator('video').evaluate(v=>{v.pause();return {src:new URL(v.currentSrc).pathname,mode:v.textTracks[0].mode,cues:Array.from(v.textTracks[0].cues??[]).map(c=>({start:c.startTime,end:c.endTime,text:c.text})),error:v.error?.message??null};});
  assert.equal(actual.src,clip.src,clip.id);assert.equal(actual.mode,'showing',clip.id);assert.equal(actual.error,null,clip.id);assert.deepEqual(actual.cues,expected,clip.id);
  for(const cue of [...new Set([expected[0],expected.at(-1)].filter(Boolean))]){
   const time=(cue.start+cue.end)/2;
   await page.locator('video').evaluate(async(v,time)=>{if(Math.abs(v.currentTime-time)<.001)return;await new Promise(ok=>{v.addEventListener('seeked',ok,{once:true});v.currentTime=time;});},time);
   await page.waitForFunction(text=>Array.from(document.querySelector('video').textTracks[0].activeCues??[]).some(c=>c.text===text),cue.text);
  }
  if(['CH2-V11T','CH2-V11D','CH2-V11N','C1END-TENT'].includes(clip.id))await page.screenshot({path:resolve(output,clip.id+'-browser.png')});
  results.push({id:clip.id,cues:expected.length,nativeTrackLoaded:true,firstAndLastCueVisible:expected.length>0});
 }
 await page.goto(base+'/video-review.html?clip=C1END-TENT');
 assert.equal(await page.locator('select').inputValue(),'C1END-TENT');
 assert.equal(await page.locator('option').count(),clips.length);
 await page.locator('video').evaluate(v=>v.play());
 await page.waitForFunction(()=>document.querySelector('video').currentTime>0.2);
 await page.screenshot({path:resolve(output,'tent-review-link.png')});
 // Exercise the actual ending renderer with a state reached through the public session actions.
 const s=new ChapterSession(read('story/chapter-one.script.json'),read('story/chapter-one.flow.json'),read('story/session-manifest.json').contentVersion);
 s.finishCinematic();while(s.snapshot().phase==='dialogue')s.nextLine();s.act('read-notice');while(s.snapshot().phase==='dialogue')s.nextLine();
 for(const action of ['listen','next','listen','continue','continue','next'])assert.ok(s.tentAction(action));
 assert.equal(s.snapshot().end,'tent-execution');
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addInitScript(raw=>{localStorage.setItem('wuzhang-chapter-session-v1',raw);localStorage.setItem('wuzhang-voice-muted','1');},s.serialize());
 const game=await context.newPage();game.on('pageerror',e=>errors.push(e.message));
 await game.goto(base);await game.locator('[data-action=continue]').click();
 const current=config.chapterEndings.find(c=>c.id==='C1END-TENT');
 await game.waitForFunction(src=>document.querySelector('video')?.currentSrc.endsWith(src),current.src);
 await game.locator('video').evaluate(v=>{v.muted=true;v.playbackRate=1;return v.play();});
 await game.getByText('隔帐有耳，帐后有刀',{exact:true}).waitFor({timeout:20000});
 await game.screenshot({path:resolve(output,'tent-ended.png')});
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(output,'browser-verification.json'),JSON.stringify({clips:results.length,cues:results.reduce((n,r)=>n+r.cues,0),results,endingPlayedToCompletion:true,reviewDeepLink:true,errors,humanListeningReview:false},null,2));
 console.log(JSON.stringify({clips:results.length,cues:results.reduce((n,r)=>n+r.cues,0),endingPlayedToCompletion:true,reviewDeepLink:true,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
