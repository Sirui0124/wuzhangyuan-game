import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {chapter,NarrativeEngine,preset,normal,open,finish,choose,permit,prepared,input} from './weiyan-fixture.mjs';
const before=JSON.parse(readFileSync(new URL('../../../outputs/剧情审稿/正式同步v07/before/chapter.json',import.meta.url)));
const require=createRequire(import.meta.url);
const {WEIYAN_TUTORIAL_PROMPT}=require('../../.narrative-build/GameStarter/assets/scripts/narrative/weiyan-first.js');
const scenes=e=>e.interactions().scenes.map(s=>s.id);
const hidden=e=>{assert(!scenes(e).includes('camp_gate'));assert(!scenes(e).includes('report_post'));assert.throws(()=>e.enterScene('camp_gate'));};
test('second-round v07 definitions stay unchanged while teaching is revised',()=>{
 const current=chapter.dialogues.find(n=>n.id==='tutorial.execution');
 assert(current.lines.some(l=>l.id==='tutorial.execution.question'));
 for(const n of before.dialogues.filter(n=>n.id.startsWith('v07.')||n.id.startsWith('jiangwei_guard.')))
  assert.deepEqual(chapter.dialogues.find(x=>x.id===n.id),n,n.id);
 assert.match(WEIYAN_TUTORIAL_PROMPT,/军情我会转呈，将军放心/);
 assert.match(WEIYAN_TUTORIAL_PROMPT,/不要求许可/);
});
test('both soldiers must be heard; a valid request and fully delivered permission alone reveal the middle-camp option',()=>{
 const e=new NarrativeEngine(chapter,'v07',preset);normal(e);hidden(e);assert(!scenes(e).includes('jiangwei_tent_front'));
 open(e,'relay.ask_guard_first');finish(e);assert(!scenes(e).includes('jiangwei_tent_front'));
 open(e,'guard.gossip');finish(e);hidden(e);finish(e);assert(!scenes(e).includes('jiangwei_tent_front'));
 open(e,'relay.jiangwei_line');e.skipCurrentSegment();assert(!scenes(e).includes('jiangwei_tent_front'));e.completeSegment();
 assert.deepEqual(scenes(e),['notice_front','jiangwei_tent_front']);hidden(e);
 open(e,'jiangwei_guard.arrival');finish(e);e.skipCurrentSegment();hidden(e);
 const bad=chapter.dialogues.find(n=>n.id==='jiangwei_guard.request').choices.filter(c=>!c.id.endsWith('.good'));
 for(const c of [...bad,...bad]){choose(e,c.id);e.skipCurrentSegment();assert.equal(e.interactions().nodeId,'jiangwei_guard.request');assert.equal(e.snapshot().flags['loop.eaves_count'],0);assert.equal(e.snapshot().flags['loop.jiangwei_approval'],false);hidden(e);}
 choose(e,'v07.request.good');assert.equal(e.interactions().nodeId,'jiangwei_guard.authorization');hidden(e);
 while(e.currentLine()){e.confirmLine(e.currentLine().id);hidden(e);assert(!e.snapshot().evidence.jiangwei_authorization);}
 e.completeSegment();assert.equal(e.snapshot().flags['loop.jiangwei_approval'],true);assert(e.snapshot().evidence.jiangwei_authorization);
 assert.deepEqual(scenes(e),['camp_gate','jiangwei_tent_front','report_post']);e.enterScene('camp_gate');assert(e.interactions().characters.some(c=>c.id==='guard'));
 const restored=new NarrativeEngine(chapter,'v07',preset);restored.load(e.save());assert(scenes(restored).includes('camp_gate'));
 restored.rewind();finish(restored);hidden(restored);assert(!restored.snapshot().evidence.jiangwei_authorization);assert.equal(restored.snapshot().flags['loop.eaves_count'],0);
});
test('Wei arrives after scout confirmation, both presented card orders reach the same input, acceptance awaits actual handoff',async()=>{
 const early=new NarrativeEngine(chapter,'v07',preset);permit(early);early.enterScene('report_post');assert(!early.interactions().characters.some(c=>c.id==='weiyan'));
 for(const cards of [['scout_statement','jiangwei_authorization'],['jiangwei_authorization','scout_statement']]){
  const e=await prepared();input(e,cards);assert(e.interactions().freeInput);
  await e.submitFreeInput('propose_wait',cards,'军情不可迟误，丞相禁止任何人进帐。我立刻请甲隔帘向姜将军转报军情，由他定夺并承担责任。');finish(e);
  assert.equal(e.interactions().nodeId,'v07.handoff');assert.equal(e.snapshot().flags['loop.result'],'none');
  while(e.currentLine()){e.confirmLine(e.currentLine().id);assert.equal(e.snapshot().flags['loop.result'],'none');}
  e.completeSegment();assert.equal(e.snapshot().flags['loop.result'],'safe');assert.equal(e.snapshot().flags['loop.report_status'],'relayed');finish(e);assert.equal(e.snapshot().flags['loop.completed_wuzhang'],true);
 }
});
test('eavesdropping is an explicit seven-step distraction: second unchanged, four developments, then too late',()=>{
 const e=new NarrativeEngine(chapter,'v07',preset);normal(e);open(e,'v07.listen.1');e.skipCurrentSegment();assert.equal(e.snapshot().flags['loop.eaves_count'],1);
 for(let i=1;i<7;i++){
  assert.equal(e.interactions().nodeId,`v07.listen.${i}`);assert.equal(e.snapshot().flags['loop.eaves_count'],i);assert.equal(e.snapshot().flags['loop.result'],'none');
  if(i===2)assert.deepEqual(chapter.dialogues.find(n=>n.id==='v07.listen.2').lines.map(l=>l.text),chapter.dialogues.find(n=>n.id==='v07.listen.1').lines.map(l=>l.text));
  choose(e,`v07.listen.${i}.continue`);e.skipCurrentSegment();
 }
 e.completeSegment();assert.equal(e.interactions().nodeId,'ending.lamp_failure');assert.equal(e.snapshot().flags['loop.eaves_count'],7);assert.equal(e.snapshot().flags['loop.result'],'lamp_failure');assert.equal(e.snapshot().flags['loop.jiangwei_approval'],false);
});
