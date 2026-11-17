import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
import assert from 'node:assert/strict';
const root=dirname(fileURLToPath(import.meta.url));
const checks=join(root,'review-checks');mkdirSync(checks,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const imageReady=async()=>{await page.waitForFunction(()=>{const i=document.querySelector('#scene');return i?.complete&&i.naturalWidth>0&&!i.classList.contains('loading')});};
try{
 await page.goto(pathToFileURL(join(root,'review.html')).href);await imageReady();
 const results=[];
 for(const key of ['camp','river','east','south','imperial','overview']){
  await page.locator(`[data-view="${key}"]`).click();await imageReady();
  const dimensions=await page.locator('#scene').evaluate(i=>[i.naturalWidth,i.naturalHeight]);
  assert.deepEqual(dimensions,[1920,1080]);
  assert.equal(await page.locator(`[data-view="${key}"]`).getAttribute('aria-pressed'),'true');
  const labels=await page.locator('.pin').evaluateAll(items=>items.map(b=>({text:b.textContent,rect:b.getBoundingClientRect().toJSON()})));
  results.push({camera:key,dimensions,labels:labels.map(p=>p.text)});
  await page.screenshot({path:join(checks,key+'.png'),fullPage:true});
  await page.locator('#frame').screenshot({path:join(checks,key+'-frame.png')});
 }
 const map=JSON.parse(readFileSync(join(root,'legacy-map-layout.json'),'utf8'));
 assert.equal(map.points.camp.label,'大本营');
 for(const [key,p]of Object.entries(map.points))assert.ok(p.x>0&&p.x<1&&p.y>0&&p.y<1,`${key} outside overview`);
 for(const key of ['fu','huang','cheng','sha']){
  await page.locator(`[data-route="${key}"]`).click();await imageReady();
  assert.equal(await page.locator('.lines polyline').count(),2);
  assert.equal(await page.locator(`[data-route="${key}"]`).getAttribute('aria-pressed'),'true');
  const path=map.routes[key];assert.ok(Math.hypot(path[0].x-map.points.camp.x,path[0].y-map.points.camp.y)<.005);
 }
 await page.locator('[data-route="all"]').click();await imageReady();
 await page.locator('#labels-toggle').click();assert.equal(await page.locator('.labels').isVisible(),false);
 await page.locator('#labels-toggle').click();assert.equal(await page.locator('.labels').isVisible(),true);
 await page.locator('[data-view="camp"]').click();await imageReady();await page.keyboard.press('ArrowRight');await imageReady();
 assert.equal(await page.locator('[data-view="river"]').getAttribute('aria-pressed'),'true');
 await page.locator('#fullscreen').click();assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);
 await page.evaluate(()=>document.exitFullscreen());
 await page.setViewportSize({width:390,height:844});await page.locator('[data-route="all"]').click();await imageReady();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:join(checks,'mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 const result={date:'2026-11-06',passed:true,scope:'Independent art viewer; no story API or game playthrough',results,
   checks:['Six camera images load at native 1920x1080','All overview landmarks inside image','Four routes start at camp','Route selection','Label toggle','Keyboard camera switching','Fullscreen','390px viewport no horizontal overflow'],errors,
   userArtApproval:false};
 writeFileSync(join(root,'verification.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
