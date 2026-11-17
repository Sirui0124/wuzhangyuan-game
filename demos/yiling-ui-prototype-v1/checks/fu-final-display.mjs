import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const out=new URL('../../../outputs/furong-playtest/',import.meta.url);
const previous=JSON.parse(await readFile(new URL('browser-live-verification.json',out),'utf8'));
// Reuse only the isolated test session, never the user's browser progress.
const resolution=previous.rows.find(x=>x.last)?.last.resolutionId;
const scenarioId=resolution.split('/')[0];
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addInitScript(id=>localStorage.setItem('yiling-fu-runtime-v1',JSON.stringify({scenarioId:id})),scenarioId);
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:8956/');await page.locator('#close-info').click();await page.locator('[data-contact="fu"]').click();await page.waitForFunction(()=>document.querySelector('#fu-end-round').textContent==='已归营');
 assert((await page.locator('#fu-network').innerText()).includes('已归营'));assert((await page.locator('.army-marker[data-front="fu"]').innerText()).includes('接应营'));
 await page.screenshot({path:fileURLToPath(new URL('live-home-final.png',out))});
 await page.setViewportSize({width:390,height:844});await page.locator('#open-situation').click();await page.locator('#fu-end-round').scrollIntoViewIfNeeded();assert(await page.locator('#fu-crisis').isVisible());assert(await page.locator('#fu-end-round').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:fileURLToPath(new URL('live-mobile-panel-final.png',out)),fullPage:true});assert.deepEqual(errors,[]);
 await writeFile(new URL('final-display-verification.json',out),JSON.stringify({at:new Date().toISOString(),scenarioId,passed:true,errors,checks:['真实已归营会话顶部状态','地图接应营标识','手机兵符展开危机与回合按钮','无横向溢出']},null,2));console.log('PASS final display');
}finally{await browser.close();}
