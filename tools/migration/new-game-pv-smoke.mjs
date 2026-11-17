import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const out=resolve('outputs/new-game-pv');mkdirSync(out,{recursive:true});
const server=createStaticServer({root:resolve('GameStarter/web-demo/.build')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('wuzhang-ai-setup-seen-v1','1'));
await page.addInitScript(() => {
 window.__bgmSources=[];
 const original=AudioContext.prototype.createBufferSource;
 AudioContext.prototype.createBufferSource=function(...args){
  const source=original.apply(this,args), start=source.start.bind(source),stop=source.stop.bind(source);
  const record={source,active:false};window.__bgmSources.push(record);
  source.start=(...a)=>{record.active=true;return start(...a)};
  source.stop=(...a)=>{if(!a[0]||a[0]<=this.currentTime)record.active=false;return stop(...a)};
  source.addEventListener('ended',()=>record.active=false);return source;
 };
});
const url=`http://127.0.0.1:${server.address().port}`;
async function start(){await page.goto(url);await page.locator('[data-action="new"]').click();await page.locator('[data-action="new-confirmed"]').click();await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.1);assert.match(await page.locator('video').getAttribute('src'),/PV-regrets-v8/);assert.equal(await page.locator('.chapter-map').count(),0);}
try {
 await start();assert.equal(await page.locator('video').evaluate(v=>v.duration),73);checks.push('新游戏先播放73秒PV，地图未提前显示');
 assert.equal(await page.evaluate(()=>window.__bgmSources.filter(r=>r.active&&r.source.loop).length),0);checks.push('PV播放时无运行中的背景音乐循环');
 await page.locator('video').evaluate(async v=>{v.currentTime=v.duration-.2;await v.play()});await page.locator('.chapter-map').waitFor();checks.push('PV实际ended事件进入地图');
 await page.screenshot({path:resolve(out,'map.png')});
 for(const id of ['grain','jieting','jingzhou','luofengpo']) assert.equal(await page.locator(`[data-map-node="${id}"] a,[data-map-node="${id}"] button`).count(),0);
 await page.locator('[data-map-node="wuzhang"] button').click();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);assert.match(await page.locator('video').getAttribute('src'),/SC03/);checks.push('地图第一章进入原剧情开场，不重复PV');
 await page.goto(url+'/?view=chapters');await page.locator('[data-map-node="yiling"] a').click();await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);assert.match(await page.locator('video').getAttribute('src'),/yiling-opening/);checks.push('地图第四章进入夷陵影片');
 for(const q of ['chapter=grain','chapter=jieting','chapter=jingzhou','chapter=luofengpo','chapter=jingzhou&playtest=reports','chapter=luofengpo&playtest=pangtong']) {await page.goto(url+'/?'+q);await page.locator('.chapter-map').waitFor();assert.match(page.url(),/locked=/);}
 checks.push('未开放章节及两个旧试玩直达链接均返回地图');
 await start();await page.locator('[data-cinema-action="skip"]').click();await page.locator('.chapter-map').waitFor();checks.push('跳过PV同样进入地图');
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'result.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
} finally {await browser.close();await new Promise(r=>server.close(r));}
