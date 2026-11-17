import {chromium} from 'playwright';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {GrainSession} from '../../outputs/ch2-bedside-choice-20261025/build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const story=JSON.parse(readFileSync('content/chapters/grain/chapter-two.films.json'));
const rubric=JSON.parse(readFileSync('content/chapters/grain/chapter-two.films-rubric.json'));
const out='outputs/ch2-bedside-choice-20261025';mkdirSync(out,{recursive:true});
const server=createStaticServer({root:resolve(out+'/build')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'chrome'}),report=[];
const base=`http://127.0.0.1:${server.address().port}`;
async function at(page,id){await page.waitForFunction(id=>document.querySelector('#game-root')?.getAttribute('data-node')===id,id);}
async function ready(page){await page.waitForFunction(()=>{const v=document.querySelector('video');return v?.readyState>=2});}
async function pixels(page,time){return page.locator('video').evaluate(async(v,t)=>{v.pause();if(Math.abs(v.currentTime-t)>.01){v.currentTime=t;await new Promise(r=>v.addEventListener('seeked',r,{once:true}));}const c=document.createElement('canvas');c.width=64;c.height=36;const ctx=c.getContext('2d');ctx.drawImage(v,0,0,64,36);return [...ctx.getImageData(0,0,64,36).data];},time);}
try{
 for(const choice of ['A','B','C']){
  const s=new GrainSession(story,undefined,rubric,false);while(s.current.id!=='V04')s.advance(s.current.options?.[0]?.id);
  const context=await browser.newContext({viewport:{width:1366,height:768}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(save=>{localStorage.setItem('wuzhang-runtime-mode-v1','offline');if(!localStorage.getItem('grain-chapter-two-films-v1'))localStorage.setItem('grain-chapter-two-films-v1',JSON.stringify(save));},s.state);
  await page.goto(base+'/?chapter=grain');await at(page,'V04');await ready(page);
  assert.ok(Math.abs(await page.locator('video').evaluate(v=>v.duration)-131/24)<.1);
  await page.locator('video').evaluate(v=>{v.playbackRate=4;return v.play()});await at(page,'UI-BEDSIDE');
  await page.locator('.choice-layout').waitFor();assert.equal(await page.locator('[data-option]').count(),3);
  const bg=await page.locator('.scene-image').evaluate(e=>({size:getComputedStyle(e).backgroundSize,animation:getComputedStyle(e).animationName,url:getComputedStyle(e).backgroundImage}));assert.equal(bg.size,'contain');assert.equal(bg.animation,'none');assert.match(bg.url,/CH2-bedside-choice/);
  await page.waitForTimeout(400);await page.screenshot({path:out+'/choice-'+choice+'.png'});
  await page.reload();await at(page,'UI-BEDSIDE');
  await page.locator(`[data-option="CH2-LY02-Q${choice}"]`).click();await at(page,'V04'+choice);await ready(page);
  const a=await pixels(page,.5),b=await pixels(page,3.5);const difference=a.reduce((sum,x,i)=>sum+Math.abs(x-b[i]),0)/a.length;assert.ok(difference<1,`static frame moved: ${difference}`);
  await page.waitForFunction(()=>document.querySelector('video')?.textTracks[0]?.cues?.length>0);
  const captions=await page.locator('video').evaluate(v=>[...v.textTracks[0].cues].map(c=>({text:c.text,line:c.line})));assert.ok(captions.every(c=>c.line===-2));assert.ok(!captions.some(c=>/六月初二|那咱们确实是误了|那是我多心了/.test(c.text)));
  await page.screenshot({path:out+'/voice-'+choice+'.png'});
  await page.locator('video').evaluate(v=>{v.playbackRate=4;return v.play()});await at(page,'V04-END');await ready(page);
  await page.locator('video').evaluate(v=>{v.playbackRate=4;return v.play()});await at(page,'V05');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('grain-chapter-two-films-v1')));const restored=new GrainSession(story,saved,rubric,false);
  assert.deepEqual(restored.scores,{trust:choice==='B'?3:choice==='C'?1:2,rigor:choice==='A'?1:0,responsibility:1});assert.ok(!restored.clues.some(c=>c.id==='LY-X06'));assert.deepEqual(errors,[]);
  report.push({choice,scores:restored.scores,staticMeanPixelDifference:difference,captions,errors});await context.close();
 }
 // Original opening replies now use the outgoing shot, too.
 for(const option of ['CH2-LY02-003','CH2-LY02-004']){
  const s=new GrainSession(story,undefined,rubric,false);while(s.current.id!=='CH2-LY02-002')s.advance(s.current.options?.[0]?.id);
  const context=await browser.newContext();const page=await context.newPage();await page.addInitScript(save=>{localStorage.setItem('wuzhang-runtime-mode-v1','offline');localStorage.setItem('grain-chapter-two-films-v1',JSON.stringify(save));},s.state);await page.goto(base+'/?chapter=grain');await at(page,'CH2-LY02-002');await page.locator(`[data-option="${option}"]`).click();await ready(page);
  const a=await pixels(page,.25),b=await pixels(page,1.5);assert.ok(a.reduce((sum,x,i)=>sum+Math.abs(x-b[i]),0)/a.length<1);await context.close();
 }
 writeFileSync(out+'/browser-verification.json',JSON.stringify(report,null,2));console.log('Passed: three scored branches, native playback, subtitle placement, save reload, five static player responses.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
