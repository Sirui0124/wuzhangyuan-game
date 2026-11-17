import {chromium} from 'playwright';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const server=createStaticServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const report={clips:[],opening:[],errors:[],subjectiveListening:false};let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext();
 const config=await fetch(base+'/cinematics.json').then(r=>r.json());
 await Promise.all([...config.sacrifice,...config.safe,...config.chapterPreview,...config.reviewOnly].map(async clip=>{
  const page=await context.newPage();await page.goto(base+'/video-review.html');
  await page.getByRole('button',{name:clip.id+' · '+clip.title,exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('video').ended,null,{timeout:60000});
  const info=await page.locator('video').evaluate(v=>({duration:v.duration,time:v.currentTime,ended:v.ended,error:v.error?.message??null,frames:v.getVideoPlaybackQuality().totalVideoFrames}));
  assert.equal(info.error,null);assert(info.frames>0);report.clips.push({id:clip.id,...info});await page.close();
 }));
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base);
 await page.locator('[data-action=menu-new]').click();
 for (const clip of config.opening){
  await page.waitForFunction(src=>document.querySelector('video')?.getAttribute('src')===src,clip.src,{timeout:60000});
  report.opening.push(clip.id);
  await page.waitForFunction(src=>document.querySelector('video')?.getAttribute('src')!==src,clip.src,{timeout:60000});
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
 console.log(JSON.stringify(report));
}finally{writeFileSync('video/review/20261018-integration/browser-playback.json',JSON.stringify(report,null,2));await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
