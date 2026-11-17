import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {parseVtt} from './subtitles.mjs';

const out=resolve('outputs/ch2-video-update-20261027');
const root=resolve(out,'build');mkdirSync(resolve(out,'browser'),{recursive:true});
const replacement=JSON.parse(readFileSync(resolve(out,'replacement.json'),'utf8'));
const server=createStaticServer({root});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results=[],errors=[];const queue=[...replacement.changes];
try{
 await Promise.all(Array.from({length:3},async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/received-film-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/cinematics.css"><link rel="stylesheet" href="/subtitles.css"><div id="game-root"></div>'}));
  await page.goto(base+'/received-film-fixture');
  await page.evaluate(async()=>{const {CinematicPlayer}=await import('/GameStarter/web-demo/src/cinematics.js');window.player=new CinematicPlayer('received-film-check','isolated-received-films');window.finished=0;});
  let row;
  while(row=queue.shift()){
   const clip=row.current,expected=parseVtt(readFileSync(resolve(root,'.'+clip.subtitles),'utf8'));
   await page.evaluate(c=>{player.dispose();finished=0;player.mount(document.querySelector('#game-root'),c.id,[c],'chapter-two',()=>finished++);document.querySelector('video').muted=true;},clip);
   await page.waitForFunction(()=>{const v=document.querySelector('video');return v?.readyState>=2&&v.querySelector('track')?.readyState===2;},null,{timeout:25000});
   const actual=await page.locator('video').evaluate(v=>{v.pause();return {src:new URL(v.currentSrc).pathname,duration:v.duration,cues:Array.from(v.textTracks[0].cues??[]).map(c=>({start:c.startTime,end:c.endTime,text:c.text})),mode:v.textTracks[0].mode};});
   assert.equal(actual.src,clip.src);assert.deepEqual(actual.cues,expected);assert.equal(actual.mode,'showing');
   for(const cue of expected){assert.ok(cue.end<=actual.duration+.15);assert.ok(cue.start>=0&&cue.end>cue.start);}
   for(const cue of [expected[0],expected.at(-1)]){
    await page.locator('video').evaluate(async(v,t)=>{await new Promise(ok=>{v.addEventListener('seeked',ok,{once:true});v.currentTime=t;});},(cue.start+cue.end)/2);
    await page.waitForFunction(text=>Array.from(document.querySelector('video').textTracks[0].activeCues??[]).some(c=>c.text===text),cue.text);
   }
   if(['CH2-V25-02','CH2-V19B','CH2-V21b'].includes(clip.id))await page.screenshot({path:resolve(out,'browser',clip.id+'-subtitle.png')});
   // Full playback from the first frame at 4x, without seeking or skipping.
   await page.locator('video').evaluate(async v=>{v.currentTime=0;v.playbackRate=4;await v.play();});
   await page.waitForFunction(()=>finished===1,null,{timeout:40000});
   results.push({id:clip.id,src:actual.src,duration:actual.duration,cues:expected.length,firstAndLastCueActive:true,naturallyEnded:true,playbackRate:4});
   writeFileSync(resolve(out,'browser/media-progress.json'),JSON.stringify({done:results.length,total:replacement.changes.length,last:clip.id}));
  }
  await page.close();
 }));
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(out,'browser/media-results.json'),JSON.stringify({passed:true,results,errors,humanListeningReview:false,userApproved:false},null,2));
 console.log(JSON.stringify({passed:true,clips:results.length,cues:results.reduce((n,r)=>n+r.cues,0),errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
