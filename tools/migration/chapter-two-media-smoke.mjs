import {chromium} from 'playwright';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out='outputs/video-integration-20261025';
const root=resolve(out,'build');
const clips=JSON.parse(readFileSync(root+'/cinematics.json')).chapterTwo;
const server=createStaticServer({root});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'chrome'});
const results=[];
try {
 const queue=[...clips];
 await Promise.all(Array.from({length:3},async()=>{
  const page=await browser.newPage();await page.goto(base+'/local-media-test',{waitUntil:'domcontentloaded'});
  let c;
  while(c=queue.shift()){
   const result=await page.evaluate(async ({c,base})=>{
    document.body.innerHTML='';const v=document.createElement('video');v.muted=true;v.playsInline=true;v.style.width='960px';document.body.append(v);
    const t=document.createElement('track');t.kind='subtitles';t.srclang='zh';t.default=true;t.src=base+c.subtitles;v.append(t);
    v.src=base+c.src;v.playbackRate=c.id==='CH2-V01'?1:4;
    const outcome=await new Promise(resolve=>{
     const timer=setTimeout(()=>resolve({error:'playback timeout'}),120000);
     v.addEventListener('error',()=>{clearTimeout(timer);resolve({error:v.error?.message});},{once:true});
     v.addEventListener('ended',()=>{clearTimeout(timer);resolve({ended:true,duration:v.duration,rate:v.playbackRate});},{once:true});
     void v.play().catch(e=>{clearTimeout(timer);resolve({error:e.message});});
    });
    const cues=Array.from(t.track.cues??[]).map(x=>({text:x.text,start:x.startTime,end:x.endTime}));
    const result={...outcome,cues,trackState:t.readyState};v.pause();v.removeAttribute('src');v.load();return result;
   },{c,base});
   assert.equal(result.ended,true,c.id+' '+JSON.stringify(result));assert.equal(result.trackState,2,c.id+' track');
   for(const cue of result.cues){assert.ok(cue.end>cue.start,c.id);assert.ok(cue.start<result.duration&&cue.end<=result.duration+.15,c.id+' cue outside movie');}
   results.push({id:c.id,duration:result.duration,rate:result.rate,cues:result.cues.length,naturallyEnded:true});
   writeFileSync(out+'/browser/media-progress.json',JSON.stringify({completed:results.length,total:clips.length,last:c.id}));
  }
  await page.close();
 }));
 writeFileSync(out+'/browser/media-results.json',JSON.stringify({passed:true,clips:results,humanAudiovisualReview:false},null,2));
 console.log(JSON.stringify({passed:true,clips:results.length,cues:results.reduce((n,x)=>n+x.cues,0)}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
