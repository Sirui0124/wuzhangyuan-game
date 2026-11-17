import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={mode:'B',checks:[],errors:[]};
try {
 const page=await browser.newPage({viewport:{width:1366,height:1000}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:8941/');
 await page.locator('#mode').selectOption('B');
 await page.locator('#new').click();
 await page.locator('#deploy').click();
 await page.locator('#event').waitFor({state:'visible',timeout:20000});
 await page.locator('#generate').click();
 await page.waitForFunction(()=>document.querySelectorAll('#options button').length===3||document.querySelector('#message').textContent.length>0,{},{timeout:100000});
 assert.equal(await page.locator('#options button').count(),3,await page.locator('#message').innerText());
 report.checks.push('真实模型生成三个可选方案');
 await page.locator('#options button').first().click();
 const draft=await page.locator('#draft').inputValue();
 assert.ok(draft.length>10);
 await page.locator('#submit').click();
 await page.waitForFunction(()=>!document.querySelector('#execute').hidden||document.querySelector('#message').textContent.length>0,{},{timeout:100000});
 assert.equal(await page.locator('#execute').isVisible(),true,await page.locator('#message').innerText());
 report.checks.push('选择方案后经真实人物回应形成待执行安排');
 await page.screenshot({path:fileURLToPath(new URL('../checks/b-live-plan.png',import.meta.url)),fullPage:true});
 await page.locator('#execute').click();
 await page.locator('#finish').waitFor({state:'visible',timeout:45000});
 report.checks.push('确认执行后完成归营');
 assert.deepEqual(report.errors,[]);
} catch(e) {report.errors.push(e.message);process.exitCode=1;}
finally {await browser.close();await mkdir(new URL('../checks/',import.meta.url),{recursive:true});await writeFile(new URL('../checks/browser-live.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
