import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createStaticServer } from '../web-demo/serve.mjs';
const server=createStaticServer();
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
try {
 for (const query of ['','&playtest=command']) {
  const context=await browser.newContext();const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.stack || e.message));
  await page.route('**/api/**',route=>route.fulfill({json:{configured:false}}));
  await page.goto(origin+'/?chapter=yiling'+query);
  const video=page.locator('video');await video.waitFor();
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
  assert.equal(await page.locator('iframe').count(),0);
  assert.match(await video.getAttribute('src'),/yiling-opening-v2.17/);
  assert.equal(await video.evaluate(v=>v.muted),false);
  assert.ok(Math.abs(await video.evaluate(v=>v.duration)-75.834)<.1);
  // Seek to the real ending, then let the browser emit its natural ended event.
  await video.evaluate(v=>{v.currentTime=v.duration-.3;});
  await page.locator('[data-cinema-action=toggle]').click();
  if(await video.count()) await video.evaluate(v=>v.play());
  await page.locator('iframe').waitFor();
  const frameURL=new URL(await page.locator('iframe').getAttribute('src'),origin);
  assert.equal(frameURL.pathname,'/yiling-command/index.html');
  assert.equal(frameURL.searchParams.get('chapter'),'yiling');
  assert.equal(new URL(page.url()).searchParams.has('playtest'),false);
  assert.equal(await page.locator('video').count(),0);
  await page.reload();await page.locator('iframe').waitFor();assert.equal(await page.locator('video').count(),0);
  await page.goto(origin+'/?chapter=yiling'+query+'&intro=1');await page.locator('video').waitFor();
  await page.locator('[data-cinema-action=skip]').click();await page.locator('iframe').waitFor();
  assert.ok(!new URL(page.url()).searchParams.has('intro'));
  await page.goto(origin+'/?chapter=yiling'+query+'&restart=1');await page.locator('video').waitFor();
  assert.equal(await page.locator('iframe').count(),0);
  await context.close();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: both chapter routes; actual media duration; audible/manual playback; natural ending; skip; reload; replay; restart gate; no iframe under film.');
}finally{await browser.close();await new Promise(done=>server.close(done));}

