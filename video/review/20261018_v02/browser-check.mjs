import {chromium} from 'playwright';
import {createStaticServer} from '../../../GameStarter/web-demo/serve.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const dir=resolve('video/review/20261018_v02'),manifest=[{id:'PR01-v02',file:'PR01-prologue-27s-clean-v02.mp4'}];
const report={clips:[],errors:[],checks:['Isolated localhost review root, no game config/state changed'],mode:'sampled real browser playback plus full FFmpeg decode'};
const server=createStaticServer({root:dir});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base=`http://127.0.0.1:${server.address().port}`;let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto(base+'/evidence/edit-manifest.json');
 for(const clip of manifest){
  const url=base+'/'+clip.file;const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-type'),'video/mp4');const range=await fetch(url,{headers:{Range:'bytes=0-31'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,32);
  const result=await page.evaluate(async({clip})=>{
   const v=document.createElement('video');v.src='/'+clip.file;v.controls=true;v.muted=true;document.body.replaceChildren(v);await new Promise((ok,no)=>{v.onloadedmetadata=ok;v.onerror=()=>no(new Error('decode error'));});const samples=[];
   for(const time of [.1,v.duration/2,v.duration-.25]){v.currentTime=time;await new Promise(ok=>v.onseeked=ok);await v.play();await new Promise(ok=>setTimeout(ok,400));v.pause();samples.push({requested:time,actual:v.currentTime,decoded:v.getVideoPlaybackQuality().totalVideoFrames,error:v.error?.message??null,readyState:v.readyState});}
   const ctx=new AudioContext();const pcm=await ctx.decodeAudioData(await fetch(v.src).then(r=>r.arrayBuffer()));const audio={duration:pcm.duration,channels:pcm.numberOfChannels,sampleRate:pcm.sampleRate};await ctx.close();return {id:clip.id,file:clip.file,duration:v.duration,size:[v.videoWidth,v.videoHeight],rate:v.playbackRate,samples,audio};
  },{clip});assert(result.samples.every(s=>!s.error&&s.readyState>=2&&s.decoded>0));report.clips.push(result);console.log(clip.id,'browser PASS',result.duration);
 }
 assert.equal(report.errors.length,0);report.success=true;
}finally{writeFileSync(resolve(dir,'evidence/browser-validation.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(ok=>server.close(ok));}
