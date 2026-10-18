import { chromium } from 'playwright';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=resolve(root,'outputs/migration-20261018');mkdirSync(output,{recursive:true});
const server=createStaticServer(); await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const report={passed:false,pageErrors:[],missing:[],checks:[]};let browser;
try {
  browser=await chromium.launch({headless:true,...(process.env.SMOKE_BROWSER_CHANNEL ? {channel:process.env.SMOKE_BROWSER_CHANNEL} : {})});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  page.on('response',r=>{if(r.status()===404)report.missing.push(new URL(r.url()).pathname);});
  await page.goto(base);await page.locator('.main-menu').waitFor();
  report.checks.push('Desktop main menu renders');
  await page.locator('[data-action=settings]').click();
  await page.locator('#api-key').waitFor();
  assert.equal(await page.locator('#api-key').getAttribute('type'),'password');
  report.checks.push('Settings panel opens; key input is masked');
  await page.goto(base+'/?play=1');
  await page.locator('[data-action=skip]').waitFor();
  assert.match(await page.locator('body').innerText(), /五丈原|中军帐/);
  await page.locator('[data-action=skip]').click();
  await page.locator('[data-action=scene]').first().waitFor();
  await page.screenshot({path:resolve(output,'desktop.png')});
  report.checks.push('Fresh browser enters desktop gameplay');
  const manifest=await fetch(base+'/video/media-manifest.json').then(r=>r.json());
  for (const clip of manifest.clips) {
    const response=await fetch(base+clip.url,{headers:{Range:'bytes=0-1023'}});
    assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,1024);
  }
  report.checks.push('All four runtime videos serve byte ranges');
  assert.deepEqual(report.pageErrors,[]); assert.deepEqual(report.missing,[]);
  report.passed=true;console.log(JSON.stringify(report));
} finally {
  await browser?.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));
  writeFileSync(resolve(output,'browser-smoke.json'),JSON.stringify(report,null,2));
}
