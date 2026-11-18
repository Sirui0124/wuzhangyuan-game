import {chromium,_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
const windows=process.argv[2],mac=process.argv[3];
if(!windows||!mac)throw Error('Pass Windows executable and Mac extracted directory');
const out=resolve('outputs/default-settings-'+Date.now());mkdirSync(out,{recursive:true});
const report={passed:false,checks:[],realModelCalled:false};
const sample='release-validation-placeholder-key';
async function verify(page,origin,alreadyLoading=false){
 page.setDefaultTimeout(20000);
 if(!alreadyLoading)await page.goto(origin);await page.locator('.game-menu').waitFor();
 if(!await page.locator('#api-settings').count())await page.locator('[data-action=settings]').click();
 await page.locator('#api-key:not([disabled])').waitFor({state:'attached'});
 await page.locator('#api-settings').evaluate(el=>el.open=true);
 assert.equal(await page.locator('#api-base').inputValue(),'https://api.deepseek.com');
 assert.equal(await page.locator('#api-model').inputValue(),'deepseek-flash');
 assert.equal(await page.locator('#api-key').inputValue(),'');
 await page.locator('#api-key').fill(sample);
 await page.locator('[data-action=save-api]').click();
 await page.waitForFunction(()=>document.querySelector('#api-status')?.textContent==='配置已保存。');
 await page.locator('[data-action=close-modal]').first().click();
 await page.locator('[data-action=settings]').click();
 await page.locator('#api-key:not([disabled])').waitFor({state:'attached'});
 assert.equal(await page.locator('#api-key').inputValue(),sample);
 assert.equal(await page.locator('#api-base').inputValue(),'https://api.deepseek.com');
 assert.equal(await page.locator('#api-model').inputValue(),'deepseek-flash');
}
let app,browser,child;
try{
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({executablePath:resolve(windows),args:[`--user-data-dir=${resolve(out,'windows-user')}`],env,timeout:120000});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.hide()));
 await verify(await app.firstWindow(),'http://127.0.0.1:8812/',true);
 report.checks.push('Windows发布目录：默认网址与模型预填，密钥初始为空，仅填测试密钥保存并重新打开设置成功');
 await app.close();app=null;
 // Refuse to touch an existing local service.
 const occupied=await fetch('http://127.0.0.1:18812/',{signal:AbortSignal.timeout(600)}).then(()=>true,()=>false);assert.equal(occupied,false,'Port 18812 must be free for this isolated test');
 child=spawn(process.execPath,[resolve(mac,'launch.mjs')],{env:{...process.env,WUZHANG_TEST_DATA:resolve(out,'mac-user'),WUZHANG_NO_OPEN:'1'},stdio:'ignore',windowsHide:true});
 let ready=false;for(let i=0;i<100;i++){if(await fetch('http://127.0.0.1:18812/health').then(r=>r.ok,()=>false)){ready=true;break;}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 browser=await chromium.launch({channel:'chrome',headless:true});
 await verify(await browser.newPage(),'http://127.0.0.1:18812/');
 report.checks.push('Mac发布载荷在Windows Chrome：默认网址与模型预填，密钥初始为空，仅填测试密钥保存并重新打开设置成功');
 report.passed=true;
}catch(e){report.failure=String(e.stack);throw e;}finally{await app?.close();await browser?.close();child?.kill();writeFileSync(resolve(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,...report},null,2));}
