import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('../../../outputs/furong-playtest/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const errors=[],rows=[];let session;
page.on('pageerror',e=>errors.push(e.message));
page.on('response',async r=>{if(r.url().includes('/api/fu/')){try{const data=await r.json();if(data.session){session=data.session;rows.push({url:r.url(),status:r.status(),revision:session.revision,round:session.round,phase:session.phase,crisis:session.view.crisis.value,last:session.view.lastResolution,reply:session.messages.at(-1)?.text});console.log(JSON.stringify(rows.at(-1)));}}catch{}}});
async function clickApi(selector,endpoint){const response=page.waitForResponse(r=>r.url().endsWith('/api/fu/'+endpoint),{timeout:100000});await page.locator(selector).click();const r=await response;const data=await r.json();assert.equal(data.ok,true,data.error);session=data.session;await page.waitForTimeout(200);return session;}
async function ready(){await page.waitForFunction(()=>!document.querySelector('#send').disabled,{timeout:20000});}
async function say(text){await page.locator('[data-contact="fu"]').click();await ready();await page.locator('#draft').fill(text);return clickApi('#send','chat');}
async function order(unit,task,via='normal',rush=false){await ready();await page.locator('#mode-toggle').click();await page.locator('#order-unit').selectOption(unit);await page.locator('#order-target').selectOption('fu');await page.locator('#draft').fill(`${unit}队${session.tasks[task].label}，${via==='side'?'绕行南侧路，':''}${rush?'急行军':'正常行军'}。`);await page.locator('#send').click();await clickApi('#send','orders');await page.locator('[data-contact="fu"]').click();}
let passed=false;
try{
 await page.goto('http://127.0.0.1:8956/');await page.locator('#close-info').click();const load=page.waitForResponse(r=>r.url().endsWith('/api/fu/session'));await page.locator('[data-contact="fu"]').click();session=(await (await load).json()).session;await ready();
 assert.equal(session.view.crisis.value,99);await page.locator('#suggest').click();await page.locator('[data-suggestion]').first().click();assert.equal(await page.locator('#draft').inputValue(),'你还在后阵吗？');assert.equal(session.round,0);
 await say('你在干啥呀？');assert.equal(session.round,0);assert(!session.messages.at(-1).text.includes('本交互稿'));
 await order('甲','verify');assert.equal(session.round,0);assert.equal(session.pendingOrders.length,1);
 await clickApi('#fu-end-round','round');assert.equal(session.round,1);assert.equal(session.facts.liubeiAliveVerified,true);assert.equal(session.facts.liubeiSafeConfirmed,false);
 await say('陛下还活着，你已收到消息。弟兄们死守到最后，是为了护住陛下。你回去还能继续护他，也该亲口告诉他弟兄们怎样守到最后。别再独自留下，跟接应的人回来吧。');assert.equal(session.facts.withdrawalAccepted,true);assert.equal(session.round,1);
 await order('乙','scout','side');await order('丙','relieve','normal',true);await order('丁','rescue','normal',true);
 await page.screenshot({path:fileURLToPath(new URL('live-before-round.png',out))});
 await clickApi('#fu-end-round','round');assert.equal(session.round,2);
 if(session.phase!=='safe'){await order('甲','suppress','normal',true);await order('乙','signal');await clickApi('#fu-end-round','round');}
 assert.equal(session.phase,'safe');assert.equal(session.view.crisis.value,0);const id=session.scenarioId,revision=session.revision,last=JSON.stringify(session.view.lastResolution);
 await page.reload();await page.waitForFunction(()=>document.querySelector('#fu-end-round').textContent==='护送归营');assert.equal(session.scenarioId,id);assert.equal(session.revision,revision);assert.equal(JSON.stringify(session.view.lastResolution),last);
 await page.screenshot({path:fileURLToPath(new URL('live-safe.png',out))});await clickApi('#fu-end-round','round');assert.equal(session.phase,'home');assert(await page.locator('#fu-end-round').isDisabled());
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL('live-mobile.png',out)),fullPage:true});
 assert.deepEqual(errors,[]);passed=true;console.log('PASS live browser: AI, orders, turns, evacuation, reload and mobile');
}finally{await writeFile(new URL('browser-live-verification.json',out),JSON.stringify({at:new Date().toISOString(),passed,errors,rows},null,2));await browser.close();}
