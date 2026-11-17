import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out='outputs/yiling-compact-20261118';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const checks=[],errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8812/?chapter=yiling&playtest=command');
 const skip=page.locator('[data-cinema-action=skip]');await skip.click();
 const f=page.frameLocator('iframe');await f.locator('#skip-info').click();await f.locator('.roster-row').waitFor();
 await f.locator('.contact-rail').waitFor();
 async function check(label){
  const result=await f.locator('#desk').evaluate(()=>{
   const ids=['#draft','#send','#fu-end-round','.input-shell','#contacts'];
   return {viewport:[innerWidth,innerHeight],documentHeight:document.documentElement.scrollHeight,boxes:ids.filter(id=>!document.querySelector(id).hidden).map(id=>{const e=document.querySelector(id),r=e.getBoundingClientRect();const x=Math.max(0,Math.min(innerWidth-1,r.x+r.width/2)),y=Math.max(0,Math.min(innerHeight-1,r.y+r.height/2));return {id,x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right,hit:e.contains(document.elementFromPoint(x,y))};})};
  });
  for(const r of result.boxes){assert.ok(r.x>=0&&r.y>=0&&r.right<=result.viewport[0]+1&&r.bottom<=result.viewport[1]+1&&r.height>0,`${label} clipped ${JSON.stringify(r)} ${result.viewport}`);assert.ok(r.hit,`${label} occluded ${r.id}`);}
  assert.ok(result.documentHeight<=result.viewport[1]+1,`${label}: body overflows`);checks.push({label,...result});
 }
 for(const [width,height] of [[1920,1080],[844,390],[390,500],[1440,900],[1440,810],[1280,720],[1280,600],[1024,600],[900,500],[800,450],[390,844],[390,667]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);await check(`${width}x${height} chat`);
  await f.locator('#draft').fill('较长的输入内容，用于检查多行输入时底部仍然完整显示。\n'.repeat(8));await check(`${width}x${height} multiline`);
  await f.locator('#draft').fill('');await page.screenshot({path:`${out}/${width}x${height}.png`});
  await f.locator('#mode-toggle').click();await f.locator('#draft').fill('甲队接应沙摩柯；派200人给沙摩柯断后；派400人接应旧营；派300人给旧营断后；派100人核实刘备消息');await check(`${width}x${height} dispatch`);
  await f.locator('#send').click();await f.locator('#preview').waitFor({state:'visible'});await check(`${width}x${height} preview`);
  await f.locator('#edit-order').click();await f.locator('#mode-toggle').click();
 }
 await page.setViewportSize({width:1280,height:600});
 for(const front of ['fu','camp','sha']){await f.locator(`#contacts [data-front=${front}]`).click();assert.equal(await f.locator(`#contacts [data-front=${front}]`).getAttribute('aria-pressed'),'true');await check('switch '+front);}
 await f.locator('[data-suggestion]').first().click();assert.ok((await f.locator('#draft').inputValue()).length>0);assert.equal(await f.locator('#send').innerText(),'传话');
 await f.locator('#resize').focus();await page.keyboard.press('End');await check('map max');await page.keyboard.press('Home');await check('map min');
 assert.deepEqual(errors,[]);
}finally{await writeFile(`${out}/checks.json`,JSON.stringify({checks,errors},null,2));await browser.close();}
console.log(`PASS ${checks.length} layouts; no clipping, occlusion or body overflow`);
