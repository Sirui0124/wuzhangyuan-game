import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const out='video/review/20261022-new1022';
const base='http://127.0.0.1:8812';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const report={errors:[],missing:[],clips:[],subjectiveListening:false};
context.on('page',p=>{p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});});
async function watch(page,id){
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 const src=await page.locator('video').getAttribute('src');assert(src.includes('new1022'));
 await page.locator('video').evaluate((v,id)=>{window.results??={};window.times??={};window.times[id]=[];
  const cb=(_,m)=>{window.times[id].push(m.mediaTime);if(!v.ended)v.requestVideoFrameCallback(cb);};v.requestVideoFrameCallback(cb);
  v.addEventListener('ended',()=>{window.results[id]={src:v.getAttribute('src'),duration:v.duration,ended:v.ended,rate:v.playbackRate,frames:v.getVideoPlaybackQuality().totalVideoFrames,dropped:v.getVideoPlaybackQuality().droppedVideoFrames,audioBytes:v.webkitAudioDecodedByteCount,error:v.error?.message??null};},{once:true});
 },id);
 await page.waitForFunction(id=>window.results?.[id]?.ended,id,{timeout:80000});
 const r=await page.evaluate(id=>window.results[id],id);assert.equal(r.error,null);assert.equal(r.rate,1);assert(r.audioBytes>0);assert(r.frames>200);
 const ts=await page.evaluate(id=>window.times[id],id);assert(ts.every((t,i)=>!i||t>=ts[i-1]));report.clips.push({id,...r,monotonicTimestamps:true});
}
try{
 await Promise.all([
  (async()=>{const p=await context.newPage();await p.goto(base);await p.locator('[data-action=chapters]').click();const saved=await p.evaluate(()=>localStorage.getItem('wuzhang-chapter-session-v1'));await p.locator('[data-action=chapter-preview]').click();await watch(p,'LI01');await p.waitForFunction(()=>document.querySelector('video')?.getAttribute('src')==='/video/current/LI02A-granary-20261018.mp4');report.li01Next='LI02A';await p.locator('[data-cinema-action=skip]').click();await p.locator('.chapter-map').waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('wuzhang-chapter-session-v1')),saved);report.previewSaveUnchanged=true;await p.close();})(),
  (async()=>{const separate=await browser.newContext({viewport:{width:1440,height:900}});const p=await separate.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(base);await p.locator('[data-action=new]').click();await watch(p,'PR01');await p.waitForFunction(()=>document.querySelector('video')?.getAttribute('src')==='/video/current/SC03-full-speed-20261022.mp4');report.openingNext='SC03';await p.screenshot({path:out+'/opening-next-SC03.png'});await separate.close();})()
 ]);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;console.log(JSON.stringify(report,null,2));
}finally{writeFileSync(out+'/browser-playback.json',JSON.stringify(report,null,2));await browser.close();}
