import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStory} from '../../scripts/validate-story.mjs';
import {chapter,NarrativeEngine,preset,prepared,input,tutorialInput,finish,normal,collect} from './weiyan-fixture.mjs';
const cards=['scout_statement','jiangwei_authorization'];
test('v07 canonical types and all referenced nodes/evidence are valid',()=>assert.equal(validateStory(chapter).chapterId,'wuzhang'));
test('first successful block leads to grudge and automatic revival; all first-loop evidence is cleared',async()=>{
 const e=new NarrativeEngine(chapter,'flow',preset);tutorialInput(e);await e.submitFreeInput('propose_wait',['scout_statement'],'帐内有要事，我立即请帐内人出来接报。');finish(e);assert.equal(e.interactions().nodeId,'tutorial.execution');assert.equal(e.snapshot().flags['loop.weiyan_status'],'waiting');const old=e.snapshot().loopId;finish(e);
 assert.equal(e.interactions().nodeId,'player.revival');assert.equal(e.snapshot().flags['progress.tutorial_completed'],true);assert.notEqual(e.snapshot().loopId,old);assert.deepEqual(e.snapshot().evidence,{});assert.deepEqual(e.snapshot().drafts,{});assert(!e.snapshot().history.some(h=>h.loopId===old));
});
test('second success resolves actual reporting and chapter completion with no extra AI/promise',async()=>{
 const e=await prepared();input(e);await e.submitFreeInput('propose_wait',cards,'我立即到帐门请姜将军接报，将军暂候。');finish(e);assert.equal(e.interactions().nodeId,'v07.handoff');assert.throws(()=>e.save(),/boundary/);assert.equal(e.snapshot().flags['loop.report_status'],'none');finish(e);assert.equal(e.interactions().nodeId,'ending.safe');assert.equal(e.snapshot().flags['loop.report_status'],'relayed');finish(e);assert.equal(e.snapshot().flags['loop.completed_wuzhang'],true);assert.equal(e.snapshot().flags['loop.report_status'],'relayed');assert.equal(e.snapshot().flags['loop.player_alive'],true);assert.deepEqual(e.snapshot().promises,{});assert.equal(e.interactions().nodeId,null);
 const restored=new NarrativeEngine(chapter,'weiyan-test',preset);restored.load(e.save());assert.equal(restored.snapshot().flags['loop.result'],'safe');assert.equal(restored.currentLine(),null);
});
test('inventory alone cannot skip the second notice; first and second card sources are independent',()=>{
 const e=new NarrativeEngine(chapter,'flow',preset);collect(e);assert(e.snapshot().evidence.jiangwei_authorization);e.enterScene('report_post');e.selectCharacter('weiyan');assert.equal(e.tryPresentEvidence(cards),false);assert.equal(e.interactions().freeInput,null);assert(e.tryPresentEvidence(['entry_notice']));assert.equal(e.currentLine().text,'确有要事，已有全军告示在先');finish(e);assert(e.tryPresentEvidence([cards[0]]));assert.equal(e.interactions().freeInput,null);assert(e.tryPresentEvidence([cards[1]]));
});
test('second restart keeps only tutorial progress and requires renewed evidence and notice',async()=>{
 const e=await prepared();input(e);await e.submitFreeInput('propose_wait',cards,'即时接报');finish(e);finish(e);e.rewind();assert.equal(e.interactions().nodeId,'player.investigation');assert.equal(e.snapshot().flags['progress.tutorial_completed'],true);assert.equal(e.snapshot().flags['loop.weiyan_notice_presented'],false);assert.equal(e.snapshot().flags['loop.execution_reason'],'none');for(const key of ['evidence','drafts','promises','feedback'])assert.deepEqual(e.snapshot()[key],{});
});
test('legacy third AI and deduction/permission detours are inaccessible in v07',()=>{
 const e=new NarrativeEngine(chapter,'flow',preset);normal(e);e.selectCharacter('relay');assert(!e.interactions().topics.some(n=>n.id==='relay.contact'));assert(!e.interactions().scenes.some(s=>s.id==='relay_tent'));
 assert.equal(chapter.dialogues.filter(n=>n.freeInput&&!('not' in n.availableWhen)).length,2);
});
