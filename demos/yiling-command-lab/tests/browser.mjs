import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const checks=new URL('../checks/',import.meta.url);await mkdir(checks,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
async function advance(n){for(let i=0;i<n;i++){const pending=await page.evaluate(()=>window.demoQA.state.story.pending);if(pending)await page.locator('[data-story-choice="'+({fu:'carry',huang:'batches',sha:'search'}[pending])+'"]').click();await page.evaluate(()=>window.demoQA.advance(1));}const pending=await page.evaluate(()=>window.demoQA.state.story.pending);if(pending)await page.locator('[data-story-choice="'+({fu:'carry',huang:'batches',sha:'search'}[pending])+'"]').click();}
try{
 await page.goto('http://127.0.0.1:8946/legacy?qa=1');await page.waitForSelector('.front');
 assert.equal(await page.locator('.front').count(),3);assert.equal(await page.locator('.unit').count(),5);
 assert.ok(await page.locator('.map-art').evaluate(img=>img.complete&&img.naturalWidth===1672));
 await page.screenshot({path:fileURLToPath(new URL('desktop-start.png',checks)),fullPage:true});
 await page.locator('[data-question="0"]').click();assert.equal(await page.evaluate(()=>window.demoQA.state.time),0);
 await page.locator('#tactic').check();await page.locator('[data-unit="0"]').click();await page.locator('.manual-order').evaluate(e=>e.open=true);await page.locator('#task').selectOption('hold');await page.locator('.manual-order').evaluate(e=>e.open=true);await page.locator('#approach').selectOption('safe');await page.locator('#deploy').click();
 assert.equal(await page.evaluate(()=>window.demoQA.state.units[0].state),'travel');
 await page.locator('.front[data-route="huang"]').click();await page.locator('#tactic').check();await page.locator('[data-unit="1"]').click();await page.locator('[data-unit="2"]').click();await page.locator('.manual-order').evaluate(e=>e.open=true);await page.locator('#task').selectOption('rescue');await page.locator('.manual-order').evaluate(e=>e.open=true);await page.locator('#approach').selectOption('direct');await page.locator('#deploy').click();await page.locator('#boat').click();
 await page.locator('.front[data-route="sha"]').click();await page.locator('#tactic').check();await page.locator('[data-unit="3"]').click();await page.locator('[data-unit="4"]').click();await page.locator('.manual-order').evaluate(e=>e.open=true);await page.locator('#approach').selectOption('safe');await page.locator('#deploy').click();
 await page.locator('#play').click();await page.waitForTimeout(1300);assert.ok(await page.evaluate(()=>window.demoQA.state.time)>=1);
 await page.locator('.front[data-route="fu"]').click();const pausedAt=await page.evaluate(()=>window.demoQA.state.time);await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>window.demoQA.state.time),pausedAt);
 await advance(90);const before=await page.evaluate(()=>JSON.stringify(window.demoQA.state));await page.reload();await page.waitForSelector('.front');assert.equal(await page.evaluate(()=>JSON.stringify(window.demoQA.state)),before);assert.equal(await page.evaluate(()=>window.demoQA.paused),true);
 await page.locator('#review').click();assert.ok(await page.locator('.review svg').isVisible());await page.locator('#review').click();
 await advance(130);
 await page.locator('.front[data-route="fu"]').click();await page.locator('[data-unit="0"]').click();await page.locator('.manual-order').evaluate(e=>e.open=true);await page.locator('#task').selectOption('rescue');await page.locator('.manual-order').evaluate(e=>e.open=true);await page.locator('#approach').selectOption('safe');await page.locator('#deploy').click();
 for(let i=0;i<60;i++){
  const state=await page.evaluate(()=>window.demoQA.state);if(state.ended)break;
  const free=state.units.filter(u=>u.state==='camp'),target=['fu','huang','sha'].find(id=>state.routes[id].status==='active');
  if(free.length&&target){await page.locator(`.front[data-route="${target}"]`).click();for(const u of free)await page.locator(`[data-unit="${u.id}"]`).click();await page.locator('.manual-order').evaluate(e=>e.open=true);await page.locator('#task').selectOption('rescue');await page.locator('.manual-order').evaluate(e=>e.open=true);await page.locator('#approach').selectOption('direct');await page.locator('#deploy').click();}
  await advance(5);
 }
 const ending=await page.evaluate(()=>window.demoQA.state);assert.equal(Object.values(ending.routes).filter(r=>r.status==='saved').length,3);assert.ok(await page.locator('.review').isVisible());
 await page.screenshot({path:fileURLToPath(new URL('desktop-result.png',checks)),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForSelector('.front');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:fileURLToPath(new URL('mobile-result.png',checks)),fullPage:true});
 await page.locator('#reset').click();await page.locator('#cancel-reset').click();assert.equal(await page.evaluate(()=>window.demoQA.state.ended),true);
 await page.locator('#reset').click();await page.locator('#confirm-reset').click();assert.equal(await page.evaluate(()=>window.demoQA.state.time),0);assert.equal(await page.evaluate(()=>window.demoQA.paused),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:fileURLToPath(new URL('mobile-start.png',checks)),fullPage:true});
 assert.deepEqual(errors,[]);await writeFile(new URL('browser-result.json',checks),JSON.stringify({passed:true,endingTime:ending.time,saved:3,checks:['three concurrent fronts','asset loaded','questions pause','orders and boat','real clock advances','reading freezes clock','save reload resumes paused','history chart','three-front completion through UI','390px no overflow'],errors},null,2));console.log(JSON.stringify({passed:true,time:ending.time,saved:3,errors}));
}finally{await browser.close();}
