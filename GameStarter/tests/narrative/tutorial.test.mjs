import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {chapter,NarrativeEngine,accepted,preset,finish,open,choose,readNotice,scoutEvidence,tutorialInput} from './weiyan-fixture.mjs';
const require=createRequire(import.meta.url);
const {ApiJudge}=require('../../.narrative-build/GameStarter/assets/scripts/narrative/judge.js');
const make=port=>new NarrativeEngine(chapter,'teaching-test',port??preset);
test('first Wei visit precedes evidence, and three intentional blocks fail without granting tutorial completion',()=>{
 const e=make();open(e,'player.intro');finish(e);open(e,'tutorial.weiyan');
 const speech=[];while(e.currentLine()){speech.push(e.currentLine().text);e.confirmLine(e.currentLine().id);}
 assert.deepEqual(speech,['军情紧急，我须入帐通报。','请将军不要进去，帐内有要事。','我就是要事']);
 for(const [i,id] of ['tutorial.block','tutorial.block.2','tutorial.block.3'].entries()){
  assert(e.choose(id,'click-'+i));assert.equal(e.choose(id,'click-'+i),false);assert.equal(e.currentLine().text,'我必须进去通报，你拦不了我');finish(e);
  assert.equal(e.snapshot().flags['loop.tutorial_blocks'],i+1);assert.equal(e.snapshot().flags['loop.player_alive'],true);
 }
 assert.equal(e.interactions().nodeId,'tutorial.failure');finish(e);assert.equal(e.snapshot().flags['loop.lamp_lit'],false);assert.equal(e.snapshot().flags['progress.tutorial_completed'],false);
 e.rewind();assert.equal(e.snapshot().flags['loop.tutorial_blocks'],0);assert.equal(e.snapshot().flags['progress.tutorial_completed'],false);
});
test('inventory and early scout presentation cannot skip notice confirmation, free input appears only after actual scout presentation',()=>{
 const e=make();open(e,'player.intro');finish(e);readNotice(e,'tutorial.notice');scoutEvidence(e,'tutorial.scout');open(e,'tutorial.weiyan');e.skipCurrentSegment();
 const before=e.snapshot();assert.equal(e.tryPresentEvidence(['scout_statement']),false);assert.deepEqual(e.snapshot(),before);assert.equal(e.interactions().freeInput,null);
 assert(e.tryPresentEvidence(['entry_notice']));assert.equal(e.currentLine().text,'确有要事，已有全军告示在先');e.confirmLine(e.currentLine().id);assert.equal(e.currentLine().text,'但是此刻军情紧急');assert.equal(e.interactions().freeInput,null);finish(e);
 assert.equal(e.snapshot().flags['loop.tutorial_notice_presented'],true);assert(e.tryPresentEvidence(['scout_statement']));assert.equal(e.interactions().freeInput,null);e.skipCurrentSegment();assert(e.interactions().freeInput);
});
test('three-choice API prompt uses the two actual presentations without history, rejects vague words and enters tent',async()=>{
 const calls=[];const port=new ApiJudge({async respond(payload){const p=JSON.parse(payload.text);calls.push(p);return {text:JSON.stringify(p.kind==='classify'?{requestId:p.requestId,choice:'ENTER_TENT',reason:'no executable report plan'}:{lead:''})};}});
 const e=make(port);tutorialInput(e);const r=await e.submitFreeInput('propose_wait',['scout_statement'],'不要进去');assert.equal(r.result.status,'need_plan');assert.match(e.currentLine().text,/我必须进去/);finish(e);assert.equal(e.interactions().nodeId,'tutorial.failure');finish(e);assert.equal(e.snapshot().flags['loop.lamp_lit'],false);
 assert.deepEqual(calls[0].presentedEvidence.map(e=>e.id).sort(),['entry_notice','scout_statement']);assert(!('context' in calls[0]));assert.match(calls[0].instructions,/ENTER_TENT/);assert(!calls[0].instructions.includes('HANDOFF_BY_MESSENGER'));
});
test('teaching accepts a timely report plan without requiring or revealing a named character',async()=>{
 const calls=[];const port=new ApiJudge({async respond(payload){const p=JSON.parse(payload.text);calls.push(p);return {text:JSON.stringify(p.kind==='classify'?{requestId:p.requestId,choice:'WAIT_OUTSIDE',planQuote:p.playerText,reason:'immediate curtain-side report'}:{lead:''})};}});
 const e=make(port);tutorialInput(e);const r=await e.submitFreeInput('propose_wait',['scout_statement'],'帐内有要事，请稍候。我马上把急报交给帐门卫士，请他隔帘通报。');assert.equal(r.result.status,'accept');assert.doesNotMatch(e.currentLine().text,/姜维|姜将军/);assert.match(calls[0].instructions,/不要求提任何特定角色/);assert.doesNotMatch(calls[0].instructions,/姜维|姜将军/);
 const n=chapter.dialogues.find(n=>n.id==='tutorial.weiyan.negotiate');assert.doesNotMatch(n.freeInput.placeholder,/姜维|姜将军/);finish(e);assert.equal(e.interactions().nodeId,'tutorial.execution');finish(e);assert.equal(e.interactions().nodeId,'player.revival');
});
test('AI outage preserves input and cannot create a story failure; cancellation ignores late acceptance',async()=>{
 const e=make({async judge(){throw new Error('network down');}});tutorialInput(e);const before=e.snapshot();assert.equal((await e.submitFreeInput('propose_wait',['scout_statement'],'现在去帐门传报')).kind,'technical_error');assert.equal(e.snapshot().flags['loop.lamp_lit'],true);assert.equal(e.snapshot().revision,before.revision);assert(e.interactions().freeInput);
 let done,request;const late=make({judge(r){request=r;return new Promise(resolve=>done=resolve);}});tutorialInput(late);const pending=late.submitFreeInput('propose_wait',['scout_statement'],'我现在去帐门传报接报');late.cancelFreeInput();done(accepted(request));assert.equal((await pending).kind,'stale');assert.equal(late.snapshot().flags['loop.weiyan_status'],'approaching');
});
