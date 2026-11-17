import test from 'node:test';
import assert from 'node:assert/strict';
import { firstTransfer, secondComplete } from './dialogue-lines.mjs';
import {fileURLToPath} from 'node:url';
import {dialogueFixtures} from '../../tools/ai/dialogue-fixtures.mjs';
import {npcTurn} from './npc-fixture.mjs';
const {ChapterSession,content,flow,version,first,authorized,read}=await dialogueFixtures(fileURLToPath(new URL('../web-demo/.build/',import.meta.url)));
const game=judge=>new ChapterSession(content,flow,version,judge);
const ready=async(round,judge)=>round===1?first(judge):authorized(judge);

test('confirmed draft wording uses the judge and missing service never creates a scripted success',async()=>{
 for(const round of [1,2]){
  let input,resolve;
  const session=await ready(round,data=>{input=data;return new Promise(done=>resolve=done);});
  if(round===1)session.setFocus('我来转呈信息');else {session.selectEvidence('R01');session.selectEvidence('C08');}
  session.setDraft(round===1?firstTransfer:secondComplete);const pending=session.confirmExpression();
  assert.equal(input.current,session.snapshot().speech.text);assert.equal(session.snapshot().speech.status,'waiting');
  assert.equal(session.acknowledgeReply(),false);resolve(npcTurn(input));assert.equal(await pending,true);
  assert.equal(session.snapshot().speech.status,'ready');assert.equal(session.snapshot().story.flags.PERSUADED,undefined);
 }
 const unavailable=first();
 unavailable.setFocus('我来转呈信息');unavailable.setDraft(firstTransfer);assert.equal(await unavailable.confirmExpression(),false);
 assert.equal(unavailable.snapshot().speech.status,'failed');assert.equal(unavailable.acknowledgeReply(),false);
 assert.equal(unavailable.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,undefined);assert.equal(unavailable.snapshot().end,null);
});

const executionTurn=input=>{
 const turn=npcTurn(input,'execute','放肆！拿下，处斩！');turn.classification.disposition='execute';return turn;
};
test('execution remains in the current round, survives save/reload and retries with earned clues and authorization',async()=>{
 for(const round of [1,2]){
  let execute=false;
  const judge=async input=>execute?executionTurn(input):npcTurn(input,round===1?'R1-RETRY':'P2-F4','军情究竟如何？说清楚。');
  const session=await ready(round,judge);
  assert.equal(session.finishExecution(),false);assert.equal(session.retryWeiyanRound(),false);
  session.setDraft('还有些军情未说清。');await session.confirmExpression();session.acknowledgeReply();assert.ok(session.reviseExpression());
  const before=session.snapshot();execute=true;session.setDraft('魏延，你这无能匹夫！');await session.confirmExpression();
  assert.equal(session.snapshot().end,null);assert.ok(session.acknowledgeReply());assert.equal(session.snapshot().phase,'reply');
  assert.equal(session.currentReply().text,'放肆！拿下，处斩！');assert.equal(session.reviseExpression(),false);
  assert.equal(session.snapshot().story.history.length,2);assert.equal(session.acknowledgeReply(),false);
  for(const phase of ['reply','death']){
   if(phase==='death')assert.ok(session.finishExecution());
   const restored=game(judge);restored.restore(session.serialize());assert.equal(restored.snapshot().phase,phase);
   if(phase==='reply'){assert.equal(restored.reviseExpression(),false);assert.ok(restored.finishExecution());}
   const failed=restored.snapshot();assert.equal(failed.end,'weiyan-execution');assert.equal(failed.round,round);
   assert.equal(failed.story.flags.FIRST_FAILURE_EXPERIENCED,before.story.flags.FIRST_FAILURE_EXPERIENCED);
   assert.equal(restored.rewind(),false);assert.equal(failed.story.flags.REPORT_CLOSED,undefined);
   assert.ok(restored.retryWeiyanRound());assert.equal(restored.retryWeiyanRound(),false);read(restored);
   const retry=restored.snapshot();assert.equal(retry.phase,'expression');assert.equal(retry.round,round);assert.equal(retry.end,null);
   assert.deepEqual(retry.story.collected,before.story.collected);assert.deepEqual(retry.story.edges,before.story.edges);
   assert.equal(retry.story.flags.JIANG_AUTH_GRANTED,before.story.flags.JIANG_AUTH_GRANTED);
   assert.equal(retry.story.flags.COMPANION_PRESENT,before.story.flags.COMPANION_PRESENT);
   assert.equal(retry.story.history.filter(h=>(h.round??round)===round).length,0);assert.equal(retry.speech,null);
   assert.equal(retry.story.draft,'');assert.equal(retry.story.flags.PERSUADED,undefined);
  }
 }
});

test('clarification accumulates only actual speech from this round and retains corrected wording',async()=>{
 const seen=[];const session=await ready(2,async input=>{seen.push(structuredClone(input));return npcTurn(input,'P2-F4','把话说清楚。');});
 const saved=session.snapshot(),oldTurn=npcTurn({stage:'first'},'R1-RETRY','军情究竟如何？');
 saved.story.history.push({round:1,text:'这是首轮旧话，不得填入第二轮。',feedback:oldTurn.reply.text,accepted:false,npcTurn:oldTurn});session.restore(JSON.stringify(saved));
 session.setDraft('可以等到明日再报。');await session.confirmExpression();session.acknowledgeReply();session.reviseExpression();
 session.setDraft('不等明日，我是说现在就在帐外当面交报。');await session.confirmExpression();session.acknowledgeReply();
 assert.deepEqual(seen[0].said,[]);assert.deepEqual(seen[1].said,['可以等到明日再报。']);
 assert.equal(seen[1].current,'不等明日，我是说现在就在帐外当面交报。');
 assert.deepEqual(session.snapshot().story.history.map(h=>h.round),[1,2,2]);assert.equal(session.snapshot().story.flags.PERSUADED,undefined);
});

test('restoring and retrying an execution checkpoint discards a late judgment from the replaced conversation',async()=>{
 for(const round of [1,2]){
  const source=await ready(round,async input=>executionTurn(input));
  source.setDraft('魏延，蠢货！');await source.confirmExpression();source.acknowledgeReply();source.finishExecution();
  let input,resolve;const live=await ready(round,data=>{input=data;return new Promise(done=>resolve=done);});
  live.setDraft('待确认的发言');const pending=live.confirmExpression();
  live.restore(source.serialize());assert.ok(live.retryWeiyanRound());read(live);const before=live.serialize();
  resolve(executionTurn(input));assert.equal(await pending,false);assert.equal(live.serialize(),before);assert.equal(live.busy(),false);
 }
});

test('without long text, actual player speech precedes the reply and success precedes formal closure',async()=>{
 const session=await ready(2,async input=>npcTurn(input));session.selectEvidence('R01');session.selectEvidence('C08');session.setDraft(secondComplete);await session.confirmExpression();assert.equal(session.snapshot().phase,'spoken');assert.ok(session.snapshot().speech.text);assert.equal(session.snapshot().story.flags.PERSUADED,undefined);
 session.acknowledgeReply();assert.equal(session.snapshot().story.flags.PERSUADED,true);assert.equal(session.snapshot().story.flags.FORMAL_REPORT_RECEIVED,undefined);
 while(session.row()?.id!=='E04C')assert.ok(session.nextLine());assert.equal(session.snapshot().story.flags.FORMAL_REPORT_RECEIVED,undefined);session.nextLine();assert.equal(session.snapshot().story.flags.FORMAL_REPORT_RECEIVED,true);assert.equal(session.snapshot().story.flags.REPORT_CLOSED,undefined);
 while(session.row()?.id!=='E10')assert.ok(session.nextLine());session.nextLine();assert.equal(session.snapshot().story.flags.REPORT_CLOSED,true);read(session);
 while(session.snapshot().phase==='cinematic'){session.finishCinematic();read(session);}assert.equal(session.snapshot().phase,'ending');assert.equal(session.snapshot().end,'safe');assert.ok(session.toMap());
});

test('old pending AI judgments require current rules after restore, including notes returning to spoken speech',async()=>{
 for(const inNotes of [false,true])for(const marker of [undefined,'previous-judgment-rules']){
  const session=first(async input=>npcTurn(input));session.setDraft('我去报');assert.ok(await session.confirmExpression());
  assert.equal(session.snapshot().speech.result,'ok');assert.equal(typeof session.snapshot().speech.judgmentVersion,'string');
  if(inNotes)assert.ok(session.openNotes());
  const old=session.snapshot();if(marker===undefined)delete old.speech.judgmentVersion;else old.speech.judgmentVersion=marker;
  let judged=0;const restored=game(async input=>{judged++;assert.equal(input.current,'我去报');return npcTurn(input,'R1-RETRY','眼下究竟有何军情？');});
  restored.restore(JSON.stringify(old));const pending=restored.snapshot();assert.equal(judged,0);
  assert.equal(pending.speech.status,'cancelled');assert.equal(pending.speech.result,undefined);assert.equal(pending.speech.npcTurn,undefined);
  assert.equal(pending.speech.text,'我去报');assert.equal(pending.story.draft,old.story.draft);assert.deepEqual(pending.story.collected,old.story.collected);
  assert.equal(restored.acknowledgeReply(),false);assert.equal(pending.story.flags.FIRST_TRANSFER_ACCEPTED,undefined);
  if(inNotes){assert.equal(pending.notesReturn,'spoken');assert.ok(restored.closeNotes());}
  assert.ok(await restored.retrySpeech());assert.equal(judged,1);assert.equal(restored.snapshot().speech.result,'R1-RETRY');
  assert.equal(typeof restored.snapshot().speech.judgmentVersion,'string');assert.ok(restored.acknowledgeReply());
  assert.equal(restored.snapshot().phase,'reply');assert.equal(restored.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,undefined);
 }
});

test('old judgments already read as replies keep their recorded outcome and are not judged again',async()=>{
 for(const inNotes of [false,true]){
  const session=first(async input=>npcTurn(input,'R1-RETRY','军情还未说清。'));session.setDraft('我去报');
  assert.ok(await session.confirmExpression());assert.ok(session.acknowledgeReply());if(inNotes)assert.ok(session.openNotes());
  const old=session.snapshot();delete old.speech.judgmentVersion;
  const restored=game(async()=>{throw Error('已读回应不应重新调用判断');});restored.restore(JSON.stringify(old));
  if(inNotes)assert.ok(restored.closeNotes());const after=restored.snapshot();
  assert.equal(after.phase,'reply');assert.equal(after.speech.status,'ready');assert.equal(after.speech.result,'R1-RETRY');
  assert.deepEqual(after.story.history,old.story.history);assert.equal(restored.currentReply().text,'军情还未说清。');
  assert.equal(restored.acknowledgeReply(),false);assert.ok(restored.reviseExpression());
 }
});

const c07TitleVersions={
 before:'3bd9c4a6b70da9acb616d9aba1fb2b8aecf85b423aafb7306446f7f291d64ad3',
 after:'497cb95b2874e57c4e4fc36a83e8faa80d3353a14fea18a0749ddb4ace0f9d5e',
};

test('the verified C07 title rename preserves real progress, graph and wording when loading the exact successor',async()=>{
 const source=await authorized();source.selectEvidence('C08');source.setFocus('当面交报');source.setDraft('请将军先听我说');
 const saved=source.snapshot();saved.contentVersion=c07TitleVersions.before;const raw=JSON.stringify(saved);
 const target=new ChapterSession(content,flow,c07TitleVersions.after);target.restore(raw);const after=target.snapshot();
 assert.equal(after.contentVersion,c07TitleVersions.after);assert.equal(after.phase,saved.phase);assert.equal(after.scene,saved.scene);assert.equal(after.round,saved.round);
 for(const key of ['collected','completed','edges','selected','positions','history','draft'])assert.deepEqual(after.story[key],saved.story[key],key);
 assert.deepEqual(after.composition,saved.composition);assert.deepEqual(after.thinking,saved.thinking);
 assert.equal(after.story.flags.JIANG_AUTH_GRANTED,true);assert.equal(after.story.flags.REPORT_CLOSED,undefined);
 assert.equal(JSON.parse(target.serialize()).contentVersion,c07TitleVersions.after);assert.equal(JSON.stringify(saved),raw);
 target.setDraft('读档后继续修改');assert.equal(target.snapshot().story.draft,'读档后继续修改');
});

test('C07 title compatibility rejects unknown hashes, reverse migration and any different destination',()=>{
 const source=first();source.setDraft('已写好的话');const saved=source.snapshot();
 for(const [from,to] of [['unknown-content-version',c07TitleVersions.after],[c07TitleVersions.after,c07TitleVersions.before],[c07TitleVersions.before,'another-content-version']]){
  const target=new ChapterSession(content,flow,to),before=target.snapshot();
  assert.throws(()=>target.restore(JSON.stringify({...saved,contentVersion:from})),/版本不兼容/);
  assert.deepEqual(target.snapshot(),before);
 }
});

test('the known C07 title migration cannot bypass saved event validation',async()=>{
 const source=await authorized();const saved=source.snapshot();saved.contentVersion=c07TitleVersions.before;
 // This legacy version predates displayed-row snapshots; keep the missing-source fault isolated.
 delete saved.displayedRows;
 saved.story.completed=saved.story.completed.filter(id=>id!=='J14');
 const target=new ChapterSession(content,flow,c07TitleVersions.after),before=target.snapshot();
 assert.throws(()=>target.restore(JSON.stringify(saved)),/线索缺少实际来源|交涉缺少本人授权/);
 assert.deepEqual(target.snapshot(),before);
});


test('two clarifications unlock optional authored help; confirmation progresses without another model veto', async () => {
 const { expressionHelp } = await import('../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/expression-help.js');
 for (const round of [1, 2]) {
  let calls = 0;
  const judge = async input => { calls++; return npcTurn(input, round === 1 ? 'R1-RETRY' : 'P2-F4'); };
  const s = round === 1 ? first(judge, undefined, 'b') : await authorized(judge);
  const before = s.snapshot();
  assert.equal(expressionHelp(before), null); assert.equal(s.useExpressionHelp(), false);
  for (let n = 0; n < 2; n++) {
   s.setDraft('请将军再听我解释。'); assert.ok(await s.confirmExpression()); s.acknowledgeReply(); s.reviseExpression();
   assert.equal(s.snapshot().phase, 'expression');
   if (n === 0) assert.equal(expressionHelp(s.snapshot()), null);
  }
  const draft = s.snapshot().story.draft, help = expressionHelp(s.snapshot());
  assert.ok(help); assert.equal(s.snapshot().story.draft, draft, 'reading help does not replace the draft');
  assert.ok(s.useExpressionHelp()); assert.equal(s.snapshot().phase, 'expression');
  assert.equal(s.snapshot().story.history.filter(h => h.round === round).length, 2, 'using help does not speak');
  const restored = game(judge); restored.restore(s.serialize());
  assert.equal(expressionHelp(restored.snapshot()), help); assert.ok(await restored.confirmExpression());
  assert.equal(restored.snapshot().speech.result, 'ok'); assert.equal(calls, 2);
  assert.deepEqual(restored.snapshot().story.collected, before.story.collected);
  assert.equal(restored.snapshot().story.flags.REPORT_CLOSED, undefined);
  restored.acknowledgeReply(); assert.equal(restored.snapshot().phase, 'dialogue');
 }
});

test('help cannot bypass facts, edits, other-round history or technical failures', async () => {
 const { expressionHelp } = await import('../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/expression-help.js');
 let calls=0;
 const s=await authorized(async input=>{calls++;return npcTurn(input,'P2-F4');});
 for(let n=0;n<2;n++){s.setDraft('再说一次');await s.confirmExpression();s.acknowledgeReply();s.reviseExpression();}
 const state=s.snapshot(), text=expressionHelp(state); assert.ok(text);
 for(const id of ['C02','C03','C06','C08']) {
  const changed=structuredClone(state);changed.story.collected=changed.story.collected.filter(x=>x!==id);
  assert.equal(expressionHelp(changed),null,id);
 }
 const companion=structuredClone(state);companion.story.flags.COMPANION_PRESENT=false;assert.equal(expressionHelp(companion),null);
 const old=structuredClone(state);old.story.history.forEach(h=>h.round=1);assert.equal(expressionHelp(old),null);
 s.useExpressionHelp();s.setDraft(text+'不过等明天再报。');await s.confirmExpression();
 assert.equal(calls,3);assert.notEqual(s.snapshot().speech.result,'ok');
 const failed=first(async()=>{throw Error('offline');});
 for(let n=0;n<3;n++){failed.setDraft('我的话');await failed.confirmExpression();failed.reviseExpression();}
 assert.equal(expressionHelp(failed.snapshot()),null,'network errors do not count as story attempts');
});
