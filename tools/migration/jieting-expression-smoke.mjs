import { addDialogueAuditReceipts } from '../../GameStarter/tests/expression-audit-fixture.mjs';
import {chromium} from 'playwright';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {polishFixtures} from '../ai/dialogue-polish-fixtures.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out='outputs/jieting-expression-20261027';mkdirSync(out,{recursive:true});
const server=createStaticServer({root:resolve('GameStarter/web-demo/.build')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const c of await polishFixtures('GameStarter/web-demo/.build')){
  if(c.chapter==='jieting'){c.session.setMode({aiEnabled:true,phoneAllowed:true});assert.ok(c.session.state.visited.includes('JT-058'));c.session.state.supplies.worldItems={acquired:['fuhu-wood-tiger'],sold:['fuhu-wood-tiger']};c.session.state.supplies.purchases.push('batteries');}
  const key=c.chapter==='grain'?'grain-chapter-two-films-v1':'jieting-chapter-three-v1';
  const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let hold=false,release,calls=0,fail=false;
  await context.addInitScript(({key,save,phone})=>{localStorage.setItem('wuzhang-runtime-mode-v1',phone?'ai-phone':'ai');localStorage.setItem(key,JSON.stringify(save));},{key,save:c.session.state,phone:c.chapter==='jieting'});
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  await context.route('http://127.0.0.1:8787/**',async route=>{
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(route.request().url().endsWith('/health'))return route.fulfill({headers,json:{configured:true}});
   if(route.request().url().endsWith('/api/game/respond')){
    const prompt=route.request().postDataJSON().text;
    if(!prompt.startsWith('你帮助玩家')&&!prompt.startsWith('核对一段'))return route.fulfill({headers,json:{text:'{}',responseId:'unrelated'}});
    calls++;
    if(fail)return route.fulfill({headers,json:{text:'invalid JSON',responseId:'failure-fixture'}});
    if(hold)await new Promise(r=>release=r);
    const value=prompt.startsWith('你帮助玩家')?{status:'ok',text:c.input.words+' 请听我把这些依据说清。',evidenceIds:c.input.evidence.map(e=>e.id)}:{facts:true,intent:true,coverage:true,logic:true,items:true,reason:''};
    try{await route.fulfill({headers,json:{text:JSON.stringify(addDialogueAuditReceipts(value,prompt)),responseId:'polish-fixture'}});}catch{}
    return;
   }
   await route.fulfill({headers,json:{}});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/?chapter=${c.chapter}`);
  try{await page.locator('[data-action=polish-expression]').waitFor({timeout:10000});}catch(e){await page.screenshot({path:out+'/'+c.id+'-load-error.png'});console.error(c.id,await page.locator('body').innerText(),errors);throw e;}assert.equal(await page.locator('#game-root').getAttribute('data-node'),c.input.node);
  if(c.chapter==='jieting'){
   await page.locator('[data-action=clue-items]').click();
   assert.equal(await page.locator('.game-modal').count(),0);
   const selected=c.session.state.selected[0];
   await page.locator('.inventory-entry [data-select="'+selected+'"]').click();
   assert.equal(await page.locator('.working-clue [data-select="'+selected+'"]').count(),0);
   await page.locator('.inventory-entry [data-select="'+selected+'"]').click();
   await page.locator('.inventory-entry [data-detail="'+selected+'"]').click();
   await page.locator('.thought-detail-popover').waitFor();
   await page.locator('[data-inventory-search]').fill('不存在的测试线索');
   assert.equal(await page.locator('.inventory-entry:visible').count(),0);
   await page.locator('[data-action=clear-inventory-search]').click();
   assert.ok(await page.locator('.inventory-entry:visible').count()>0);
   await page.screenshot({path:out+'/'+c.id+'-picker.png'});
   await page.locator('[data-action=notes-list]').click();
   await page.locator('[data-action=attach-items]').click();
   await page.locator('.inventory-entry [data-attach-item=batteries]').click();
   await page.locator('.working-clue [data-detail=batteries]').click();
   await page.locator('[data-prepare-item=batteries]').click();
   await page.locator('#item-preparation').waitFor();
   await page.locator('[data-action=close-modal]').click();
   await page.locator('.working-clue [data-attach-item=batteries]').click();
  }
  const typography=await page.locator('#player-expression').evaluate(e=>({font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}));
  assert.deepEqual(typography,{font:'18px',line:'32.4px'});
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  await page.locator('[data-action=polish-expression]').click();await page.locator('[data-action=undo-polish]').waitFor();assert.equal(calls,1);
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  for(const field of ['node','chosen','visited','judgments','scores','roundResults','supplies'])assert.deepEqual(after[field],before[field],field);
  assert.equal(await page.locator('#player-expression').inputValue(),c.input.words+' 请听我把这些依据说清。');
  await page.screenshot({path:out+'/'+c.id+'-ui.png'});
  if(c.chapter==='jieting'){
   for(const width of [1554,1024,390]){
    await page.setViewportSize({width,height:930});
    await page.locator('[data-action=speak]').scrollIntoViewIfNeeded();
    const clipped=await page.locator('.expression-actions').evaluate(e=>e.scrollWidth>e.clientWidth+1);
    assert.equal(clipped,false,'action overflow at '+width);
    await page.screenshot({path:out+'/'+c.id+'-'+width+'.png'});
   }
  }
  await page.locator('[data-action=undo-polish]').click();assert.equal(await page.locator('#player-expression').inputValue(),c.input.words);
  hold=true;await page.locator('[data-action=polish-expression]').click();await page.waitForFunction(()=>document.querySelector('[data-action=cancel-speech]')?.textContent==='取消润色');
  while(!release)await page.waitForTimeout(20);
  await page.locator('[data-action=cancel-speech]').click();release();await page.waitForTimeout(150);assert.equal(await page.locator('#player-expression').inputValue(),c.input.words);
  if(c.id==='JT-OPEN-R1'){
   hold=false;fail=true;
   await page.locator('[data-action=polish-expression]').click();
   await page.waitForFunction(()=>document.querySelector('.expression-status')?.textContent.includes('原稿已保留'));
   assert.equal(await page.locator('#player-expression').inputValue(),c.input.words);
   fail=false;
   await page.setViewportSize({width:1554,height:930});
   await page.locator('#player-expression').fill('');
   assert.equal(await page.locator('[data-action=polish-expression]').isEnabled(),true,'selected clues permit polish with empty draft');
   assert.equal(await page.locator('[data-action=speak]').isDisabled(),true);
   await page.locator('#player-expression').fill(c.input.words);
   await page.screenshot({path:out+'/third-chapter-expression.png'});
  }
  assert.deepEqual(errors,[]);results.push({id:c.id,polish:true,undo:true,cancel:true,stateUnchanged:true,errors});await context.close();
 }
 writeFileSync(out+'/browser-results.json',JSON.stringify({mockedApi:true,results},null,2));console.log('Seven entrances: polish, undo, cancellation and no gameplay mutation passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
