import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const output='video/review/20261022-integration';mkdirSync(output,{recursive:true});
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const report={clips:[],opening:[],previews:[],errors:[],missing:[],subjectiveListening:false};
context.on('page',page=>{page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});});
try {
 const config=await fetch(base+'/cinematics.json').then(r=>r.json());
 // Each actual served asset must decode through its final frame in Chrome, including audio tracks.
 await Promise.all(Object.values(config).flat().map(async clip=>{
   const page=await context.newPage();await page.goto(base+'/video-review.html');
   await page.getByRole('button',{name:clip.id+' · '+clip.title,exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
   await page.locator('video').evaluate(v=>v.playbackRate=2);
   await page.waitForFunction(()=>document.querySelector('video').ended,null,{timeout:90000});
   const info=await page.locator('video').evaluate(v=>({duration:v.duration,ended:v.ended,error:v.error?.message??null,frames:v.getVideoPlaybackQuality().totalVideoFrames,audioBytes:v.webkitAudioDecodedByteCount}));
   assert.equal(info.error,null);assert(info.frames>0);assert(info.audioBytes>0);report.clips.push({id:clip.id,...info});await page.close();
 }));
 const page=await context.newPage();await page.goto(base);await page.locator('[data-action=new]').click();
 for(const clip of config.opening){
   await page.waitForFunction(src=>document.querySelector('video')?.getAttribute('src')===src,clip.src);
   await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
   if(!report.opening.length){
     await page.locator('[data-cinema-action=toggle]').click();assert(await page.locator('video').evaluate(v=>v.paused));
     await page.locator('[data-cinema-action=toggle]').click();
     await page.screenshot({path:output+'/opening-in-game.png'});
   }
   await page.locator('[data-cinema-rate="2"]').click();report.opening.push(clip.id);
   await page.waitForFunction(src=>document.querySelector('video')?.getAttribute('src')!==src,clip.src,{timeout:90000});
 }
 await page.locator('.game-scene').waitFor();
 await page.locator('[data-action=menu]').click();await page.locator('[data-action=chapters]').click();
 const saved=await page.evaluate(()=>localStorage.getItem('wuzhang-chapter-session-v1'));assert(saved);
 await page.screenshot({path:output+'/chapter-map-videos.png'});
 for(const clip of config.chapterScenes){
   await page.locator(`[data-preview-clip="${clip.id}"]`).click();
   await page.waitForFunction(src=>document.querySelector('video')?.getAttribute('src')===src,clip.src);
   await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
   await page.locator('[data-cinema-rate="2"]').click();
   await page.locator('.chapter-map').waitFor({timeout:60000});report.previews.push(clip.id);
   assert.equal(await page.evaluate(()=>localStorage.getItem('wuzhang-chapter-session-v1')),saved);
 }
 await page.locator('[data-action=chapter-preview]').click();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 await page.locator('.cinema-seek').fill('2');assert((await page.locator('video').evaluate(v=>v.currentTime))>=1.9);
 await page.locator('[data-cinema-action=skip]').click();await page.locator('.chapter-map').waitFor();
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;
 console.log(JSON.stringify(report,null,2));
} finally {
 writeFileSync(output+'/browser-playback.json',JSON.stringify(report,null,2));await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));
}
