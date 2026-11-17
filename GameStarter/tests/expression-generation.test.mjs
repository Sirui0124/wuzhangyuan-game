import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChapterSession } from '../web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
import { expressionAgents } from '../web-demo/.build/GameStarter/web-demo/src/expression-agent.js';
import { ExpressionAuditError, checkExpressionAudit, expressionAuditTargets } from '../web-demo/.build/GameStarter/web-demo/src/expression-audit.js';
import { npcTurn } from './npc-fixture.mjs';
const content = JSON.parse(readFileSync(new URL('../../content/chapters/wuzhang/chapter-one.script.json', import.meta.url)));
const flow = JSON.parse(readFileSync(new URL('../../content/chapters/wuzhang/chapter-one.flow.json', import.meta.url)));
const read = s => { let n=0; while(s.row() && n++<200)s.nextLine(); assert.ok(n<200); };
const act = (s,id) => {const a=flow.actions.find(a=>a.id===id);if(s.snapshot().scene!==a.scene)s.move(a.scene);assert.ok(s.act(id));read(s);};
function first(generate,judge=async input=>npcTurn(input),branch='a') {
 const s=new ChapterSession(content,flow,'test-v2',judge,generate);s.finishCinematic();read(s);act(s,'read-notice');act(s,'meet-first-scout');
 assert.equal(s.snapshot().phase,'choice');s.chooseScout(branch);read(s);act(s,'intercept-first');return s;
}
test('branch B does not acquire or claim the unasked camp fact; first-round repair remains an actual proposal',async()=>{
 const judge=async input=>npcTurn(input,input.current.includes('待丞相方便')?'R1-RETRY':'ok');
 const s=first(undefined,judge,'b');assert.deepEqual(s.collected,['C06','C05']);assert.equal(s.snapshot().story.draft,'');
 assert.equal(s.act('deliver-first'),false);s.setDraft('可否待丞相方便时再来？');await s.confirmExpression();assert.equal(s.snapshot().speech.result,'R1-RETRY');s.acknowledgeReply();
 assert.equal(s.snapshot().phase,'reply');assert.equal(s.currentReply().id,'A-40');assert.ok(s.reviseExpression());
 s.setFocus('我来转呈信息');s.setDraft('阵前虽有叫嚷，来意尚未明，还不必强闯。帐内确实不许进入，我这就替您转呈。');await s.confirmExpression();s.acknowledgeReply();assert.equal(s.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,undefined);read(s);
 assert.equal(s.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,true);assert.equal(s.snapshot().story.flags.REPORT_CLOSED,undefined);
 s.move('camp_gate');s.act('deliver-first');while(s.row()?.id!=='A-42')s.nextLine();assert.doesNotMatch(s.row().text,/营门未破/);
});
test('generator receives only selected acquired sources and optional focus; preview is never speech',async()=>{
 let input;const s=first(async data=>{input=data;return {text:'请将军稍候，我即刻递报。',evidenceIds:['C06']};});
 s.selectEvidence('T02');s.selectEvidence('C05');s.setFocus('即刻递报');assert.ok(await s.generateExpression());
 assert.deepEqual(input.brief.selectedEvidence.map(e=>e.id),['C06']);assert.equal(input.brief.playerIntent.words,'即刻递报');assert.equal(input.brief.conversation.stage,'first');assert.deepEqual(input.verificationSources[0].originals.map(r=>r.id),['A-17']);
 assert.equal(s.snapshot().phase,'expression');assert.equal(s.snapshot().speech,null);assert.equal(s.snapshot().story.history.length,0);assert.equal(s.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,undefined);
 await s.confirmExpression();assert.equal(s.snapshot().phase,'spoken');assert.equal(s.snapshot().speech.result,'ok');assert.equal(s.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,undefined);
});
test('changed focus, selection, manual editing, cancellation, restart and opening notes discard late generation',async()=>{
 for(const change of [s=>s.setFocus('换个重点'),s=>s.selectEvidence('T02'),s=>s.setDraft('我自己的话'),s=>s.cancelGeneration(),s=>s.restart(),s=>s.openNotes()]){
  let resolve;const s=first(()=>new Promise(done=>resolve=done));const pending=s.generateExpression();change(s);const before=s.serialize();resolve({text:'迟到的文本',evidenceIds:['C06']});assert.equal(await pending,false);assert.equal(s.serialize(),before);
 }
});
test('invented evidence, empty text and outages keep inputs and never substitute generated success',async()=>{
 for(const generate of [async()=>({text:'姜维同意了',evidenceIds:['C08']}),async()=>({text:'',evidenceIds:['C06']}),async()=>{throw Error('offline');}]){
  const s=first(generate);s.setFocus('当面说明');assert.equal(await s.generateExpression(),false);assert.equal(s.snapshot().composition.status,'failed');assert.equal(s.snapshot().composition.focus,'当面说明');assert.equal(await s.confirmExpression(),false);assert.equal(s.snapshot().phase,'expression');assert.equal(s.snapshot().speech,null);assert.equal(s.snapshot().story.draft,'');assert.doesNotMatch(s.snapshot().composition.error,/参考句/);s.setDraft('我自己的话');assert.equal(s.snapshot().composition.provenance,'manual');
 }
});
test('ready preview invalidates on input changes; deliberately empty manual draft cannot fall back to a sentence',async()=>{
 const s=first(async()=>({text:'请将军稍候，我即刻递报。',evidenceIds:['C06']}));await s.generateExpression();s.setFocus('重想');assert.equal(await s.confirmExpression(),false);
 s.setDraft('');assert.equal(await s.confirmExpression(),false);s.setDraft('我愿立刻递报。');assert.ok(await s.confirmExpression());
});

test('new expression screens and empty drafts cannot insert or confirm any automatic wording',async()=>{
 let calls=0;const s=first(undefined,async input=>{calls++;return npcTurn(input);});
 assert.equal(s.suggestion,undefined);assert.equal(s.restoreSuggestion,undefined);
 assert.equal(s.snapshot().composition.provenance,'manual');assert.equal(s.snapshot().story.draft,'');
 s.setFocus('我来转呈信息');assert.equal(await s.confirmExpression(),false);assert.equal(s.snapshot().story.draft,'');
 s.setDraft('   ');assert.equal(await s.confirmExpression(),false);assert.equal(calls,0);assert.equal(s.snapshot().speech,null);
 const old=s.snapshot();old.composition.provenance='reference';old.composition.status='ready';old.story.draft='';
 const restored=first(undefined,async input=>{calls++;return npcTurn(input);});restored.restore(JSON.stringify(old));
 assert.equal(restored.snapshot().composition.provenance,'manual');assert.equal(await restored.confirmExpression(),false);assert.equal(calls,0);
});

test('older reference drafts migrate to editable manual wording without changing the saved text',async()=>{
 let actual;const original=first();original.setDraft('这是我已经改过的旧草稿。');
 const old=original.snapshot();old.composition.provenance='reference';old.composition.error='可使用参考句继续修改。';
 const restored=first(undefined,async input=>{actual=input.current;return npcTurn(input);});restored.restore(JSON.stringify(old));
 assert.equal(restored.snapshot().story.draft,old.story.draft);assert.equal(restored.snapshot().composition.provenance,'manual');
 assert.doesNotMatch(restored.snapshot().composition.error,/参考句/);
 assert.ok(await restored.confirmExpression());assert.equal(actual,old.story.draft);assert.equal('suggested' in restored.snapshot().speech,false);
});

test('generation failure preserves the actual draft and never offers an automatic sentence',async()=>{
 const s=first(async()=>{throw Error('offline');});s.setDraft('我想先问清楚军情。');s.setFocus('说得简短些');
 assert.equal(await s.generateExpression(),false);assert.equal(s.snapshot().story.draft,'我想先问清楚军情。');
 assert.doesNotMatch(s.snapshot().composition.error,/参考句/);assert.equal(s.snapshot().speech,null);
});

test('players can polish their own complete wording and restore it without the former short-focus truncation',async()=>{
 let input;const s=first(async data=>{input=data;return {text:'将军，请把急报交给我，我即刻转呈。',evidenceIds:['C06']};});
 const words='禀将军，我愿意替您立即转呈军情，请先把要紧的消息告诉我。'+ '我希望这句话说得清楚一些，也保留我自己的意思。'.repeat(5);
 assert.ok(words.length>80);s.setFocus(words);await s.generateExpression();assert.equal(input.brief.playerIntent.words,words);
 const restored=new ChapterSession(content,flow,'test-v2');restored.restore(s.serialize());assert.equal(restored.snapshot().composition.focus,words);
 assert.equal(restored.snapshot().story.draft,'将军，请把急报交给我，我即刻转呈。');assert.equal(restored.snapshot().phase,'expression');
 s.setFocus('字'.repeat(700));assert.equal(s.snapshot().composition.focus.length,600);assert.equal(await s.confirmExpression(),false);
});
test('saved generation becomes cancelled on reload without losing focus or granting events',async()=>{
 let resolve;const s=first(()=>new Promise(done=>resolve=done));s.setFocus('立即转达');const pending=s.generateExpression();const restored=new ChapterSession(content,flow,'test-v2');restored.restore(s.serialize());
 assert.equal(restored.snapshot().composition.status,'cancelled');assert.equal(restored.snapshot().composition.focus,'立即转达');assert.equal(restored.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,undefined);
 s.cancelGeneration();resolve({text:'不会采用',evidenceIds:['C06']});await pending;
});
test('AI adapter returns editable prose without a semantic audit or a gameplay verdict',async()=>{
 let input;const s=first(async data=>{input=data;return {text:'测试预览',evidenceIds:['C06']};});s.setFocus('我来转呈');await s.generateExpression();
 const calls=[];const api={respond:async request=>{calls.push(request.text);assert.ok(request.text.includes('你是历史游戏的台词编辑'));
  return {text:JSON.stringify({status:'ok',text:'请将军把急报交给我。',evidenceIds:input.brief.selectedEvidence.map(item=>item.id)})};}};
 assert.equal((await expressionAgents(api).generate(input,new AbortController().signal)).text,'请将军把急报交给我。');
 assert.equal(calls.length,1);assert.doesNotMatch(calls[0],/intentComparison|meaningMatches/);
});

const checks = { intent:true, actors:true, facts:true, items:true, coverage:true };
test('positive audit flags need valid quotations for every original clause and selected meaning',()=>{
 const brief={playerIntent:{words:'先用它传完军报，再去见伯约。'},selectedEvidence:[{id:'R01',meaning:'往夜闻号即退，今夜随我军换向，可能试探。'}]};
 const targets=expressionAuditTargets(brief),candidate='往夜闻号即退，今夜随我军换向，可能试探。先用它传完军报，再去见伯约。';
 assert.equal(targets.intent.length,2);assert.equal(targets.meanings.length,3);
 const record={checks,intentComparison:targets.intent.map(t=>({id:t.id,quote:t.text,styleOnly:false})),meaningMatches:targets.meanings.map(t=>({id:t.id,quote:t.text}))};
 assert.doesNotThrow(()=>checkExpressionAudit(record,candidate,false,targets));
 for(const change of [
  r=>r.meaningMatches.pop(),
  r=>r.intentComparison[0].quote='物品路上备用',
  r=>r.meaningMatches[1].id=r.meaningMatches[0].id,
 ]){const bad=structuredClone(record);change(bad);assert.throws(()=>checkExpressionAudit(bad,candidate,false,targets),e=>e instanceof ExpressionAuditError&&e.diagnostic.kind==='format');}
 for(const field of ['meaningMatches','intentComparison']){const missing=structuredClone(record);missing[field][0].quote='';assert.throws(()=>checkExpressionAudit(missing,candidate,false,targets),e=>e.diagnostic.kind==='content');}
 const omitted=structuredClone(record);omitted.checks.coverage=false;omitted.meaningMatches[0].quote='';omitted.reason='遗漏过去闻号即退的比较基准。';
 assert.throws(()=>checkExpressionAudit(omitted,candidate,false,targets),e=>e.diagnostic.kind==='content'&&e.diagnostic.issues.includes('coverage'));
 const changed=structuredClone(record);changed.checks.intent=false;changed.intentComparison[0].quote='';changed.reason='把传声改成备用，改变原意。';
 assert.throws(()=>checkExpressionAudit(changed,candidate,false,targets),e=>e.diagnostic.kind==='content'&&e.diagnostic.issues.includes('intent'));
});
async function auditFixture() {
 let input; const s=first(async data=>{input=data;return {text:'旧稿',evidenceIds:['C06']};});
 await s.generateExpression();
 return { input, candidate:{status:'ok',text:'将军，帐前有禁令。',evidenceIds:input.brief.selectedEvidence.map(e=>e.id)} };
}

test('writer format errors retry once without invoking the retired semantic audit',async()=>{
 const {input,candidate}=await auditFixture();
 for(const malformed of ['not json',JSON.stringify({checks:{...checks,facts:'true'}}),JSON.stringify({status:'ok',text:''})]) {
  const calls=[];const api={respond:async request=>{calls.push(request.text);return {text:calls.length===1?malformed:JSON.stringify(candidate)};}};
  assert.equal((await expressionAgents(api).generate(input,new AbortController().signal)).text,candidate.text);
  assert.equal(calls.length,2);assert.ok(calls.every(text=>text.includes('你是历史游戏的台词编辑')));
 }
});

test('writer accepts a valid JSON fenced draft on its bounded format retry',async()=>{
 const {input,candidate}=await auditFixture();let calls=0;
 const api={respond:async()=>({text:[ '格式不完整','  ```JSON\n'+JSON.stringify(candidate)+'\n```  '][calls++]})};
 assert.equal((await expressionAgents(api).generate(input,new AbortController().signal)).text,candidate.text);assert.equal(calls,2);
});

test('incomplete or invalid reference metadata is cleaned without blocking the editable wording',async()=>{
 const {input}=await auditFixture();let calls=0;
 const text='将军，先把这件事放一放。';
 const result=await expressionAgents({respond:async()=>{calls++;return {text:JSON.stringify({status:'ok',text,evidenceIds:['future-clue','C06','C06'],
  itemLinks:[{itemId:'not-attached',evidenceIds:['future-clue'],quote:'假的引文'}]})};}}).generate(input,new AbortController().signal);
 assert.equal(result.text,text);assert.deepEqual(result.evidenceIds,['C06']);assert.ok(!result.itemLinks?.length);assert.equal(calls,1);
});

test('legacy semantic refusal preserves an available player draft as editable speech',async()=>{
 for(const status of ['needs_revision','input_conflict']){
  let calls=0;const generate=expressionAgents({respond:async()=>{calls++;return {text:JSON.stringify({status,text:'',evidenceIds:[]})};}}).generate;
  const s=first(generate);s.setDraft('魏延，你这无能匹夫！');s.setFocus('请改成我从不骂人。');
  assert.ok(await s.generateExpression());assert.equal(calls,1);assert.equal(s.snapshot().story.draft,'魏延，你这无能匹夫！');
  assert.equal(s.snapshot().composition.status,'ready');assert.equal(s.snapshot().composition.error,'');assert.equal(s.snapshot().speech,null);
 }
});

test('legacy refusal with selected materials but no player words still returns an editable draft',async()=>{
 const {input}=await auditFixture();let calls=0;
 const result=await expressionAgents({respond:async()=>{calls++;return {text:JSON.stringify({status:'needs_revision',text:'',evidenceIds:[]})};}}).generate(input,new AbortController().signal);
 assert.ok(result.text.trim());assert.ok(input.brief.selectedEvidence.some(e=>result.text.includes(e.meaning)));
 assert.equal(calls,2);
});

test('cancellation during format recovery prevents further requests',async()=>{
 const {input,candidate}=await auditFixture();const controller=new AbortController();let calls=0;
 const api={respond:async()=>{calls++;if(calls===2)controller.abort();return {text:calls===1?'bad json':JSON.stringify(candidate)};}};
 await assert.rejects(expressionAgents(api).generate(input,controller.signal),{name:'AbortError'});assert.equal(calls,2);
});

test('overlong first-chapter wording is shortened once without semantic approval',async()=>{
 const {input,candidate}=await auditFixture();const calls=[];
 const long={...candidate,text:'将军，眼下这件事请听我说清楚。'.repeat(30)};
 const responses=[long,candidate];
 const actual=await expressionAgents({respond:async request=>{calls.push(request.text);return {text:JSON.stringify(responses.shift())};}}).generate(input,new AbortController().signal);
 assert.equal(actual.text,candidate.text);assert.equal(calls.length,2);
 assert.ok(calls.every(text=>text.includes('你是历史游戏的台词编辑')));
});

test('a second long draft stays complete and editable instead of becoming a polish rejection',async()=>{
 let writerCalls=0,judgeCalls=0;
 const generate=expressionAgents({respond:async request=>{
  writerCalls++;const data=JSON.parse(request.text.slice(request.text.lastIndexOf('资料：')+3));const brief=data.brief??data;
  return {text:JSON.stringify({status:'ok',text:'将军，请听我再说一遍。'.repeat(50),evidenceIds:brief.selectedEvidence.map(e=>e.id)})};
 }}).generate;
 const s=first(generate,async input=>{judgeCalls++;return npcTurn(input);});s.setDraft('我来替您转呈军情。');
 assert.ok(await s.generateExpression());assert.equal(writerCalls,2);assert.equal(judgeCalls,0);
 assert.equal(s.snapshot().story.draft,'将军，请听我再说一遍。'.repeat(50));assert.equal(s.snapshot().composition.status,'ready');
 assert.equal(s.snapshot().composition.error,'');assert.equal(s.snapshot().speech,null);
});

test('provocative wording remains editable and causes its story consequence only after player confirmation',async()=>{
 let writerCalls=0,judgeCalls=0;const text='魏延，你这无能匹夫！';
 const generate=expressionAgents({respond:async()=>{writerCalls++;return {text:JSON.stringify({status:'ok',text,evidenceIds:[]})};}}).generate;
 const s=first(generate,async input=>{judgeCalls++;assert.equal(input.current,text);const turn=npcTurn(input,'execute','放肆！拿下，处斩！');turn.classification.disposition='execute';return turn;});
 s.setFocus(text);assert.ok(await s.generateExpression());assert.equal(writerCalls,1);assert.equal(judgeCalls,0);
 assert.equal(s.snapshot().story.draft,text);assert.equal(s.snapshot().phase,'expression');assert.equal(s.snapshot().end,null);
 assert.ok(await s.confirmExpression());assert.equal(judgeCalls,1);assert.equal(s.snapshot().speech.result,'execute');assert.equal(s.snapshot().end,null);
 assert.ok(s.acknowledgeReply());assert.equal(s.snapshot().phase,'reply');assert.equal(s.snapshot().speech.npcTurn.reply.text,'放肆！拿下，处斩！');
 assert.ok(s.finishExecution());assert.equal(s.snapshot().phase,'death');assert.equal(s.snapshot().end,'weiyan-execution');
});
