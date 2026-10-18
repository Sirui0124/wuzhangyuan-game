import test from 'node:test';
import assert from 'node:assert/strict';
import {NarrativeEngine,chapter,preset,prepared,finish,input} from './weiyan-fixture.mjs';

test('one actual evidence per submission; wrong and duplicate cards never advance or contaminate',async()=>{
 const e=await prepared();
 assert.throws(()=>e.presentEvidence(['scout_statement','jiangwei_authorization']),/exactly one/);
 assert.equal(e.tryPresentEvidence(['scout_statement','jiangwei_authorization']),false);
 assert.deepEqual(e.evidenceProgress().missing,['scout_statement','jiangwei_authorization']);
 assert(e.tryPresentEvidence(['scout_statement']));
 finish(e);assert.equal(e.interactions().freeInput,null);assert.deepEqual(e.evidenceProgress().missing,['jiangwei_authorization']);
 for(const card of ['scout_statement','entry_notice','guard_statement']){const before=e.snapshot();assert.equal(e.tryPresentEvidence([card]),false);assert.deepEqual(e.snapshot(),before);}
 assert.throws(()=>e.openTopic('negotiate','present_evidence'));
 assert(e.tryPresentEvidence(['jiangwei_authorization']));e.skipCurrentSegment();assert(e.interactions().freeInput);
 const before=e.snapshot();assert.equal(e.tryPresentEvidence(['guard_statement']),false);assert.deepEqual(e.snapshot(),before);
 assert.deepEqual(e.presentedEvidence(),['entry_notice','scout_statement','jiangwei_authorization']);
 assert(e.snapshot().history.filter(h=>h.kind==='present_evidence').every(h=>h.evidenceIds.length===1));
});
test('either required card can be first, and actual partial/full checkpoints survive refresh',async()=>{
 const e=await prepared();assert(e.tryPresentEvidence(['jiangwei_authorization']));finish(e);
 const partial=new NarrativeEngine(chapter,'weiyan-test',preset);partial.load(e.save());
 assert.equal(partial.interactions().actorId,'weiyan');assert.deepEqual(partial.evidenceProgress().missing,['scout_statement']);assert.equal(partial.interactions().freeInput,null);
 assert(partial.tryPresentEvidence(['scout_statement']));partial.skipCurrentSegment();
 const full=new NarrativeEngine(chapter,'weiyan-test',preset);full.load(partial.save());assert(full.interactions().freeInput);assert.deepEqual(full.presentedEvidence(),['entry_notice','jiangwei_authorization','scout_statement']);
 const forged=JSON.parse(partial.save());forged.presentation.evidenceIds=['entry_notice','jiangwei_authorization'];assert.throws(()=>full.load(JSON.stringify(forged)),/submitted evidence/);
});
test('leaving, switching actor, or restarting clears actual presentation and requires notice again',async()=>{
 for(const change of [e=>e.selectCharacter('scout'),e=>e.enterScene('camp_gate'),e=>e.rewind()]){
  const e=await prepared();e.tryPresentEvidence(['scout_statement']);finish(e);change(e);
  assert.deepEqual(e.presentedEvidence(),[]);assert.equal(e.snapshot().presentation,undefined);assert.equal(e.snapshot().flags['loop.weiyan_notice_presented'],false);
  if(e.interactions().nodeId)finish(e);
  if(e.snapshot().flags['loop.jiangwei_approval']){e.enterScene('report_post');e.selectCharacter('weiyan');assert.equal(e.tryPresentEvidence(['jiangwei_authorization']),false);}else assert.throws(()=>e.enterScene('report_post'));assert.equal(e.interactions().freeInput,null);
 }
});
test('caller cannot inject unavailable cards into a negotiation request',async()=>{
 const e=await prepared();input(e);await assert.rejects(e.submitFreeInput('propose_wait',['guard_statement'],'立即接报'),/not held|not submitted/);assert.equal(e.snapshot().flags['loop.result'],'none');
});

test('notice confirmation can be renewed after leaving a completed negotiation in the same loop',async()=>{
 const e=await prepared();input(e);e.enterScene('report_post');e.selectCharacter('weiyan');assert.equal(e.snapshot().flags['loop.weiyan_notice_presented'],false);
 assert(e.tryPresentEvidence(['entry_notice']));finish(e);assert.equal(e.snapshot().flags['loop.weiyan_notice_presented'],true);input(e,['jiangwei_authorization','scout_statement']);assert(e.interactions().freeInput);
});
