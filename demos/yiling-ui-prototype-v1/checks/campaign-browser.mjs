import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const out=new URL('../../../outputs/yiling-shared-ui/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1640,height:1050}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('yiling-ui-prototype-v1',JSON.stringify({version:1,units:{甲:{men:2500}},logs:[{text:'保留旧记录'}]}));});
 await page.goto('http://127.0.0.1:8812/?chapter=yiling&playtest=command');
 await page.locator('[data-cinema-action=skip]').click();
 const f=page.frameLocator('iframe');await f.locator('#close-info').click();await f.locator('#army-roster').getByText('2000',{exact:true}).waitFor();
 assert.equal(await f.locator('.roster-row').count(),1);assert.match(await f.locator('.roster-row').innerText(),/甲队.*500/s);
 const pos=await f.locator('#suggestions').evaluate(e=>({inComposer:!!e.closest('.composer'),bottom:e.getBoundingClientRect().bottom,draftTop:document.querySelector('#draft').getBoundingClientRect().top,top:e.getBoundingClientRect().top,tabsTop:document.querySelector('#contacts').getBoundingClientRect().top}));
 assert.ok(pos.inComposer&&pos.bottom<=pos.draftTop+2&&pos.top>pos.tabsTop);checks.push('推荐气泡紧贴底部输入框上方，初始仅甲队500与预备兵2000');
 await page.screenshot({path:fileURLToPath(new URL('desktop-chat.png',out)),fullPage:true});
 const sizes=await f.locator('.army-sha').evaluate(e=>[getComputedStyle(e.querySelector('.front-urgency')).fontSize,getComputedStyle(e.querySelector('.place-label small')).fontSize]);assert.equal(sizes[0],sizes[1]);
 for(const [front,value] of [['sha',84],['camp',88],['fu',96]]){await f.locator('.army-marker[data-front="'+front+'"]').click();await f.locator('#front-story').waitFor({state:'visible'});assert.match(await f.locator('#story-crisis').innerText(),new RegExp(String(value)));await f.locator('#story-image').evaluate(img=>img.decode());assert.ok(await f.locator('#story-image').evaluate(img=>img.naturalWidth>1000));assert.ok((await f.locator('#story-text').innerText()).length>60);if(front==='fu')await page.screenshot({path:fileURLToPath(new URL('front-story.png',out)),fullPage:true});await f.locator('#close-story').click();}
 await f.locator('#contacts [data-front="sha"]').click();checks.push('危机度同地点小字字号，84/88/96初始值；三路故事与写实图片可打开');

 await f.locator('[data-suggestion]').first().click();assert.match(await f.locator('#draft').inputValue(),/东沟/);assert.equal(await f.locator('#log .mine').count(),0);
 await f.locator('#mode-toggle').click();await f.locator('#draft').fill('甲队接应沙摩柯；派200人给沙摩柯断后；派400人接应旧营；派300人给旧营断后；派100人核实刘备消息');await f.locator('#send').click();assert.match(await f.locator('#preview').innerText(),/新编队/);await f.locator('#send').click();await f.locator('.roster-row').nth(4).waitFor();
 assert.match(await f.locator('.pool-summary').innerText(),/1000/);assert.match(await f.locator('.pool-summary').innerText(),/5\/5/);checks.push('跨三路批量派遣甲队不扣预备兵，其余共扣1000人、占5队');
 await f.locator('#fu-end-round').click();await f.locator('#fu-network').filter({hasText:'第2轮'}).waitFor();await f.locator('#fu-end-round').click();await f.locator('#fu-network').filter({hasText:'第3轮'}).waitFor();assert.match(await f.locator('.pool-summary').innerText(),/伤/);checks.push('结算行军、核实、归营和实际战损');
 await page.reload();await f.locator('.pool-summary').filter({hasText:'伤'}).waitFor();assert.equal(await f.locator('.roster-row').count(),4);assert.match(await page.evaluate(()=>localStorage.getItem('yiling-ui-prototype-v1')),/保留旧记录/);checks.push('刷新保留兵池、残兵和旧版记录');
 await f.locator('[data-front="sha"]').last().click();await page.setViewportSize({width:1280,height:720});await page.screenshot({path:fileURLToPath(new URL('compact-chat.png',out)),fullPage:true});
 await f.locator('#mode-toggle').click();await f.locator('#order-unit').selectOption('1');await f.locator('#order-target').selectOption('auto');await f.locator('#draft').fill('撤回接应营');await f.locator('#send').click();await f.locator('#preview').waitFor({state:'visible'});await page.screenshot({path:fileURLToPath(new URL('compact-order.png',out)),fullPage:true});assert.equal(await f.locator('#command-panel #preview').count(),0);checks.push('残兵可手选改令，复诵在左、军情在右');
 await f.locator('#edit-order').click();await f.locator('#mode-toggle').click();await page.setViewportSize({width:390,height:844});assert.equal(await f.locator('#command-panel').isVisible(),true);await page.screenshot({path:fileURLToPath(new URL('mobile-roster.png',out)),fullPage:true});assert.equal(await f.locator('#fu-end-round').isVisible(),true);assert.equal(await f.locator('#draft').isVisible(),true);checks.push('手机军情与结束本轮常驻，输入框同时可见');
 assert.deepEqual(errors,[]);await writeFile(new URL('checks.json',out),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
