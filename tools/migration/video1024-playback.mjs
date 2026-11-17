import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8812',out=resolve('video/review/20261024-integration');mkdirSync(out,{recursive:true});
const expected=JSON.parse(readFileSync(resolve(out,'edits.json')));
const config=await(await fetch(base+'/cinematics.json')).json();
assert.deepEqual(config,JSON.parse(readFileSync('GameStarter/web-demo/public/cinematics.json')));
for(const edit of expected){
 const response=await fetch(base+edit.src);assert.equal(response.status,200);
 assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),edit.sha256);
}
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base);await page.locator('[data-action=new]').click();
 const playback=[];
 for(const clip of config.opening.slice(0,4)){
  await page.waitForFunction(src=>document.querySelector('video')?.getAttribute('src')===src,clip.src);
  await page.locator('video').evaluate(v=>v.addEventListener('ended',()=>window.__lastEnded={src:v.getAttribute('src'),duration:v.duration,rate:v.playbackRate,audioBytes:v.webkitAudioDecodedByteCount,error:v.error?.message??null},{once:true}));
  await page.waitForFunction(src=>window.__lastEnded?.src===src,clip.src,{timeout:45000});
  const ended=await page.evaluate(()=>window.__lastEnded);assert.equal(ended.error,null);assert.equal(ended.rate,1);assert.ok(ended.audioBytes>0);playback.push(ended);
  console.log('Natural playback completed:',clip.id);
 }
 await page.waitForFunction(()=>document.querySelector('video')?.src.includes('SC03'));
 await page.screenshot({path:resolve(out,'opening-to-sc03.png')});
 // Decode all five story cuts in the browser, including their exact final frame and audio track.
 const story=[];
 for(const edit of expected.filter(x=>x.rows.length)){
  const result=await page.evaluate(async src=>{
   const v=document.createElement('video');v.muted=true;v.src=src;document.body.append(v);
   await new Promise((ok,no)=>{v.onloadedmetadata=ok;v.onerror=()=>no(Error(v.error?.message));});
   const metadata={duration:v.duration,width:v.videoWidth,height:v.videoHeight};v.currentTime=v.duration-.3;await v.play();await new Promise(ok=>v.onended=ok);
   const result={...metadata,src,audioBytes:v.webkitAudioDecodedByteCount,error:v.error?.message??null};v.remove();return result;
  },edit.src);
  assert.ok(result.width>0&&result.duration>0&&result.audioBytes>0&&!result.error);story.push(result);
 }
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(out,'browser-playback.json'),JSON.stringify({passed:true,servedHashes:expected.length,opening:playback,next:'SC03',story,errors,subjectiveListening:false},null,2));
}finally{await browser.close();}
