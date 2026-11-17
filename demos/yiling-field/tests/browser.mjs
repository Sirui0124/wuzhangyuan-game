import {chromium} from 'playwright';
import {createServer} from '../server.mjs';
import {createState,eventFor} from '../.build/engine.js';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('../../../outputs/yiling-field-demo-20261103/',import.meta.url));mkdirSync(out,{recursive:true});
const server=createServer({config:async()=>({apiKey:''})});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'打开舆图，安排接应'}).click();await page.screenshot({path:out+'01-舆图与部队栏.png',fullPage:true});
 await page.locator('#squad-1').dragTo(page.locator('#route-fu'));await page.waitForTimeout(250);assert.match(await page.locator('#squad-1 .squad-state').innerText(),/前往.*秒/);checks.push('真实拖放派兵与抵达倒计时');
 await page.locator('#squad-2').click();await page.locator('#route-sha').click();assert.match(await page.locator('#squad-2 .squad-state').innerText(),/前往.*秒/);checks.push('点击派兵');
 await page.locator('#pause').click();await page.waitForTimeout(1200);await page.locator('#pause').click();const clock=await page.locator('#clock').innerText();await page.waitForTimeout(1100);assert.equal(await page.locator('#clock').innerText(),clock);checks.push('时间推进与暂停');
 await page.locator('#squad-1').click();await page.locator('#recall').click();assert.match(await page.locator('#squad-1 .squad-state').innerText(),/归营.*秒/);checks.push('途中撤回');
 await page.reload();assert.match(await page.locator('#situation').innerText(),/暂停/);assert.match(await page.locator('#squad-1 .squad-state').innerText(),/归营.*秒/);checks.push('刷新恢复独立存档并暂停');
 const fixture=createState();fixture.time=44;fixture.routes.find(r=>r.id==='sha').eventSeen=true;fixture.routes.find(r=>r.id==='sha').status='active';fixture.routes.find(r=>r.id==='sha').progress=18;fixture.event=eventFor('sha');
 await page.addInitScript(s=>{if(!sessionStorage.getItem('field-fixture-installed')){localStorage.setItem('yiling-field-demo-v1',JSON.stringify(s));sessionStorage.setItem('field-fixture-installed','1');}},fixture);await page.reload();await page.locator('#event-modal').waitFor({state:'visible'});await page.screenshot({path:out+'02-事件直接对话.png',fullPage:true});
 await page.locator('#speech').fill('我想先问清楚他们最后在哪里。');await page.locator('#send').click();await page.waitForTimeout(200);assert.equal(await page.locator('#accept-plan').isVisible(),false);assert.match(await page.locator('#chat').innerText(),/离线演示不会判断/);checks.push('离线不冒充自由语义判定');
 await page.locator('#speech').fill('未发送的原话要保留');await page.evaluate(()=>window.dispatchEvent(new Event('beforeunload')));await page.reload();assert.equal(await page.locator('#speech').inputValue(),'未发送的原话要保留');checks.push('事件草稿刷新恢复');
 await page.locator('#view-map').click();assert.equal(await page.locator('#event-modal').isVisible(),false);await page.locator('#squad-1').dragTo(page.locator('#route-sha'));await page.locator('#pause').click();await page.locator('#sample').click();await page.locator('#send').click();await page.locator('#accept-plan').waitFor({state:'visible'});await page.screenshot({path:out+'03-文字策略与采纳.png',fullPage:true});await page.locator('#accept-plan').click();assert.equal(await page.locator('#event-modal').isVisible(),false);checks.push('事件中回图增援、返回对话、确认后执行');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'04-窄屏舆图.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push('390px无页面横溢');
 await page.locator('#reset').click();await page.locator('#confirm-reset').click();await page.locator('#begin').click();assert.equal(await page.locator('#tray .squad').count(),5);assert.equal(await page.locator('#clock').innerText(),'00:00');checks.push('重新开始只清Demo');
 const offline=await context.newPage();await offline.goto(pathToFileURL(out+'夷陵-归路-派兵接应Demo.html').href);await offline.locator('#begin').click();assert.equal(await offline.locator('#mode').innerText(),'离线演示');await offline.locator('#squad-1').click();await offline.locator('#route-huang').click();assert.match(await offline.locator('#squad-1 .squad-state').innerText(),/前往.*秒/);checks.push('file双击单HTML含美术可派兵');
 assert.deepEqual(errors,[]);writeFileSync(out+'browser-report.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
