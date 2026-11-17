import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {parseVtt} from './subtitles.mjs';
const prod=resolve('video/production/player-voice-repair-20261027');
const out=resolve('outputs/player-voice-repair-20261027');mkdirSync(out,{recursive:true});
const root=resolve(process.env.GAME_BUILD||resolve(out,'build'));const integration=JSON.parse(readFileSync(resolve(prod,'integration.json'),'utf8'));
const server=createStaticServer({root});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const queue=[...integration.changes],results=[],errors=[];
try{
 await Promise.all(Array.from({length:3},async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/voice-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/cinematics.css"><link rel="stylesheet" href="/subtitles.css"><div id="host"></div>'}));
  await page.goto(base+'/voice-fixture');
  await page.evaluate(async()=>{const {CinematicPlayer}=await import('/GameStarter/web-demo/src/cinematics.js');window.player=new CinematicPlayer('voice-repair-check','voice-repair-isolated');window.finished=0;});
  let row;
  while(row=queue.shift()){
   const clip=row.current,expected=parseVtt(readFileSync(resolve(root,'.'+clip.subtitles),'utf8'));
   await page.evaluate(c=>{player.dispose();finished=0;player.mount(document.querySelector('#host'),c.id,[c],'voice-check',()=>finished++);document.querySelector('video').muted=true;},clip);
   await page.waitForFunction(()=>{const v=document.querySelector('video');return v?.readyState>=2&&v.querySelector('track')?.readyState===2;},null,{timeout:25000});
   const actual=await page.locator('video').evaluate(v=>{v.pause();return {src:new URL(v.currentSrc).pathname,duration:v.duration,cues:Array.from(v.textTracks[0].cues??[]).map(c=>({start:c.startTime,end:c.endTime,text:c.text})),audioTracks:v.webkitAudioDecodedByteCount};});
   assert.equal(actual.src,clip.src);assert.deepEqual(actual.cues,expected);
   for(const cue of expected){assert.ok(cue.start>=0&&cue.end>cue.start);assert.ok(cue.end<=actual.duration+.15);}
   for(const cue of [expected[0],expected.at(-1)]){
    await page.locator('video').evaluate(async(v,t)=>{await new Promise(ok=>{v.addEventListener('seeked',ok,{once:true});v.currentTime=t;});},(cue.start+cue.end)/2);
    await page.waitForFunction(text=>Array.from(document.querySelector('video').textTracks[0].activeCues??[]).some(c=>c.text===text),cue.text);
   }
   if(['C1FIX09','CH2-V02','CH2-V40'].includes(clip.id))await page.screenshot({path:resolve(out,clip.id+'-subtitles.png')});
   await page.locator('video').evaluate(async v=>{window.voiceAudioBytes=v.webkitAudioDecodedByteCount||0;v.addEventListener('timeupdate',()=>{window.voiceAudioBytes=Math.max(window.voiceAudioBytes,v.webkitAudioDecodedByteCount||0);});v.currentTime=0;v.playbackRate=4;await v.play();});
   await page.waitForFunction(()=>finished===1,null,{timeout:45000});
   const audioDecoded=await page.evaluate(()=>window.voiceAudioBytes);
   assert.ok(audioDecoded>0,'Browser decoded no audio');
   results.push({id:clip.id,src:actual.src,duration:actual.duration,cues:expected.length,firstAndLastCueActive:true,audioDecodedBytes:audioDecoded,naturallyEnded:true,playbackRate:4});
   writeFileSync(resolve(out,'browser-progress.json'),JSON.stringify({done:results.length,total:integration.changes.length,last:clip.id}));
  }
  await page.close();
 }));
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({passed:true,results,errors,humanListeningReview:false,userApproved:false},null,2));
 console.log(JSON.stringify({passed:true,clips:results.length,cues:results.reduce((n,r)=>n+r.cues,0),errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
