import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const output=resolve(process.env.TYPOGRAPHY_OUTPUT ?? 'outputs/chapter-typography-20261026');mkdirSync(output,{recursive:true});
const baseline=process.argv.includes('--baseline');
const manifest=JSON.parse(readFileSync('GameStarter/web-demo/public/cinematics.json','utf8'));
const clip=Object.values(manifest).flat().find(c=>c.subtitles?.includes('CH2-V10-'));
assert.ok(clip,'Locate the exact reported subtitle clip');
const index=readFileSync('GameStarter/web-demo/public/index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'');
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{
 for(const [width,height] of baseline?[[1440,900]]:[[1440,900],[1920,1080],[390,844],[844,390]]){
  let reference;
  for(const chapter of [1,2,3]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
   await page.route('**/typography-fixture',route=>route.fulfill({contentType:'text/html',body:index}));
   await page.goto(`http://127.0.0.1:${server.address().port}/typography-fixture`);
   if(chapter===2)await page.addStyleTag({url:'/grain-films.css'});
   await page.evaluate(async clip=>{
    const {CinematicPlayer}=await import('/GameStarter/web-demo/src/cinematics.js');
    const root=document.querySelector('#game-root');root.innerHTML='';
    new CinematicPlayer('typography-fixture').mount(root,'sample',[clip],'story',()=>{});
    const video=root.querySelector('video');video.muted=true;
   },clip);
   await page.waitForFunction(()=>{const v=document.querySelector('video');return v.readyState>=2&&v.textTracks[0]?.cues?.length>0;});
   await page.waitForFunction(()=>document.querySelector('.cinema-screen')?.dataset.mediaState==='ready');
   assert.equal(await page.locator('#video-status').textContent(),'','A redundant mute notice must not cover subtitles');
   await page.locator('video').evaluate(async v=>{v.pause();if(Math.abs(v.currentTime-9)>.01)await new Promise(ok=>{v.addEventListener('seeked',ok,{once:true});v.currentTime=9;});});
   await page.waitForFunction(()=>Array.from(document.querySelector('video').textTracks[0].activeCues??[]).some(c=>c.text.includes('饮酒误军')));
   await page.evaluate(()=>document.fonts.ready);
   await page.mouse.move(0,0);
   await page.waitForTimeout(120);
   const shot=await page.locator('video').screenshot({path:resolve(output,`${baseline?'before':'after'}-chapter-${chapter}-${width}.png`)});
   // Same decoder frame, cue and viewport, differing only in chapter CSS. This compares native cue pixels too.
   const equal=chapter===1||shot.equals(reference);if(chapter===1)reference=shot;
   results.push({chapter,width,height,identicalToChapterOne:equal});
   if(!baseline)assert.ok(equal,`Chapter ${chapter} native subtitle must match chapter one at ${width}x${height}`);
   await page.close();
  }
 }
 writeFileSync(resolve(output,baseline?'baseline.json':'verification.json'),JSON.stringify({results,chapterThree:'Shared-renderer contract fixture; no chapter-three gameplay claimed.'},null,2));
 console.log(JSON.stringify(results));
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
