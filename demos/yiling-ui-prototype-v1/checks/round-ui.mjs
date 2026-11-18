import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {campaignHandler,createCampaignRuntime} from '../campaign-runtime.mjs';
const out=resolve('outputs/yiling-report-prose-20261118');await mkdir(out,{recursive:true});
const runtime=createCampaignRuntime({reportModel:false,directory:resolve(out,'test-saves')});const api=campaignHandler(runtime);
const base=new URL('../',import.meta.url);
const server=createServer(async(req,res)=>{try{
 if(req.url.startsWith('/api/campaign/'))return api(req,res);
 const path=req.url.split('?')[0];
 const file=path==='/'?'public/index.html':path==='/app.js'?'.build/campaign-app.js':path==='/terrain.png'?'../yiling-radio-lab-v6/public/terrain-night-v1.png':path.endsWith('.js')?'.build'+path:'public'+path;
 const data=await readFile(new URL(file,base));res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'text/html');res.end(data);
 }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#skip-info').click();
 await page.locator('#round-clock').getByText(/第一?1轮|第1轮/).waitFor();
 for(let i=0;i<8;i++){await page.locator('#draft').fill('敌情怎样？');await page.locator('#send').click();await page.locator('#log .mine').nth(i).waitFor();await page.waitForFunction(()=>!document.querySelector('#fu-refresh').disabled);}
 assert.equal(await page.locator('#send').isDisabled(),true);assert.match(await page.locator('#filter-hint').innerText(),/八次/);checks.push('八次问答后只限制当前组，取消真实冷却');
 await page.locator('#mode-toggle').click();await page.locator('#draft').fill('派1000人接应沙摩柯；派300人给沙摩柯断后');await page.locator('#send').click();await page.locator('#preview').waitFor({state:'visible'});await page.locator('#send').click();await page.locator('.roster-row').nth(1).waitFor();
 async function endRound(n){await page.locator('#fu-end-round').click();await page.locator('#round-report').waitFor({state:'visible'});assert.match(await page.locator('#round-report-title').innerText(),new RegExp(`第${n}轮`));}
 await endRound(1);await page.locator('#round-report button').click();
 await endRound(2);assert.match(await page.locator('.report-table').innerText(),/1000/);assert.match(await page.locator('.report-narrative').innerText(),/尚未解围/);assert.match(await page.locator('.report-fronts').innerText(),/危机度/);assert.equal(await page.locator('.crisis-row').count(),3);
 await page.screenshot({path:resolve(out,'round-report.png')});await page.locator('#round-report button').click();
 assert.equal(await page.locator('.rescue-marker.returning').count(),0);assert.match(await page.locator('.roster-row').nth(1).innerText(),/尚未解围/);await page.screenshot({path:resolve(out,'returning-map.png')});checks.push('紧凑军情、自然军报与派遣表；尚未解围时留在前线');
 await page.reload();assert.equal(await page.locator('#round-report').isVisible(),false);await page.locator('#review-round').click();await page.locator('#round-report').waitFor({state:'visible'});await page.locator('#round-report button').click();
 for(const [width,height] of [[1280,720],[800,600],[390,844]]){await page.setViewportSize({width,height});await page.screenshot({path:resolve(out,`layout-${width}.png`),fullPage:true});const box=await page.locator('#fu-end-round').boundingBox();assert.ok(box&&box.width>0&&box.y+box.height<=height,`结束本轮被裁切: ${JSON.stringify(box)}`);assert.ok(await page.locator('#fu-end-round').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#review-round').click();await page.screenshot({path:resolve(out,`report-${width}.png`)});await page.locator('#round-report button').click();}
 checks.push('桌面、矮窗口、手机无横向溢出；军报可重看且刷新不重复弹出');
 await page.setViewportSize({width:1440,height:900});await endRound(3);await page.locator('#round-report button').click();assert.equal(await page.locator('.rescue-marker.returning').count(),0);assert.equal(await page.locator('.roster-row').count(),3);checks.push('第三轮仍留在前线持续执行任务');
 await endRound(4);await page.screenshot({path:resolve(out,'relieved-report.png')});await page.locator('#round-report button').click();assert.equal(await page.locator('.rescue-marker.returning').count(),2);await page.screenshot({path:resolve(out,'returning-map.png')});await endRound(5);await page.locator('#round-report button').click();assert.equal(await page.locator('.roster-row').count(),1);checks.push('第四轮解围进入返程，第五轮才回营');await endRound(6);await page.locator('#round-report button').click();
 assert.equal(await page.locator('#fu-end-round').isDisabled(),true);assert.match(await page.locator('#round-clock').innerText(),/已过12时辰/);assert.match(await page.locator('#round-report-body').innerText(),/十二时辰已尽/);checks.push('第六轮到期结算，无第七轮或假归营');
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'checks.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
