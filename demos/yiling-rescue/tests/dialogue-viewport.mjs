import {chromium} from 'playwright';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createDemoServer} from '../server.mjs';
const dir=await mkdtemp(join(tmpdir(),'yiling-dialogue-'));
const out=resolve('outputs/yiling-rescue-shared-dialogue-20261028');await mkdir(out,{recursive:true});
let aiCalls=0;const server=createDemoServer({saveDir:dir,ai:async()=>{aiCalls++;throw new Error('本轮只测试固定对白');}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[],checks=[];
try{
 for(const [width,height] of [[1440,1000],[1105,470],[844,390],[640,360],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('[data-action=start]').click();await page.locator('.camp-point[data-target=clerk]').click();
  await page.waitForFunction(()=>document.querySelector('.character-art')?.naturalWidth>0);
  const revision=await page.evaluate(async()=>{const id=localStorage.getItem('yiling-rescue-demo-session-v2');return (await(await fetch('/api/state?session='+id)).json()).state.revision;});
  for(const stage of ['reading','choices','reply','followup']){
   const metrics=await page.evaluate(()=>{
    const dialog=document.querySelector('#scene-dialog'),box=dialog.querySelector('.dialogue-box');const r=box.getBoundingClientRect();
    return {phase:dialog.dataset.phase,scrollX:['auto','scroll'].includes(getComputedStyle(box).overflowX)&&box.scrollWidth>box.clientWidth,scrollY:['auto','scroll'].includes(getComputedStyle(box).overflowY)&&box.scrollHeight>box.clientHeight,dialogX:dialog.scrollWidth>dialog.clientWidth,dialogY:dialog.scrollHeight>dialog.clientHeight,top:r.top,bottom:r.bottom,buttons:[...box.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,size:getComputedStyle(b).fontSize};})};
   });
   assert.equal(metrics.scrollX,false,JSON.stringify({width,height,stage,metrics}));assert.equal(metrics.scrollY,false,JSON.stringify({width,height,stage,metrics}));
   assert.equal(metrics.dialogX,false);assert.equal(metrics.dialogY,false);assert.ok(metrics.top>=48);assert.ok(metrics.bottom<=height);
   for(const b of metrics.buttons){assert.ok(b.top>=48&&b.bottom<=height&&b.left>=0&&b.right<=width);assert.equal(b.size,'24px');}
   await page.screenshot({path:join(out,`camp-${width}x${height}-${stage}.png`)});checks.push({width,height,stage,...metrics});
   if(stage==='reading'){
    await page.keyboard.press('Space');await page.locator('[data-camp-route=fu]').waitFor();
    const after=await page.evaluate(async()=>{const id=localStorage.getItem('yiling-rescue-demo-session-v2');return (await(await fetch('/api/state?session='+id)).json()).state.revision;});assert.equal(after,revision,'读完对白不提交选择');
   }else if(stage==='choices'){await page.locator('[data-camp-route=fu]').click();await page.locator('.dialogue-advance').waitFor();}
   else if(stage==='reply'){await page.locator('.dialogue-advance').click();await page.locator('.camp-choices [data-target=fu]').waitFor();assert.equal(await page.locator('[data-camp-route],[data-camp-next]').count(),0);}
  }
  await context.close();
 }
 assert.equal(aiCalls,0);assert.deepEqual(errors,[]);await writeFile(join(out,'viewport-report.json'),JSON.stringify({aiCalls,errors,checks},null,2));console.log('5种窗口 × 4个对白阶段：无横竖滚动溢出，选项可见，空格推进不改进度，军营模型调用0次。');
}finally{await browser.close();await new Promise(ok=>server.close(ok));await rm(dir,{recursive:true,force:true});}
