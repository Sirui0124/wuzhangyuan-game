import assert from 'node:assert/strict';

async function openChapter(page,origin,suffix=''){
 await page.goto(origin+'/?chapter=yiling'+suffix);
 await page.locator('iframe,[data-cinema-action=skip]').first().waitFor();
 if(await page.locator('[data-cinema-action=skip]').isVisible())await page.locator('[data-cinema-action=skip]').click();
 await page.locator('iframe').waitFor();
 assert.match(await page.locator('iframe').getAttribute('src'),/yiling-command/);
 const frame=page.frameLocator('iframe');
 await frame.locator('.army-marker').first().waitFor();
 if(await frame.locator('.map-first .army-fu.unread').isVisible()){
  assert.equal(await frame.locator('#fu-end-round').isDisabled(),true);
  await frame.locator('#places [data-front=fu]').click();
  await frame.locator('#story-reading').waitFor();
  await frame.locator('#story-talk').click();
 }
 if(await frame.locator('#info[open] #skip-info').isVisible())await frame.locator('#skip-info').click();
 await frame.locator('.roster-row').first().waitFor();
 return frame;
}

export async function verifyChapterFour(page,origin){
 const key='yiling-command-chapter-v1';
 const headers={'User-Agent':'Wuzhangyuan release validation'};
 await openChapter(page,origin);
 const readId=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).id,key);
 const id=await readId();
 const session=async()=>{const response=await page.request.post(origin+'/api/yiling-command/session',{headers,data:{scenarioId:id}});assert.equal(response.status(),200);return(await response.json()).session;};
 const before=await session();assert.equal(before.routeVersion,'eight-front-20261118-v4');assert.equal(before.roundLimit,8);assert.equal(before.round,0);assert.equal(Object.keys(before.fronts).length,8);
 await page.reload();await page.frameLocator('iframe').locator('.roster-row').first().waitFor();assert.equal(await readId(),id);
 const frame=await openChapter(page,origin,'&playtest=command');assert.equal(await readId(),id);assert.equal((await session()).round,0);
 await frame.locator('#fu-end-round').click();await frame.locator('#round-report[open]').waitFor();assert.match(await frame.locator('#round-report-title').innerText(),/第1轮/);
 const after=await session();assert.equal(after.scenarioId,id);assert.equal(after.round,1);assert.ok(after.revision>before.revision);
 assert.equal((await page.request.get(origin+'/api/yiling-rescue/state?session='+id,{headers})).status(),404);
 return {id,revision:after.revision,routeVersion:after.routeVersion,round:after.round,roundLimit:after.roundLimit,firstContact:true,legacyLinkSameSession:true};
}
