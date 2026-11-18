import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const origin='http://127.0.0.1:18812';
const output=resolve(process.argv[2]||'outputs/web-release-validation');mkdirSync(output,{recursive:true});
const report={passed:false,hostPlatform:process.platform,macDeviceTested:false,checks:[],errors:[],missing:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext();
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()===404)report.missing.push(r.url());});
 await page.goto(origin);await page.locator('.game-menu').waitFor();
 const health=await page.evaluate(async()=>await(await fetch('/health')).json());assert.equal(health.configured,false);
 report.checks.push('网页菜单与同源API代理可用，未携带开发密钥');
 if(await page.locator('.ai-setup-intro [data-action=close-modal]').isVisible())await page.locator('.ai-setup-intro [data-action=close-modal]').click();
 await page.locator('[data-action=new]').click();await page.locator('[data-action=new-confirmed]').click();await page.locator('video').waitFor();
 await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&v.videoWidth>0;});
 const src=await page.locator('video').getAttribute('src');const range=await page.request.get(new URL(src,origin).href,{headers:{Range:'bytes=0-1023'}});assert.equal(range.status(),206);assert.equal((await range.body()).length,1024);
 await page.locator('[data-cinema-action=skip]').click();
 await page.locator('[data-map-node=wuzhang] button').click();
 await page.locator('[data-cinema-action=skip]').waitFor();await page.locator('[data-cinema-action=skip]').click();await page.locator('.branch-scene').waitFor();
 report.checks.push('开篇视频解码、Range读取、地图与第一章场景进入');
 const profile=await(await page.request.get(origin+'/release-profile.json')).json();assert.deepEqual(profile.chapters,['wuzhang','yiling']);
 const branch=await(await page.request.get(origin+'/story/chapter-one.branch.json')).json();
 for(const node of branch.nodes??[]){if(node.film)for(const path of [node.film.src,node.film.subtitles].filter(Boolean))assert.equal((await page.request.get(origin+path)).status(),200,path);}
 for(const path of ['/story/chapter-two.json','/story/chapter-three.json','/GameStarter/web-demo/src/chapter-two.js','/GameStarter/web-demo/src/chapter-three.js'])assert.equal((await page.request.get(origin+path)).status(),404,path);
 report.checks.push('包内仅第一章和第四章；其他章节入口与剧情文件缺席，第一章内嵌影片引用完整');
 await page.goto(origin+'/?chapter=yiling');await page.locator('[data-cinema-action=skip]').click();await page.frameLocator('iframe').locator('[data-action=start]').click();await page.frameLocator('iframe').locator('.campaign-header').waitFor();
 const key='yiling-rescue-campaign-session-v1';await page.waitForFunction(k=>!!localStorage.getItem(k),key);
 const id=await page.evaluate(k=>localStorage.getItem(k),key);
 const state=await page.evaluate(async id=>await(await fetch('/api/yiling-rescue/state?session='+encodeURIComponent(id))).json(),id);assert.equal(state.state.id,id);
 await page.reload();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),id);
 report.checks.push('第四章营救后端与浏览器刷新后存档保留');
 await page.goto(origin+'/?chapter=yiling&playtest=command');
 await page.frameLocator('iframe').locator('body').waitFor();
 assert.ok((await page.locator('iframe').getAttribute('src')).includes('yiling-command'));
 const command=await page.request.post(origin+'/api/yiling-command/session',{data:{}});assert.equal(command.status(),200);assert.equal((await command.json()).ok,true);
 report.checks.push('第四章三路指令入口及独立后端会话可用，无需模型调用');
 for(const chapter of ['grain','jieting','jingzhou','luofengpo']){await page.goto(origin+'/?chapter='+chapter);await page.waitForFunction(id=>new URL(location.href).searchParams.get('locked')===id,chapter);}
 report.checks.push('其余章节维持当前暂未开放状态');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.passed=true;
}catch(e){report.failure=String(e.stack);throw e;}finally{await browser.close();writeFileSync(resolve(output,'web-verification.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
