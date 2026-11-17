import { addDialogueAuditReceipts } from '../../GameStarter/tests/expression-audit-fixture.mjs';
import {chromium} from 'playwright';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {polishFixtures} from '../ai/dialogue-polish-fixtures.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=process.env.POLISH_REPORT??'outputs/dialogue-polish-20261027';mkdirSync(out,{recursive:true});
const build=process.env.POLISH_BUILD??'outputs/dialogue-polish-20261027/build';
const server=createStaticServer({root:resolve(build)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const c of await polishFixtures(build)){
  const key=c.chapter==='grain'?'grain-chapter-two-films-v1':'jieting-chapter-three-v1';
  const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let hold=false,release,calls=0;
  await context.addInitScript(({key,save})=>{localStorage.setItem('wuzhang-runtime-mode-v1','ai');localStorage.setItem(key,JSON.stringify(save));},{key,save:c.session.state});
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
  await context.route('http://127.0.0.1:8787/**',async route=>{
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(route.request().url().endsWith('/health'))return route.fulfill({headers,json:{configured:true}});
   if(route.request().url().endsWith('/api/game/respond')){
    const prompt=route.request().postDataJSON().text;
    if(!prompt.startsWith('你帮助玩家')&&!prompt.startsWith('核对一段'))return route.fulfill({headers,json:{text:'{}',responseId:'unrelated'}});
    calls++;
    if(hold)await new Promise(r=>release=r);
    const value=prompt.startsWith('你帮助玩家')?{status:'ok',text:c.input.words+' 请听我把这些依据说清。',evidenceIds:c.input.evidence.map(e=>e.id)}:{facts:true,intent:true,coverage:true,logic:true,reason:''};
    try{await route.fulfill({headers,json:{text:JSON.stringify(addDialogueAuditReceipts(value,prompt)),responseId:'polish-fixture'}});}catch{}
    return;
   }
   await route.fulfill({headers,json:{}});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/?chapter=${c.chapter}`);
  await page.locator('[data-action=polish-expression]').waitFor();assert.equal(await page.locator('#game-root').getAttribute('data-node'),c.input.node);
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  await page.locator('[data-action=polish-expression]').click();await page.locator('[data-action=undo-polish]').waitFor();assert.equal(calls,1);
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  for(const field of ['node','chosen','visited','judgments','scores','roundResults'])assert.deepEqual(after[field],before[field],field);
  assert.equal(await page.locator('#player-expression').inputValue(),c.input.words+' 请听我把这些依据说清。');
  await page.screenshot({path:out+'/'+c.id+'-ui.png'});
  await page.locator('[data-action=undo-polish]').click();assert.equal(await page.locator('#player-expression').inputValue(),c.input.words);
  hold=true;await page.locator('[data-action=polish-expression]').click();await page.waitForFunction(()=>document.querySelector('[data-action=cancel-speech]')?.textContent==='取消润色');
  while(!release)await page.waitForTimeout(20);
  await page.locator('[data-action=cancel-speech]').click();release();await page.waitForTimeout(150);assert.equal(await page.locator('#player-expression').inputValue(),c.input.words);
  assert.deepEqual(errors,[]);results.push({id:c.id,polish:true,undo:true,cancel:true,stateUnchanged:true,errors});await context.close();
 }
 writeFileSync(out+'/browser-results.json',JSON.stringify({mockedApi:true,results},null,2));console.log(`${results.length} entrances: polish, undo, cancellation and no gameplay mutation passed.`);
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
