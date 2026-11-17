import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';
import assert from 'node:assert/strict';
const root=dirname(fileURLToPath(import.meta.url)),checks=join(root,'review-checks');mkdirSync(checks,{recursive:true});
const previous=JSON.parse(readFileSync(join(root,'..','yiling-camp-v2-20261106','camera-layout.json'),'utf8'));
const current=JSON.parse(readFileSync(join(root,'camera-layout.json'),'utf8'));
for(const field of ['axes','landmarks','routes','routeLegs'])assert.deepEqual(current[field],previous[field],field+' changed');
for(const key of Object.keys(previous.cameras))assert.deepEqual(current.cameras[key],previous.cameras[key],key+' camera changed');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.waitForFunction(()=>{const i=document.querySelector('#scene');return i?.complete&&i.naturalWidth>0&&!document.querySelector('#frame').classList.contains('loading')});
try{
 await page.goto(pathToFileURL(join(root,'review.html')).href);await ready();const results=[];
 for(const key of ['camp','river','east','south','imperial','overview']){
  await page.locator(`[data-view="${key}"]`).click();await ready();
  const dimensions=await page.locator('#scene').evaluate(i=>[i.naturalWidth,i.naturalHeight]);assert.ok(dimensions[0]>=1600&&dimensions[1]>=900);assert.ok(Math.abs(dimensions[0]/dimensions[1]-16/9)<.003);
  assert.equal(await page.locator(`[data-view="${key}"]`).getAttribute('aria-pressed'),'true');
  await page.screenshot({path:join(checks,key+'.png'),fullPage:true});await page.locator('#frame').screenshot({path:join(checks,key+'-frame.png')});
  await page.locator('#compare').click();await ready();assert.equal(await page.locator('#compare').getAttribute('aria-pressed'),'true');
  assert.ok((await page.locator('#scene').getAttribute('src')).includes('comparison-v2/'));
  await page.locator('#compare').click();await ready();assert.equal(await page.locator('#compare').getAttribute('aria-pressed'),'false');
  results.push({camera:key,dimensions,originalComparison:true});
 }
 for(const key of ['fu','huang','cheng','sha']){
  await page.locator(`[data-route="${key}"]`).click();await ready();assert.equal(await page.locator('.routes polyline').count(),1);
  assert.equal(await page.locator(`[data-route="${key}"]`).getAttribute('aria-pressed'),'true');
 }
 await page.locator('[data-route="all"]').click();await ready();assert.equal(await page.locator('.routes polyline').count(),4);
 await page.locator('#labels-toggle').click();assert.equal(await page.locator('.marks').isVisible(),false);
 await page.locator('#labels-toggle').click();assert.equal(await page.locator('.marks').isVisible(),true);
 await page.locator('.pin').filter({hasText:/^大本营$/}).click();await ready();assert.equal(await page.locator('[data-view="camp"]').getAttribute('aria-pressed'),'true');
 await page.keyboard.press('ArrowRight');await ready();assert.equal(await page.locator('[data-view="river"]').getAttribute('aria-pressed'),'true');
 await page.keyboard.press('c');await ready();assert.equal(await page.locator('#compare').getAttribute('aria-pressed'),'true');await page.keyboard.press('c');await ready();
 await page.locator('#fullscreen').click();assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);await page.evaluate(()=>document.exitFullscreen());
 await page.setViewportSize({width:390,height:844});await page.locator('[data-route="all"]').click();await ready();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:join(checks,'mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 const result={date:'2026-11-06',passed:true,scope:'Independent viewer for generated scene refinements based on Blender layout; not formal game playthrough',layoutDataUnchanged:true,pixelIdenticalGeometry:false,results,errors,
 checks:['Six native generated images, minimum 1600x900, near 16:9','Six original-version comparisons','Four route filters','Landmark navigation','Labels toggle','Arrow keys and C comparison','Fullscreen','390px no horizontal overflow'],userVisualApproval:false};
 writeFileSync(join(root,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}
