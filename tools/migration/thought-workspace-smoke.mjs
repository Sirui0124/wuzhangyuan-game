import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const buildRoot = resolve(process.argv[2] ?? 'GameStarter/web-demo/.build');
const { ChapterSession } = await import(pathToFileURL(resolve(buildRoot,'GameStarter/web-demo/src/chapter-session.js')));
const readJSON = path => JSON.parse(readFileSync(resolve(path), 'utf8'));
const content = readJSON(resolve(buildRoot,'story/chapter-one.script.json')), flow = readJSON(resolve(buildRoot,'story/chapter-one.flow.json'));
const manifest = readJSON(resolve(buildRoot,'story/session-manifest.json'));
const setupJudge=async input=>({schemaVersion:1,npcId:'weiyan',stage:input.stage,classification:{code:'ok',disposition:'accept',reason:'画布测试准备使用明确完整的首轮表达。',evidenceIds:[]},reply:{speaker:'魏延',text:'好，你即刻转呈，莫误军情。'}});
const session = new ChapterSession(content, flow, manifest.contentVersion,setupJudge);
const read = () => { let n = 0; while(session.snapshot().phase === 'dialogue' && n++ < 200) session.nextLine(); assert.ok(n < 200); };
const act = id => { const action = flow.actions.find(a=>a.id === id); if(session.snapshot().scene!==action.scene) session.move(action.scene); assert.ok(session.act(id)); read(); };
session.finishCinematic(); read(); ['read-notice','meet-first-scout'].forEach(act);session.chooseScout('a');read();act('intercept-first');session.setFocus('我来转呈信息');session.setDraft('将军，敌军尚未攻营，还不必强闯。帐内确实不许进入，我现在替您转呈，绝不耽误军情。');await session.confirmExpression();session.acknowledgeReply();read();['deliver-first','stand-watch'].forEach(act); session.finishCinematic(); read(); session.rewind(); read(); ['ask-guard','ask-relay','ask-scout'].forEach(act); assert.ok(session.beginThinking());
const fixture = session.serialize();
const output = resolve('outputs/compact-canvas-20261022'); mkdirSync(output,{recursive:true});
const server=createStaticServer({root:buildRoot}); await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1600,height:1000}});
const errors=[],missing=[],checks=[],errorDetails=[],failedRequests=[];
page.on('pageerror',e=>{errors.push(e.message);errorDetails.push(e.stack??e.message);}); page.on('response',r=>{if(r.status()===404)missing.push(r.url());});
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
const key='wuzhang-chapter-session-v1', state=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
const click=async action=>{
 const current=await state();
 const sceneAction=(action==='next'&&current?.phase==='dialogue')||(action==='revise'&&current?.phase==='reply')||(action==='reply'&&current?.phase==='spoken');
 if(sceneAction){
  if(action==='reply')await page.waitForFunction(()=>{const current=JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1'));return current?.phase==='spoken'&&current.speech?.status==='ready';});
  return page.locator('.game-scene').click({position:{x:24,y:(page.viewportSize()?.height??600)*.4}});
 }
 return page.locator(`[data-action="${action}"]`).first().click();
};
const screenshot=async name=>{await page.evaluate(()=>document.fonts.ready);if(!name.includes('ink-growing'))await page.waitForTimeout(220);await page.screenshot({path:resolve(output,name+'.png')});};
const open=async()=>{if(!await page.locator('#thought-inventory').count())await click('open-inventory');};
const drop=async id=>{
 await open();const row=page.locator(`[data-inventory-item="${id}"]`);await row.scrollIntoViewIfNeeded();
 const zone=page.locator('[data-thought-drop],[data-expression-drop]');await zone.scrollIntoViewIfNeeded();await page.waitForTimeout(80);const a=await row.boundingBox(),b=await zone.boundingBox();
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:18});await page.mouse.up();
};
try {
 await page.route('**/api/game/respond',route=>route.fulfill({status:503,headers:{'Access-Control-Allow-Origin':base},contentType:'application/json',body:'{"error":"isolated canvas test"}'}));
 await page.goto(base);await page.evaluate(({key,fixture})=>localStorage.setItem(key,fixture),{key,fixture});await page.reload();await click('continue');
 assert.deepEqual((await state()).thinking.placed,['C02','C03']);assert.equal(await page.locator('#thought-inventory').count(),0);assert.equal(await page.getByText('先看不同',{exact:true}).count(),0);assert.equal(await page.locator('[data-action=language-mode]').isEnabled(),false);await screenshot('01-first-thought');
 const inputBox=await page.locator('[data-thought-drop]').boundingBox(),thinkBox=await page.locator('[data-action=think]').boundingBox();assert.ok(inputBox.height<180);assert.ok(thinkBox.x>=inputBox.x+inputBox.width);assert.ok(thinkBox.height<=64);
 const cardStyle=await page.locator('[data-thought-drop]').evaluate(node=>{const s=getComputedStyle(node);return {radius:parseFloat(s.borderRadius),background:s.backgroundColor,texture:s.backgroundImage};});assert.ok(cardStyle.radius<=2);assert.equal(cardStyle.background,'rgba(0, 0, 0, 0)');assert.equal(await page.locator('.think-button').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(146, 60, 48)');assert.equal(await page.locator('html').getAttribute('data-ui-theme'),'xuan');
 await click('think');await page.waitForTimeout(160);assert.equal(await page.locator('.ink-drawing').count(),2);
 const earlyOpacity=await page.locator('.outcome-insight').evaluate(node=>Number(getComputedStyle(node).opacity));assert.ok(earlyOpacity<.5);
 await screenshot('02-ink-growing');await page.waitForTimeout(1500);assert.equal(await page.locator('[data-action=think]').isEnabled(),true);assert.equal(await page.locator('[data-action=advance-thought]').count(),0);await screenshot('03-first-insight');
 const sourceBox=await page.locator('[data-bundle-source]').boundingBox(),resultBox=await page.locator('[data-thought-result]').boundingBox();assert.ok(resultBox.x>=sourceBox.x+sourceBox.width,'Desktop evidence should feed the understanding on its right');assert.equal(await page.locator('.reasoning-curve:not(.continuation-curve)').count(),2);
 assert.equal((await state()).story.flags.JIANG_AUTH_GRANTED,undefined);checks.push('Selected paper and ink, a visible cinnabar action, and individual used-evidence curves into the adjacent understanding');
 await drop('C05');assert.ok((await state()).thinking.placed.includes('C05'));assert.equal((await state()).story.flags.Q1_DONE,undefined);
 await click('think');assert.equal((await state()).thinking.history.length,1);assert.match(await page.locator('.thought-await').innerText(),/不能证明/);
 await screenshot('04-inventory-and-boundary');await drop('C04');assert.ok((await state()).thinking.placed.includes('C04'));const beforeScroll=await page.locator('.workspace-layout').evaluate(e=>e.scrollTop);await click('notes-list');assert.ok(Math.abs(await page.locator('.workspace-layout').evaluate(e=>e.scrollTop)-beforeScroll)<3);
 await click('think');await page.waitForTimeout(180);assert.equal(await page.locator('.ink-drawing').count(),2);await page.waitForTimeout(1600);
 assert.equal((await state()).thinking.history.at(-1).outputs[0].id,'R01');assert.equal(await page.locator('.thought-record').count(),2);assert.equal((await state()).story.edges.some(edge=>edge.includes('C05')),false);await screenshot('05-military-insight');
 checks.push('Pointer drag works at the scrolled tail, history remains, and toggling the drawer preserves the canvas scroll position');
 await page.reload();await click('continue');assert.equal((await state()).thinking.history.length,2);assert.equal(await page.locator('.ink-drawing').count(),0);await click('continue-thought');
 await page.setViewportSize({width:1366,height:650});await open();await page.locator('.workspace-layout').evaluate(e=>e.scrollTop=0);
 const edgeRow=await page.locator('[data-inventory-item=C06]').boundingBox(),canvasBox=await page.locator('.workspace-layout').boundingBox();
 await page.mouse.move(edgeRow.x+80,edgeRow.y+15);await page.mouse.down();await page.mouse.move(canvasBox.x+canvasBox.width/2,canvasBox.y+canvasBox.height-30,{steps:12});
 await page.waitForFunction(()=>document.querySelector('.workspace-layout').scrollTop>48);await page.mouse.move(5,5);await page.mouse.up();assert.equal((await state()).thinking.placed.includes('C06'),false);await page.setViewportSize({width:1600,height:1000});
 checks.push('Holding a dragged clue near the canvas edge scrolls the long canvas; releasing outside cancels placement');
 await drop('C06');await page.locator('[data-inventory-item=C07]').focus();await page.keyboard.press('Enter');await page.locator('[data-place-evidence=C07]').focus();await page.keyboard.press('Enter');await click('notes-list');await click('think');await page.waitForTimeout(1700);
 assert.equal((await state()).thinking.history.at(-1).outputs[0].id,'R02');assert.equal(await page.locator('.thought-record').count(),3);assert.equal(await page.locator('.thought-action').count(),1);await page.locator('.thought-action').scrollIntoViewIfNeeded();await screenshot('06-next-action');
 await click('revise-thought');assert.equal((await state()).story.flags.Q2_DONE,false);assert.equal(await page.locator('.thought-action').count(),0);await page.locator('[data-remove-thought=C07]').click();await click('think');assert.equal((await state()).thinking.history.length,2);
 await drop('C07');await click('notes-list');await click('think');await page.waitForTimeout(1700);await click('follow-plan');
 while((await state()).phase==='dialogue') await click('next');
 checks.push('Saved canvas restores without replay; keyboard input and undo preserve history and retract action availability');
 await page.evaluate(()=>localStorage.setItem('wuzhang-reduced-motion','1'));await page.reload();await click('continue');
 if((await state()).scene!=='report_post')await page.locator('[data-move=report_post]').click();await page.locator('[data-scene-action=intercept-weiyan]').click();
 while((await state()).phase==='dialogue')await click('next');
 assert.equal((await state()).phase,'expression');await drop('R01');await drop('C08');await click('notes-list');await page.locator('#player-expression').fill('伯约亲口答应接报。往日敌军闻号即退，今夜不退又随我军换向，可能在试探。请现在随我到帐外，当面交报。');
 await page.locator('.reasoning-curve').first().waitFor({state:'attached'});assert.equal(await page.locator('.reasoning-curve').count(),1);const draft=await page.locator('#player-expression').inputValue();assert.ok(draft);await screenshot('07-expression');
 await click('reasoning-mode');assert.equal(await page.locator('.thought-record').count(),3);await page.locator('.workspace-modes').scrollIntoViewIfNeeded();await click('language-mode');assert.equal(await page.locator('#player-expression').inputValue(),draft);assert.deepEqual((await state()).story.selected,['R01','C08']);
 checks.push('Reasoning and language are two views; returning to prior reasoning preserves selected evidence and the expression draft');
 await page.evaluate(()=>localStorage.setItem('wuzhang-reduced-motion','0'));await page.reload();await click('continue');
 const calls=[],polished='禀将军，敌军今夜不退，又随我军调动换向，或是在试探。伯约已亲口应允接报，请随我立即前往。';
 await page.route('**/api/game/respond',async route=>{const headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}const request=route.request().postDataJSON();calls.push(request);await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({text:JSON.stringify(calls.length===1?{status:'ok',text:polished,evidenceIds:['R01','C08']}:{supported:true,reason:'画布接口测试'})})});});
 const ownWords='将军，今晚敌军的举动不同往日，或许想看看我军如何应对。伯约已经答应接报，请和我一起去，军情不能耽误。您要说的我都愿认真听，我也会陪您当面把消息说明白。这样既不惊扰丞相，也让急报有了去处。';
 await page.locator('#expression-focus').fill(ownWords);await page.waitForTimeout(800);assert.equal(calls.length,0);assert.equal(await page.locator('[data-action=speak]').isEnabled(),false);assert.equal(await page.locator('[data-action=think]').count(),0);
 const wordsBox=await page.locator('#expression-focus').boundingBox(),polishBox=await page.locator('[data-action=generate-expression]').boundingBox();assert.ok(polishBox.x>=wordsBox.x+wordsBox.width);assert.ok(polishBox.height<55);
 await click('generate-expression');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1')).composition.status==='ready');assert.equal(calls.length,2);assert.ok(calls[0].text.includes(ownWords));assert.equal(await page.locator('#expression-focus').inputValue(),ownWords);assert.equal(await page.locator('#player-expression').inputValue(),polished);assert.equal((await state()).phase,'expression');assert.equal(await page.locator('.reasoning-curve').count(),1);assert.equal(await page.locator('.expression-paper.is-revealing').count(),1);
 await page.locator('#expression-focus').focus();await page.waitForTimeout(1700);assert.equal(await page.locator('#expression-focus').evaluate(node=>document.activeElement===node),true);await screenshot('08-polished-own-words');
 const originalCurve=await page.locator('.reasoning-curve').getAttribute('d');await page.locator('#expression-focus').evaluate(node=>node.style.height='145px');await page.waitForTimeout(100);assert.notEqual(await page.locator('.reasoning-curve').getAttribute('d'),originalCurve);await page.locator('#expression-focus').evaluate(node=>node.style.height='');
 await page.locator('#player-expression').fill(polished+'请将军移步。');assert.equal(await page.locator('[data-action=speak]').isEnabled(),true);assert.equal(await page.locator('.expression-result.is-ready').count(),1);
 checks.push('Own wording stays beside the compact Polish button, never sends automatically, reaches the generator intact, passes grounding, and appears below for editing before explicit speech');
 const client=await page.context().newCDPSession(page);await client.send('DOM.enable');await client.send('CSS.enable');const doc=await client.send('DOM.getDocument');const node=await client.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.expression-center h1'});const font=await client.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});assert.ok(font.fonts.some(item=>/Kai|楷/i.test(item.familyName)));checks.push('Real KaiTi glyphs and curved evidence branches are integrated into the playable expression page');
 for(const [width,height] of [[1366,768],[768,1000],[390,844]]) {await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await screenshot(`expression-${width}`);}
 await page.setViewportSize({width:1600,height:1000});
 await page.evaluate(({key,fixture})=>{localStorage.setItem(key,fixture);localStorage.setItem('wuzhang-reduced-motion','1');},{key,fixture});await page.reload();await click('continue');await click('think');assert.equal(await page.locator('.ink-drawing').count(),0);assert.equal(await page.locator('[data-action=think]').isEnabled(),true);
 for(const [width,height] of [[1366,768],[768,1000],[390,844]]) {await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await screenshot(`thoughts-${width}`);}
 checks.push('Reduced motion reveals immediately; 1366, tablet and mobile layouts remain scrollable without horizontal overflow');
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);writeFileSync(resolve(output,'checks.json'),JSON.stringify({passed:true,checks,errors,missing},null,2));console.log(JSON.stringify({passed:true,checks},null,2));
} catch(error) {await screenshot('failure');writeFileSync(resolve(output,'failure-details.json'),JSON.stringify({errorDetails,failedRequests,missing},null,2));throw error;}
finally{await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
