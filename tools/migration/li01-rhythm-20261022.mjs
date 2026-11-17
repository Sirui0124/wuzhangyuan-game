import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const output='video/review/20261022-li01-rhythm';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const report={errors:[],missing:[],subjectiveListening:false};
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
 await page.goto('http://127.0.0.1:8812/');await page.locator('[data-action=chapters]').click();
 const saved=await page.evaluate(()=>localStorage.getItem('wuzhang-chapter-session-v1'));
 await page.locator('[data-action=chapter-preview]').click();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 const src=await page.locator('video').getAttribute('src');assert(src.endsWith('LI01-AB-slip-tightened-20261022.mp4'));
 await page.locator('video').evaluate(v=>{
   window.li01FrameTimes=[];
   const frame=(_,m)=>{window.li01FrameTimes.push(m.mediaTime);if(!v.ended)v.requestVideoFrameCallback(frame);};v.requestVideoFrameCallback(frame);
   v.addEventListener('ended',()=>{window.li01Result={src:v.getAttribute('src'),ended:v.ended,duration:v.duration,rate:v.playbackRate,quality:{totalVideoFrames:v.getVideoPlaybackQuality().totalVideoFrames,droppedVideoFrames:v.getVideoPlaybackQuality().droppedVideoFrames},audioBytes:v.webkitAudioDecodedByteCount,error:v.error?.message??null};},{once:true});
 });
 await page.locator('[data-cinema-action=toggle]').click();assert(await page.locator('video').evaluate(v=>v.paused));await page.locator('[data-cinema-action=toggle]').click();
 await page.waitForFunction(()=>document.querySelector('video')?.currentTime>=7.2);
 await page.locator('[data-cinema-action=toggle]').click();await page.screenshot({path:output+'/slip-in-live-game.png'});await page.locator('[data-cinema-action=toggle]').click();
 await page.waitForFunction(()=>window.li01Result?.ended,null,{timeout:40000});
 report.playback=await page.evaluate(()=>window.li01Result);assert.equal(report.playback.error,null);assert.equal(report.playback.rate,1);assert(report.playback.audioBytes>0);
 const times=await page.evaluate(()=>window.li01FrameTimes);assert(times.length>400);assert(times.every((x,i)=>i===0||x>=times[i-1]));report.monotonicMediaTimes=true;
 await page.waitForFunction(()=>document.querySelector('video')?.getAttribute('src')==='/video/current/LI02A-granary-20261018.mp4');
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);report.nextClip='LI02A';
 await page.locator('[data-cinema-action=skip]').click();await page.locator('.chapter-map').waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('wuzhang-chapter-session-v1')),saved);report.storySaveUnchanged=true;
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;console.log(JSON.stringify(report,null,2));
} finally {writeFileSync(output+'/browser-playback.json',JSON.stringify(report,null,2));await browser.close();}
