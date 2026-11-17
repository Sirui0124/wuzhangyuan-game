import {chromium} from 'playwright';
import {createStaticServer} from '../../GameStarter/web-demo/serve.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {makeFinalAssessmentFixture} from '../../GameStarter/tests/helpers/chapter-two-final-assessment-fixture.mjs';
const scenarios=['cancel','protocol-retry','stalled-listener','carried-selection','manual-save-load'];
const requested=process.env.CH2_INTERACTION_SCENARIOS?.split(',').map(s=>s.trim()).filter(Boolean);
if(requested)assert.ok(requested.length&&requested.every(s=>scenarios.includes(s)),'CH2_INTERACTION_SCENARIOS contains an unknown scenario');
const selectedScenarios=requested??scenarios;
const build=resolve('GameStarter/web-demo/.build'),out=resolve(process.env.CH2_INTERACTION_OUTPUT??`outputs/ch2-p1p2-repairs-20261026/${requested?'interaction-ui':'interaction'}`);mkdirSync(out,{recursive:true});
const {GrainSession}=await import(pathToFileURL(build+'/GameStarter/web-demo/src/chapters/chapter-two/session.js'));
const {parseJudgment}=await import(pathToFileURL(build+'/GameStarter/web-demo/src/chapters/chapter-two/open-dialogue.js'));
const story=JSON.parse(readFileSync(build+'/story/chapter-two.films.json')),rubric=JSON.parse(readFileSync(build+'/story/chapter-two.films-rubric.json'));
const input='六月初二才领粮，五月那场酒不能单独说明这批粮是你耽误的。';
function checkpoint(id){
 const s=new GrainSession(story,undefined,rubric,false);
 for(let i=0;i<180&&s.current.id!==id;i++){
  if(s.current.kind==='open')s.submit(parseJudgment(JSON.stringify({valid:true,scores:Object.fromEntries(['trust','rigor','responsibility'].map(k=>[k,{delta:2,quote:input,reason:'开发夹具'}]))}),input,s.currentRubric));
  assert.ok(s.advance(s.current.options?.[0]?.id));
 }
 assert.equal(s.current.id,id);s.state.selected=[s.clues[0].id];s.state.selectedAt='CH2-LY03-018';return s.state;
}
const candidate={kind:'intent-bank',intents:[{id:'date_gap',quote:input}]};
const expectedReply='五月喝酒，确实不能单凭这一点解释这批粮为何迟了。粮的事总得查清，我暂且留下。';
const valid={valid:true,scores:{trust:{delta:0,quote:'',reason:'未体现'},rigor:{delta:2,quote:input,reason:'准确区分两次时间'},responsibility:{delta:0,quote:'',reason:'未体现'}},responseCandidate:candidate};
const auditFor=payload=>makeFinalAssessmentFixture(payload,{deltas:[0,2,0],intentIds:['date_gap']});

const server=createStaticServer({root:build});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
try{
 for(const scenario of selectedScenarios){
  const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();page.setDefaultTimeout(15000);let calls=0;
  const state=checkpoint(scenario==='carried-selection'?'CH2-O2-INPUT':'CH2-LY03-018');
  const uiChecks=[];
  const readSave=async(suffix='')=>page.evaluate(suffix=>JSON.parse(localStorage.getItem('grain-chapter-two-films-v1'+suffix)),suffix);
  const assertUnadvanced=async()=>{
   const saved=await readSave();assert.equal(await page.locator('#game-root').getAttribute('data-node'),state.node);
   assert.equal(saved.node,state.node);assert.deepEqual(saved.visited,state.visited);assert.deepEqual(saved.chosen,state.chosen);
   assert.deepEqual(Object.keys(saved.judgments),Object.keys(state.judgments));
  };
  const addAnotherClue=async()=>{
   const selected=(await readSave()).selected;
   await page.locator('[data-action=clue-items]').click();
   const available=await page.locator('#thought-inventory [data-select]').evaluateAll(nodes=>nodes.map(n=>n.dataset.select));
   const id=available.find(id=>!selected.includes(id));assert.ok(id,'fixture needs another available clue');
   await page.locator(`#thought-inventory [data-select="${id}"]`).click();
   await page.locator('#thought-inventory [data-action=notes-list]').click();
   return id;
  };
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({state,scenario})=>{
   localStorage.setItem('wuzhang-runtime-mode-v1','ai');if(!localStorage.getItem('grain-chapter-two-films-v1'))localStorage.setItem('grain-chapter-two-films-v1',JSON.stringify(state));
   if(scenario==='stalled-listener'){
    const add=HTMLMediaElement.prototype.addEventListener;
    HTMLMediaElement.prototype.addEventListener=function(type,...args){if(this.closest('.grain-listener')&&['ended','error'].includes(type))return;add.call(this,type,...args)};
    const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return this.closest('.grain-listener')?Promise.resolve():play.call(this)};
   }
  },{state,scenario});
  await page.route('**/health',r=>r.fulfill({json:{configured:true,model:'controlled-test'}}));
  await page.route('**/api/game/respond',async route=>{
   const n=++calls,text=route.request().postDataJSON().text;
   if(scenario==='cancel')await new Promise(r=>setTimeout(r,1100));
   const assessmentPayload=JSON.parse(text.slice(text.lastIndexOf('\n{')+1));
   const payload=scenario==='protocol-retry'&&n===1?'{':JSON.stringify(assessmentPayload.schemaVersion==='gouan-final-assessment-v1'?auditFor(assessmentPayload):valid);
   await route.fulfill({json:{text:payload,responseId:'mock-'+n}}).catch(()=>{});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/?chapter=grain`);
  await page.locator('#player-expression').waitFor();
  if(scenario==='carried-selection'){
   assert.equal(await page.locator('.working-clue').count(),1);
   assert.match(await page.locator('.grain-selection-note').innerText(),/上次选/);
   assert.equal((await readSave()).selectedAt,'CH2-LY03-018');
   await page.reload();await page.locator('#player-expression').waitFor();
   assert.equal(await page.locator('.working-clue').count(),1);
   assert.match(await page.locator('.grain-selection-note').innerText(),/上次选/);
   assert.deepEqual((await readSave()).selected,state.selected);
   assert.equal((await readSave()).selectedAt,'CH2-LY03-018');
   uiChecks.push('one carried clue retains its previous-round source after reload');
   const secondClue=await addAnotherClue();
   assert.equal(await page.locator('.working-clue').count(),2);
   assert.doesNotMatch(await page.locator('.grain-selection-note').innerText(),/上次选/);
   await page.reload();await page.locator('#player-expression').waitFor();
   assert.equal(await page.locator('.working-clue').count(),2);
   assert.deepEqual((await readSave()).selected,[...state.selected,secondClue]);
   assert.equal((await readSave()).selectedAt,state.node);
   assert.doesNotMatch(await page.locator('.grain-selection-note').innerText(),/上次选/);
   uiChecks.push('two selected clues and their current-round source survive reload');
   await page.locator('.working-clue [data-select]').first().click();
   assert.equal(await page.locator('.working-clue').count(),1);
   await page.locator('.working-clue [data-select]').first().click();
   assert.equal(await page.locator('.working-clue').count(),0);
   assert.equal(await page.locator('.grain-selection-note').count(),0);
   await page.reload();await page.locator('#player-expression').waitFor();
   assert.equal(await page.locator('.working-clue').count(),0);
   assert.equal(await page.locator('.grain-selection-note').count(),0);
   assert.deepEqual((await readSave()).selected,[]);
   uiChecks.push('removing all clues persists an empty selection with no stale note');
   await addAnotherClue();
   await page.locator('#player-expression').fill('请把缺额与隐瞒分别交代。');
   assert.doesNotMatch(await page.locator('.grain-selection-note').innerText(),/上次选/);
   await page.reload();await page.locator('#player-expression').waitFor();
   assert.doesNotMatch(await page.locator('.grain-selection-note').innerText(),/上次选/);
   assert.equal(await page.locator('.working-clue').count(),1);
   assert.equal((await readSave()).selectedAt,state.node);assert.equal(calls,0);
   await assertUnadvanced();await page.screenshot({path:out+'/carried-selection.png'});
  }else if(scenario==='manual-save-load'){
   const originalDraft='请把粮数和交接日期一并说清，我记下再核对。';
   await page.locator('#player-expression').fill(originalDraft);await addAnotherClue();
   const original=await readSave();assert.equal(original.selected.length,2);
   await page.locator('[data-action=pause]').click();await page.locator('[data-action=pause-save]').click();
   await page.locator('[data-store-slot="1"]').click();
   const slot=await readSave(':slot:1');
   assert.equal(slot.draft,originalDraft);assert.deepEqual(slot.selected,original.selected);assert.equal(slot.selectedAt,original.selectedAt);
   await assertUnadvanced();
   await page.locator('.game-modal [data-action=close-modal]').click();await page.locator('[data-action=resume-game]').click();
   await page.locator('#player-expression').fill('这是读档前临时改过的话。');
   await page.locator('.working-clue [data-select]').first().click();
   assert.equal(await page.locator('.working-clue').count(),1);
   assert.notEqual((await readSave()).draft,originalDraft);assert.deepEqual((await readSave(':slot:1')).selected,original.selected);
   await page.locator('[data-action=save]').click();await page.locator('[data-load-slot="1"]').click();
   await page.locator('#player-expression').waitFor();
   assert.equal(await page.locator('#player-expression').inputValue(),originalDraft);
   assert.equal(await page.locator('#player-expression').isEnabled(),true);
   assert.equal(await page.locator('.working-clue').count(),2);assert.equal(await page.locator('.game-modal').count(),0);
   const restored=await readSave();assert.deepEqual(restored.selected,original.selected);assert.equal(restored.selectedAt,original.selectedAt);
   await assertUnadvanced();
   await page.reload();await page.locator('#player-expression').waitFor();
   assert.equal(await page.locator('#player-expression').inputValue(),originalDraft);
   assert.equal(await page.locator('.working-clue').count(),2);await assertUnadvanced();assert.equal(calls,0);
   uiChecks.push('pause-menu save stores draft and two clues in slot 1','later edits do not overwrite the manual slot','UI load and reload restore the saved draft and clues without advancing or calling AI');
   await page.screenshot({path:out+'/manual-save-load.png'});
  }else{
   await page.locator('#player-expression').fill(input);await page.locator('[data-action=speak]').click();
   if(scenario==='cancel'){
    await page.locator('.grain-listener-controls [role=status]').waitFor();
    assert.equal(await page.locator('.grain-listener-controls [role=status]').isVisible(),true);
    assert.equal(await page.locator('.grain-listener [data-action=cancel-speech]').evaluate(button=>button===document.activeElement),true);
    await page.screenshot({path:out+'/waiting.png'});
    await page.keyboard.press('Enter');await page.waitForTimeout(1400);
    assert.equal(await page.locator('#player-expression').inputValue(),input);
    assert.equal(await page.locator('.working-clue').count(),1);assert.equal(await page.locator('#spoken-line').count(),0);
    assert.equal(await page.locator('#player-expression').evaluate(field=>field===document.activeElement),true);
    await assertUnadvanced();uiChecks.push('stop button receives focus and Enter cancels; focus returns to the preserved draft');
   }else{
    if(scenario==='protocol-retry'){
     await page.locator('.expression-status').filter({hasText:'系统未能完整处理'}).waitFor();
     assert.equal(await page.locator('#player-expression').inputValue(),input);assert.equal(await page.locator('.working-clue').count(),1);
     const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('grain-chapter-two-films-v1')));
     assert.equal(saved.judgments['CH2-LY03-018'],undefined);
     await page.screenshot({path:out+'/protocol-retry.png'});await page.locator('[data-action=speak]').click();
    }
    await page.locator('#spoken-line').waitFor();assert.equal(await page.locator('#spoken-line').innerText(),expectedReply);
    assert.equal(await page.locator('#game-root').getAttribute('data-node'),'CH2-LY03-018');
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('grain-chapter-two-films-v1')));
    assert.equal(Object.keys(saved.judgments).length,1);assert.equal(saved.judgments['CH2-LY03-018'].input,input);
    await page.screenshot({path:out+'/'+scenario+'.png'});
    if(scenario==='protocol-retry'){
     await page.reload();await page.locator('#spoken-line').waitFor();assert.equal(await page.locator('#spoken-line').innerText(),expectedReply);
     await page.locator('[data-action=revise]').click();
     const revised='我想再核对一次日期。';await page.locator('#player-expression').fill(revised);
     const beforeRevisionKeys=await readSave(),callsBeforeKeys=calls;
     await page.evaluate(()=>document.activeElement?.blur());
     await page.keyboard.press('Enter');await page.keyboard.press('Space');
     assert.equal(await page.locator('#player-expression').inputValue(),revised,'editing an existing reply cannot advance via reading keys');
     assert.deepEqual(await readSave(),beforeRevisionKeys);assert.equal(calls,callsBeforeKeys);
     await page.locator('[data-action=keep]').click();await page.locator('#spoken-line').waitFor();
     await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Enter');
     assert.notEqual((await readSave()).node,beforeRevisionKeys.node,'reading keys resume only after explicitly keeping the prior reply');
     uiChecks.push('Enter/Space cannot skip a revised draft even when a prior judgment exists; explicitly keeping the reply restores reading');
    }
   }
  }
  const diagnostics=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('wuzhang-grain-dialogue-diagnostics-v1')||'[]'));
  if(scenario==='stalled-listener')assert.ok(diagnostics.some(r=>r.events.some(e=>e.snapshotJson?.includes('media-timeout'))));
  assert.deepEqual(errors,[]);results.push({scenario,passed:true,calls,uiChecks,diagnostics});await context.close();
 }
 writeFileSync(out+'/verification.json',JSON.stringify({passed:true,kind:'controlled developer browser regression; all AI responses mocked',results},null,2));console.log(JSON.stringify(results.map(({diagnostics,...r})=>r)));
}catch(e){writeFileSync(out+'/failure.txt',String(e.stack));throw e}finally{await browser.close();await new Promise(r=>server.close(r))}
