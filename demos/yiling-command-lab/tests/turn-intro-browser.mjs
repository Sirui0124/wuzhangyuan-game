import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1672,height:941}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const snapshot=()=>page.evaluate(()=>{const {introSeen,...s}=window.turnQA.state;return JSON.stringify(s);});
try{
 await page.goto('http://127.0.0.1:8946/?qa=1');
 const before=await snapshot();
 for(const id of ['fu','feng','sha']){
  await page.locator(`[data-route=${id}]`).click();await page.locator('.intro-art').waitFor();
  assert.equal(await page.locator('#end-turn,#words,.marker').count(),0);
  await page.locator('.intro-art').evaluate(img=>img.decode());assert.equal(await page.locator('.intro-art').evaluate(img=>img.naturalWidth),1672);
  await page.locator('#intro-next').click();assert.ok(await page.locator('.intro-speaker').isVisible());
  await page.screenshot({path:fileURLToPath(new URL(`../checks/intro-${id}.png`,import.meta.url))});
  await page.locator('#intro-prev').click();await page.locator('#intro-next').click();await page.locator('#intro-next').click();await page.locator('#intro-next').click();
  assert.ok(await page.locator('.dialogue').isVisible());assert.equal(await snapshot(),before);
  await page.locator('#close').click();await page.locator(`[data-route=${id}]`).click();assert.equal(await page.locator('.intro-scene').count(),0);await page.locator('#close').click();
 }
 await page.reload();await page.locator('[data-route=fu]').click();assert.equal(await page.locator('.intro-scene').count(),0);
 await page.locator('#replay-intro').click();await page.locator('#intro-next').click();await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const box=await page.locator('#intro-next').boundingBox();assert.ok(box.y+box.height<=844);
 await page.screenshot({path:fileURLToPath(new URL('../checks/intro-mobile.png',import.meta.url))});
 await page.locator('#intro-skip').click();await page.locator('#close').click();await page.locator('#restart').click();await page.locator('#do-reset').click();
 await page.locator('[data-route=fu]').click();assert.ok(await page.locator('.intro-scene').isVisible());
 await page.locator('#intro-back').click();await page.locator('[data-route=fu]').click();assert.ok(await page.locator('.intro-scene').isVisible());
 assert.deepEqual(errors,[]);await writeFile(new URL('../checks/intro-browser.json',import.meta.url),JSON.stringify({passed:true,errors,checks:['three distinct first encounters','three readable beats','no numerical controls during intro','reading changes no gameplay state','completion persists across reload','revisit bypasses intro','replay supported','390px layout and next button visible','new game resets seen','exit before completion can resume by reopening']},null,2));
 console.log('First-encounter browser checks passed.');
}finally{await browser.close();}
