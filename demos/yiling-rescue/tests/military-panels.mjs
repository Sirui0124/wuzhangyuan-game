import {chromium} from 'playwright';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createDemoServer} from '../server.mjs';
import {createState} from '../.build/engine.js';
import {ROUTES} from '../.build/data.js';
const dir=await mkdtemp(join(tmpdir(),'yiling-military-')),out=resolve('outputs/yiling-rescue-military-20261028');await mkdir(out,{recursive:true});
const s=createState(randomUUID(),'military');
for(const r of ROUTES){s.tracks[r.id].discovered=true;s.tracks[r.id].known=r.facts.map(f=>f.id);}
await writeFile(join(dir,s.id+'.json'),JSON.stringify(s));
const prose='接应队沿西侧山口接回伤兵，后队仍在等候渡船。信使已经把撤退的消息送到各营，沿路留人引导散兵归队。';
const ai=async(kind,input)=>kind==='assess'?{orders:input.orders.map(o=>({id:o.id,evidence:[],reason:'已安排接应队守住山口，引导将士撤离。'}))}:{text:prose.repeat(4),messages:input.changes.map(c=>({id:c.id,message:c.outcome||'接应队仍在渡口等候。'}))};
const server=createDemoServer({saveDir:dir,ai});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(({id,orders})=>{localStorage.setItem('yiling-rescue-demo-session-v2',id);localStorage.setItem('yiling-rescue-demo-session-v2:drafts:'+id,JSON.stringify(orders));},{id:s.id,orders:Object.fromEntries(ROUTES.slice(0,5).map(r=>[r.id,{troops:100,round:1,text:r.actions.map(a=>a.text).join('')}]))});
const settle=async()=>{await page.waitForFunction(()=>!document.querySelector('.working'));assert.equal(await page.locator('[role=alert]').count(),0);};
async function inspect(kind,w,h){await page.setViewportSize({width:w,height:h});const container=kind==='preview'?'#modal':'#scene-dialog',body=kind==='preview'?'.order-copy':'.report-prose';const stats=await page.locator(container).evaluate((e,{body})=>{const b=e.getBoundingClientRect(),scroll=e.querySelector('.military-scroll'),footer=e.querySelector('.military-footer').getBoundingClientRect();return {size:parseFloat(getComputedStyle(e.querySelector(body)).fontSize),x:b.x,right:b.right,y:b.y,bottom:b.bottom,footerBottom:footer.bottom,footerTop:footer.top,overflow:e.scrollWidth>e.clientWidth,scrollable:scroll.scrollHeight>scroll.clientHeight};},{body});assert.ok(stats.x>=0&&stats.right<=w+1&&stats.y>=0&&stats.bottom<=h+1,JSON.stringify(stats));assert.ok(stats.footerBottom<=h&&stats.footerTop>=0);assert.equal(stats.overflow,false);assert.ok(stats.size<=(w<=560||h<=500?17:w<=1000||h<=760?18:21));assert.equal(stats.scrollable,true);await page.locator(container+' .military-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);await page.locator(container+' .military-scroll').evaluate(e=>e.scrollTop=0);await page.screenshot({path:join(out,`${kind}-${w}x${h}.png`)});checks.push({kind,w,h,...stats});}
try{
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.camp-scene').waitFor();await page.locator('[data-screen=map]').first().click();await page.locator('[data-action=preview]').click();await settle();
 for(const [w,h] of [[1440,1000],[1024,640],[844,390],[390,844]])await inspect('preview',w,h);
 await page.locator('.order-assessment summary').first().click();assert.match(await page.locator('.order-assessment details[open]').innerText(),/守住山口/);
 await page.locator('.modal-actions [data-close]').click();assert.equal(await page.locator('#modal').isVisible(),false);assert.match(await page.locator('.reserve').innerText(),/2,500/);
 await page.locator('[data-action=preview]').click();await settle();await page.locator('[data-action=commit]').click();await settle();await page.locator('.result-panel').waitFor();assert.equal(await page.locator('.result-list article').count(),8);
 for(const [w,h] of [[1440,1000],[1024,640],[844,390],[390,844]])await inspect('report',w,h);
 await page.locator('.military-footer [data-action=close-sheet]').click();assert.equal(await page.locator('#scene-dialog').isVisible(),false);await page.locator('.dispatch [data-action=report]').click();await page.locator('.result-panel [data-action=next]').click();await settle();assert.match(await page.locator('.clock').innerText(),/第 2/);assert.match(await page.locator('.reserve').innerText(),/2,500/);assert.deepEqual(errors,[]);console.log('核对、展开依据、取消不扣兵、发布、多路军报、返回与下一轮通过；8组尺寸与字号检查通过。');
}finally{await writeFile(join(out,'report.json'),JSON.stringify({checks,errors},null,2));await browser.close();await new Promise(ok=>server.close(ok));await rm(dir,{recursive:true,force:true});}
