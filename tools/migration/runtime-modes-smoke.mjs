import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const server=createStaticServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:8787/**',route=>route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:true}}));
 await page.addInitScript(()=>localStorage.setItem('wuzhang-ai-setup-seen-v1','1'));
 await page.goto(base);await page.locator('[data-action=settings]').first().click();
 assert.equal(await page.locator('#game-phone-enabled,#game-item-system-enabled').count(),0);
 await page.locator('#game-ai-enabled').uncheck();
 assert.equal(await page.evaluate(()=>localStorage.getItem('wuzhang-runtime-mode-v1')),'offline');
 await page.locator('#game-ai-enabled').check();
 assert.equal(await page.evaluate(()=>localStorage.getItem('wuzhang-runtime-mode-v1')),'ai');
 const modes=await page.evaluate(async()=>{
  const m=await import('/GameStarter/web-demo/src/runtime-mode.js');
  const out=[m.readRuntimeMode(),m.setRuntimeConnection(false),m.readRuntimePreference(),m.setRuntimeConnection(true)];
  m.saveRuntimeMode('offline');out.push(m.setRuntimeConnection(true));return out;
 });
 assert.deepEqual(modes,['ai','offline','ai','ai','offline']);assert.deepEqual(errors,[]);
 console.log('PASS: AI/offline settings persist; connection loss preserves preference; retired controls absent.');
} finally {await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
