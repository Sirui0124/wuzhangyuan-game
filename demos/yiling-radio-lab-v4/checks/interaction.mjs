import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({channel:'chrome',headless:true});
const rows=[],errors=[];
try {
 for(const [width,height] of [[1440,900],[1280,720],[681,688],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8953/?qa=1');
  await page.locator('#begin').click();
  await page.locator('#words').fill('甲队先在营待命。');
  const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,mapHeight:document.querySelector('.map').getBoundingClientRect().height}));
  assert.ok(!geometry.overflow,`horizontal overflow ${width}`);
  assert.ok(geometry.mapHeight>=180);
  await page.locator('#send').scrollIntoViewIfNeeded();
  assert.ok(await page.locator('#send').isVisible());
  await page.screenshot({path:fileURLToPath(new URL(`layout-${width}.png`,import.meta.url)),fullPage:true});
  rows.push({viewport:[width,height],...geometry});await context.close();
 }
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8953/?qa=1');await page.locator('#begin').click();
 await page.locator('#words').fill('甲队正常行军去岔口，到位待命。');await page.locator('#send').click();await page.locator('#confirm').waitFor({timeout:65000});await page.locator('#confirm').click();
 const state=()=>page.evaluate(()=>window.radioQA.state);
 let a=await state();await page.waitForTimeout(1500);let b=await state();assert.ok(b.time>a.time);
 await page.locator('[data-speed="0"]').click();a=await state();await page.waitForTimeout(1200);b=await state();assert.equal(a.time,b.time);
 await page.locator('[data-speed="4"]').click();a=await state();await page.waitForTimeout(1200);b=await state();assert.ok(b.time-a.time>=6);assert.equal(b.units.a.task.rush,false);
 await page.locator('#words').focus();a=await state();await page.waitForTimeout(1200);b=await state();assert.equal(a.time,b.time);
 await page.locator('#words').fill('丁队先待命。');await page.waitForTimeout(3200);a=await state();await page.reload();await page.waitForFunction(()=>window.radioQA?.state);b=await state();assert.equal(a.time,b.time);assert.equal(b.units.a.status,'moving');assert.equal(await page.locator('#words').inputValue(),'丁队先待命。');assert.equal(await page.evaluate(()=>window.radioQA.ui.speed),0);
 assert.equal(errors.length,0);
 await fs.writeFile(new URL('interaction.json',import.meta.url),JSON.stringify({layouts:rows,realApiOrders:1,clock:'continuous; pause freezes; 4x does not enable rush; typing pauses',save:'refresh restores time, moving order and unsent words, paused',errors},null,2));
 console.log(JSON.stringify({layouts:rows,clockAndSave:'passed',errors}));await context.close();
} finally {await browser.close();}
