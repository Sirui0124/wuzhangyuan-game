import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const server=createStaticServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage();let failed=false,modelFailed=false,saves=0,tests=0,fixture={apiKey:'fixture-only-key',baseUrl:'https://example.test/v1',model:'fixture-model'};
let finishFirstConnection;
const firstConnectionGate=new Promise(resolve=>{finishFirstConnection=resolve;});
await page.addInitScript(() => localStorage.setItem('wuzhang-ai-setup-seen-v1','1'));
await page.route('http://127.0.0.1:8787/health', route => route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{configured:true}}));
try{
 await page.route('http://127.0.0.1:8787/api/game/settings',async route=>{
  const headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  if(route.request().method()==='POST'){fixture=route.request().postDataJSON();saves++;await route.fulfill({headers,json:{ok:true}});return;}
  await route.fulfill({status:failed?503:200,headers,json:failed?{error:'fixture unavailable'}:fixture});
 });
 await page.route('http://127.0.0.1:8787/api/game/respond',async route=>{
  const headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  tests++;assert.match(route.request().postDataJSON().text,/连接测试/);
   if(tests===1)await firstConnectionGate;
  await route.fulfill({status:modelFailed?401:200,headers,json:modelFailed?{error:'模型接口请求失败（HTTP 401）'}:{text:'OK',responseId:'fixture'}});
 });
 await page.goto(base);await page.locator('[data-action=settings]').click();
 assert.equal(await page.locator('#reduce-motion').count(),0);
 assert.equal(await page.locator('#ai-voice-enabled,a[href="/voice-demo.html"]').count(),0);
 assert.equal(await page.locator('#api-settings').evaluate(node=>node.parentElement.classList.contains('settings-section')),true);
 assert.equal(await page.locator('#api-settings').evaluate(node=>node.previousElementSibling.querySelector('#game-ai-enabled') !== null),true);
 await page.locator('#api-settings > summary').click();await page.locator('#api-model:not([disabled])').waitFor();
 assert.equal(await page.locator('#api-key').getAttribute('type'),'password');assert.equal(await page.locator('#api-model').inputValue(),'fixture-model');
 await page.locator('.modal-close').focus();await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('.game-modal')),true);await page.keyboard.press('Tab');assert.equal(await page.locator('.modal-close').evaluate(node=>node===document.activeElement),true);
 assert.equal(await page.locator('#game-phone-enabled').count(),0);
 assert.equal(await page.locator('#api-status').innerText(),'');
 assert.equal(await page.locator('#game-item-system-enabled').count(),0);
 await page.locator('#api-model').fill('edited-model');await page.locator('[data-action=save-api]').click();await page.getByText('配置已保存。',{exact:true}).waitFor();assert.equal(saves,1);assert.equal(fixture.model,'edited-model');assert.equal(fixture.apiKey,'fixture-only-key');
 await page.locator('#api-model').fill('connection-model');await page.locator('[data-action=test-api]').click();
 await page.getByText('配置已保存，正在测试模型连接……',{exact:true}).waitFor();
 assert.equal(await page.locator('[data-action=test-api]').isDisabled(),true);assert.equal(await page.locator('#api-model').isDisabled(),true);
  finishFirstConnection();
 await page.getByText(/连接成功。模型：connection-model，耗时/).waitFor();assert.equal(tests,1);assert.equal(saves,2);assert.equal(fixture.model,'connection-model');
 modelFailed=true;await page.locator('[data-action=test-api]').click();await page.getByText(/配置已保存，但连接测试失败：.*HTTP 401/).waitFor();assert.equal(tests,2);assert.equal(saves,3);assert.equal(await page.locator('[data-action=test-api]').isEnabled(),true);
 const music=page.locator('[data-volume=music]');await music.focus();await music.press('End');assert.equal(await music.inputValue(),'100');await page.locator('[data-action=close-modal]').click();
 failed=true;await page.locator('[data-action=settings]').click();await page.getByText(/暂时无法读取本机配置/).waitFor();assert.equal(await page.locator('[data-action=save-api]').isDisabled(),true);assert.equal(saves,3);assert.equal(await page.locator('[data-action=test-api]').isDisabled(),true);assert.equal(await page.locator('[data-volume=music]').inputValue(),'100');
 console.log('PASS: masked key, compact AI configuration placement, removed manual motion setting, explicit save/test, failed read guard and volume persistence.');
}finally{finishFirstConnection();await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
