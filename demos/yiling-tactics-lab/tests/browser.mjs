import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=new URL('../checks/',import.meta.url);await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1672,height:941}}),page=await context.newPage(),errors=[],httpErrors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/'))httpErrors.push(r.url()+':'+r.status());});
const snap=()=>page.evaluate(()=>window.tacticsQA.state),shot=name=>page.screenshot({path:fileURLToPath(new URL(name,dir)),fullPage:true});
async function number(field,n){await page.locator('#'+field).fill(String(n));await page.locator('#'+field).dispatchEvent('change');}
async function open(id){await page.locator(`[data-route=${id}]`).click();await page.locator('#troops').waitFor();}
async function commit(){await page.locator('#commit').click();assert.equal(await page.locator('.dispatch > .error').count(),0);await page.locator('#close-front').click();}
async function end(){await page.locator('#end-turn').click();await page.getByRole('dialog',{name:'回合军报'}).waitFor();}
async function next(){await page.locator('#close-modal-main').click();}
try{
 await page.goto('http://127.0.0.1:8947/?qa=1');assert.equal(await page.locator('.map-sign').count(),3);assert.equal(await page.locator('select,input[type=checkbox]').count(),0);await shot('map.png');
 await open('fu');await number('troops',1000);await page.locator('[data-field=mode][data-value=forward]').click();await shot('dispatch.png');await commit();
 await open('feng');await commit();await open('sha');await commit();assert.equal((await snap()).camp,2500);assert.equal((await snap()).stock,8);
 const before=JSON.stringify(await snap());await page.locator('#preview').click();assert.match(await page.getByRole('dialog',{name:'本轮推演'}).innerText(),/新出动2000人，军需4份/);assert.equal(JSON.stringify(await snap()),before);await shot('forecast.png');await page.locator('#execute-from-preview').click();await page.getByRole('dialog',{name:'回合军报'}).waitFor();assert.equal((await snap()).camp,500);await shot('round-1.png');await next();
 const persisted=JSON.stringify(await snap());await page.reload();assert.equal(JSON.stringify(await snap()),persisted);
 await end();assert.equal((await snap()).saved['傅肜'],2);assert.equal((await snap()).camp,500);await next();
 await open('sha');await number('troops',2000);await page.locator('#commit').click();assert.match(await page.locator('.dispatch > .error').innerText(),/待命只有500/);assert.equal((await snap()).stock,4);await page.locator('#close-front').click();
 await open('feng');await number('guard',200);await page.locator('#package').click();await commit();await open('sha');await number('troops',1000);await page.locator('#package').click();await commit();await end();
 assert.equal((await snap()).camp,1000);assert.equal((await snap()).stock,1);assert.equal((await snap()).saved['张南'],3);assert.equal((await snap()).saved['沙摩柯'],3);assert.equal((await snap()).saved['冯习'],undefined);await shot('round-3.png');await next();
 await open('sha');await number('troops',500);await commit();await end();assert.equal((await snap()).camp,1500);assert.equal((await snap()).saved['冯习'],4);await next();await end();const finished=await snap();assert.equal(finished.ended,true);assert.equal(finished.camp,2500);assert.equal(finished.stock,1);assert.equal(finished.losses,0);assert.equal(Object.keys(finished.saved).length,4);await shot('finished.png');
 await page.locator('#see-history').click();assert.equal(await page.locator('tbody').first().locator('tr').count(),5);assert.equal(await page.locator('tbody').last().locator('tr').count(),1);await shot('ledger.png');await page.locator('#close-modal-main').click();
 await page.locator('#restart').click();await page.locator('#close-modal-main').click();assert.equal((await snap()).ended,true);await page.locator('#restart').click();await page.locator('#do-restart').click();assert.equal((await snap()).turn,1);assert.equal((await snap()).camp,2500);assert.ok(await page.evaluate(()=>!!localStorage.getItem('yiling-tactics-v1-20261115-previous')));
 // Real UI, mocked network only: the model's suggestion remains an unconfirmed candidate.
 await open('fu');await page.locator('.natural summary').click();await page.locator('#words').fill('派三百人替后阵，借原部回身接应');
 await page.route('**/api/plan',async route=>{const b=route.request().postDataJSON();await route.fulfill({json:{reply:'三百人替后阵，原部整队后接应。',policy:{...b.policy,troops:300,mode:'borrow'},unsupported:[]}});});
 await page.locator('#ai-plan').click();await page.locator('.notice').filter({hasText:'文字已整理'}).waitFor();assert.equal((await snap()).camp,2500);assert.equal((await snap()).queued.fu,undefined);assert.equal(await page.locator('#troops').inputValue(),'300');await page.locator('#commit').click();assert.equal((await snap()).queued.fu.troops,300);await page.locator('#close-front').click();
 await page.route('**/api/ask',async route=>{await new Promise(r=>setTimeout(r,450));try{await route.fulfill({json:{reply:'迟到回复不应进入别路'}});}catch{}});
 await open('fu');await page.locator('.natural summary').click();await page.locator('#words').fill('隘口在哪里？');await page.locator('#ai-ask').click();await page.locator('#close-front').click();await open('sha');await page.waitForTimeout(650);assert.ok(!(await page.locator('body').innerText()).includes('迟到回复'));
 await page.setViewportSize({width:1280,height:720});await page.reload();await shot('desktop-1280.png');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:390,height:844});await page.reload();await shot('mobile-map.png');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await open('feng');await shot('mobile-order.png');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#commit').scrollIntoViewIfNeeded();await page.locator('#close-front').click();
 const oldOrigin=await context.newPage();await oldOrigin.goto('http://127.0.0.1:8946/health');assert.match(await oldOrigin.locator('body').innerText(),/yiling-command-lab/);await oldOrigin.close();
 assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);await writeFile(new URL('browser.json',dir),JSON.stringify({passed:true,errors,httpErrors,finished,checks:['full 5-turn campaign through controls','preview read-only','army return latency','300-man AI suggestion unconfirmed','independent saved people','refresh restores','overspend rejected atomically','history and retry backup','late answer cancelled','1672/1280/390 layouts','old 8946 still running'],note:'AI network mocked for UI boundary checks; live samples recorded separately.'},null,2));console.log('Browser checks passed.');
}finally{await browser.close();}
