import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

const output=resolve('outputs/release-fixes-20261027/mobile-entry');mkdirSync(output,{recursive:true});
const build=resolve(process.env.GAME_BUILD??'GameStarter/web-demo/.build');
const server=createStaticServer({root:build});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:667,height:375},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
const page=await context.newPage();const errors=[],missing=[],external=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()===404)missing.push(r.url());});
await context.addInitScript(()=>{localStorage.setItem('wuzhang-runtime-mode-v1','offline');localStorage.setItem('wuzhang-voice-muted','1');});
await context.route('**/*',async route=>{
 const url=new URL(route.request().url());if(url.origin===base)return route.continue();
 if(url.pathname==='/health')return route.fulfill({headers:{'Access-Control-Allow-Origin':base},json:{configured:false}});
 external.push(url.pathname);return route.abort();
});
try{
 await page.goto(base+'/chapter-one.html?playtest=weiyan-first');
 await page.locator('#player-expression').waitFor();
 assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).searchParams.get('playtest'),'weiyan-first');
 assert.equal(await page.locator('html').getAttribute('data-compact-viewport'),'');
 assert.equal(await page.locator('link[href="/mobile-landscape.css"]').count(),1);
 const firstMain=await page.evaluate(()=>localStorage.getItem('wuzhang-chapter-session-v1'));
 await page.goto(base+'/?chapter=grain&playtest=open1');
 const fixed=page.locator('[data-fixed-speech]');await fixed.first().waitFor();assert.equal(await fixed.count(),5);
 assert.equal(await page.getByText('第二章无 AI 版本待更新。',{exact:false}).count(),0);
 await fixed.first().tap();
 await page.waitForFunction(()=>Object.keys(JSON.parse(localStorage.getItem('grain-chapter-two-open1-playtest-v1'))?.judgments??{}).length===1);
 assert.equal(await page.evaluate(()=>localStorage.getItem('wuzhang-chapter-session-v1')),firstMain);
 assert.equal(await page.evaluate(()=>localStorage.getItem('grain-chapter-two-films-v1')),null);
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);assert.deepEqual(external,[]);
 await page.screenshot({path:resolve(output,'offline-open1.png')});
 const report={passed:true,build,checks:['第一章兼容地址保留试玩参数并使用公共横屏样式','第二章首轮专项离线提供5个可点固定发言并保存判定','两个专项入口不覆盖正式自动档','未请求模型、语音或手机付费接口'],errors,missing,external};
 writeFileSync(resolve(output,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
