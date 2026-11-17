import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`,out='video/review/20261025-li01';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
console.log('browser ready');
const page=await browser.newPage({viewport:{width:1366,height:768}}),report={errors:[],missing:[],subjectiveAudioReview:false};
page.setDefaultTimeout(20000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
try{
 await page.goto(base+'/?chapter=grain',{waitUntil:'domcontentloaded'});console.log('page ready');await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);console.log('video ready');
 assert.match(await page.locator('video').getAttribute('src'),/LI01-slip-continuous-20261025/);
 await page.locator('video').evaluate(v=>{
  window.openingFrames=[];
  const frame=(_,m)=>{window.openingFrames.push(m.mediaTime);if(!v.ended)v.requestVideoFrameCallback(frame);};v.requestVideoFrameCallback(frame);
  v.addEventListener('ended',()=>{window.openingResult={ended:v.ended,duration:v.duration,quality:{totalVideoFrames:v.getVideoPlaybackQuality().totalVideoFrames,droppedVideoFrames:v.getVideoPlaybackQuality().droppedVideoFrames},audioBytes:v.webkitAudioDecodedByteCount,error:v.error?.message??null};},{once:true});void v.play();
 });
 await page.waitForFunction(()=>document.querySelector('video')?.currentTime>=4.9);await page.screenshot({path:out+'/cut-in-game.png'});
 await page.waitForFunction(()=>document.querySelector('video')?.getAttribute('src')?.includes('LI02A-granary'),null,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 report.playback=await page.evaluate(()=>window.openingResult);assert.equal(report.playback.ended,true);assert.equal(report.playback.error,null);
 report.monotonic=await page.evaluate(()=>window.openingFrames.every((t,i,a)=>!i||t>=a[i-1]));assert.equal(report.monotonic,true);
 assert.ok(report.playback.audioBytes>0);
 report.nextFilm='LI02A';await page.screenshot({path:out+'/inquiry-in-game.png'});
 await page.locator('[data-cinema-action=skip]').click();await page.locator('#spoken-line').waitFor();assert.match(await page.locator('#spoken-line').innerText(),/第四次北伐/);
 for(let i=0;i<4;i++)await page.locator('[data-action=next]').click();
 await page.locator('video').waitFor();assert.match(await page.locator('video').getAttribute('src'),/LI02B-full-speed/);
 report.recognitionFilm='LI02B';assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;
 writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.log('failure',e.message,await page.locator('body').innerText());throw e;}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
