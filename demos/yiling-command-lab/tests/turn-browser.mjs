import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1672,height:941}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const shot=name=>page.screenshot({path:fileURLToPath(new URL('../checks/'+name,import.meta.url)),fullPage:true});
try{
 await page.goto('http://127.0.0.1:8946/?qa=1');await page.waitForSelector('.marker');
 assert.equal(await page.locator('.marker').count(),3);assert.equal(await page.locator('select,input[type=checkbox]').count(),0);assert.ok(!await page.locator('body').innerText().then(t=>/疲劳|黄权/.test(t)));
 assert.ok(await page.locator('.map-art').evaluate(e=>e.complete&&e.naturalWidth===1672));await shot('turn-map.png');
 await page.locator('[data-route=fu]').click();if(await page.locator('#intro-skip').count())await page.locator('#intro-skip').click();await page.locator('[data-question="0"]').click();assert.equal(await page.evaluate(()=>window.turnQA.state.turn),1);
 await page.locator('#troops').fill('300');await page.locator('#simple').click();assert.equal(await page.evaluate(()=>window.turnQA.state.camp),2500);await page.locator('#confirm').click();assert.equal(await page.evaluate(()=>window.turnQA.state.fronts.fu.men),300);assert.match(await page.locator('.need').innerText(),/900人/);assert.match(await page.locator('.situation').innerText(),/54/);await shot('turn-dialogue.png');
 const before=await page.evaluate(()=>JSON.stringify(window.turnQA.state));await page.reload();assert.equal(await page.evaluate(()=>JSON.stringify(window.turnQA.state)),before);
 await page.locator('[data-route=fu]').click();if(await page.locator('#intro-skip').count())await page.locator('#intro-skip').click();await page.locator('#words').fill('让傅肜原部回身掩护，留300人接应。');
 await page.route('**/api/turn-plan',async route=>{const b=route.request().postDataJSON();await route.fulfill({json:{draft:{id:'browser-draft',revision:b.state.revision,reply:'三百人先顶住缺口，请傅将军的旧部回身接应。',operations:[{route:'fu',troops:300,coordinate:true,supply:false,action:'rescue'}],unsupported:[]}}});});
 await page.locator('#plan').click();await page.locator('#confirm').waitFor();assert.equal(await page.evaluate(()=>window.turnQA.state.fronts.fu.coordinated),false);await page.locator('#confirm').click();assert.equal(await page.evaluate(()=>window.turnQA.state.fronts.fu.coordinated),true);assert.match(await page.locator('.situation').innerText(),/36/);
 await page.locator('#close').click();await page.locator('#end-turn').click();await page.locator('.report-sheet').waitFor();assert.equal(await page.evaluate(()=>window.turnQA.state.turn),2);await shot('turn-report.png');
 await page.locator('#continue').click();await page.locator('#restart').click();await page.locator('#cancel-reset').click();assert.equal(await page.evaluate(()=>window.turnQA.state.turn),2);
 await page.locator('#restart').click();await page.locator('#do-reset').click();
 // Complete a whole campaign with fixed story orders through actual UI; no clock/state acceleration.
 for(const [id,n] of [['fu',1000],['feng',1000],['sha',500]]){await page.locator(`[data-route=${id}]`).click();if(await page.locator('#intro-skip').count())await page.locator('#intro-skip').click();await page.locator('#troops').fill(String(n));await page.locator('#simple').click();await page.locator('#confirm').click();await page.locator('#close').click();}
 for(let i=0;i<9;i++){if(await page.evaluate(()=>window.turnQA.state.ended))break;await page.locator('#end-turn').click();await page.locator('#continue').click();}
 const ended=await page.evaluate(()=>window.turnQA.state);assert.equal(ended.saved.length,4);assert.equal(ended.ended,true);assert.equal(ended.camp+ended.losses,2500);await shot('turn-finished.png');
 await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('[data-route=feng]').click();if(await page.locator('#intro-skip').count())await page.locator('#intro-skip').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('turn-mobile.png');
 // Late replies must not populate another front after navigation.
 await page.locator('#close').click();await page.locator('#restart').click();await page.locator('#do-reset').click();await page.locator('[data-route=fu]').click();if(await page.locator('#intro-skip').count())await page.locator('#intro-skip').click();
 await page.route('**/api/turn-ask',async route=>{await new Promise(r=>setTimeout(r,400));try{await route.fulfill({json:{reply:'这段迟到答复不应出现在山林。'}});}catch{}});
 await page.locator('#words').fill('隘口有人接应吗？');await page.locator('#ask').click();await page.locator('#close').click();await page.locator('[data-route=sha]').click();if(await page.locator('#intro-skip').count())await page.locator('#intro-skip').click();await page.waitForTimeout(600);assert.ok(!(await page.locator('body').innerText()).includes('迟到答复'));
 assert.deepEqual(errors,[]);await writeFile(new URL('../checks/turn-browser.json',import.meta.url),JSON.stringify({passed:true,fullCampaign:ended,errors,checks:['three map markers','no dropdown or checkbox','300-man partial effect','draft confirmation','coordination','save restore','round report','full campaign by UI','mobile no overflow','late response cancellation']},null,2));
 console.log('Turn browser checks passed; screenshots saved.');
}finally{await browser.close();}
