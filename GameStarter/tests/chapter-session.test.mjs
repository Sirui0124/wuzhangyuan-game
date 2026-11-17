import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChapterSession } from '../web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
import { balance } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/supplies.js';
import { npcTurn } from './npc-fixture.mjs';
import { firstWait, firstTransfer, secondAuthorization, secondMilitary, secondComplete } from './dialogue-lines.mjs';
const content=JSON.parse(readFileSync(new URL('../../content/chapters/wuzhang/chapter-one.script.json',import.meta.url)));
const flow=JSON.parse(readFileSync(new URL('../../content/chapters/wuzhang/chapter-one.flow.json',import.meta.url)));
// These state-machine tests control judgments explicitly; semantic classification has its own suite.
const fixtureJudge=async input=>{
 const words=[...input.said,input.current].join('');
 const code=input.stage==='first'?(input.current.includes('待丞相方便')?'R1-RETRY':'ok'):(words.includes('往日')&&words.includes('姜维已亲口应允')?'ok':'P2-F4');
 const text=code==='ok'?(input.stage==='first'?'好，你即刻转呈，莫误军情。':'带路，我亲自问他。'):content.rows.find(r=>r.id===(code==='R1-RETRY'?'A-40':code)).text;
 return npcTurn(input,code,text);
};
const game=(judge=fixtureJudge)=>new ChapterSession(content,flow,'test-content-v1',judge);
const read=game=>{let guard=0;while(game.snapshot().phase==='dialogue'&&guard++<200)game.nextLine();assert.ok(guard<200);};
const act=(game,id)=>{const action=flow.actions.find(a=>a.id===id);if(game.snapshot().scene!==action.scene)assert.ok(game.move(action.scene));assert.ok(game.act(id),id);read(game);};
function firstExpression(game){
 game.finishCinematic();read(game);act(game,'read-notice');act(game,'meet-first-scout');assert.equal(game.snapshot().phase,'choice');game.chooseScout('a');read(game);act(game,'intercept-first');
 assert.equal(game.snapshot().phase,'expression');
}
async function playFirstRound(game){
 firstExpression(game);game.setDraft(firstWait);await game.confirmExpression();assert.equal(game.snapshot().speech.result,'R1-RETRY');game.acknowledgeReply();
 assert.equal(game.snapshot().phase,'reply');assert.equal(game.currentReply().id,'A-40');assert.ok(game.reviseExpression());
 game.setFocus('我来转呈信息');game.setDraft(firstTransfer);await game.confirmExpression();game.acknowledgeReply();read(game);
 for(const id of ['deliver-first','stand-watch'])act(game,id);assert.equal(game.snapshot().phase,'cinematic');game.finishCinematic();read(game);assert.equal(game.snapshot().phase,'death');
}
// Build the shared checkpoint through actual actions and an injected judge, never forged progress.
const firstRoundSeed=game();await playFirstRound(firstRoundSeed);const firstDeathSave=firstRoundSeed.serialize();
function firstRound(session){session.restore(firstDeathSave);}
function toCanvas(game){firstRound(game);assert.ok(game.rewind());read(game);for(const id of ['ask-guard','ask-relay','ask-scout'])act(game,id);assert.equal(game.snapshot().phase,'thought-prompt');assert.ok(game.beginThinking());assert.equal(game.snapshot().phase,'thoughts');}
function toExpression(game){toCanvas(game);game.connect('C02','C03');game.connect('R01','C06');game.connect('C06','C07');assert.ok(game.followPlan());read(game);act(game,'intercept-weiyan');assert.equal(game.snapshot().phase,'expression');}

test('legacy saves gain a chapter identity while preserving actual progress and editable drafts',()=>{
 const session=game();toExpression(session);session.selectEvidence('C08');session.setDraft('请将军先听我说');
 const before=session.snapshot(),legacy=structuredClone(before);delete legacy.chapterId;
 const legacyText=JSON.stringify(legacy),restored=game();restored.restore(legacyText);
 const after=restored.snapshot();
 assert.equal(after.chapterId,'wuzhang');assert.equal(after.phase,before.phase);assert.equal(after.scene,before.scene);
 assert.deepEqual(after.story.collected,before.story.collected);assert.deepEqual(after.story.completed,before.story.completed);
 assert.deepEqual(after.story.edges,before.story.edges);assert.equal(after.story.draft,before.story.draft);
 assert.equal(after.story.flags.JIANG_AUTH_GRANTED,true);assert.equal(after.story.flags.REPORT_CLOSED,undefined);
 assert.equal(JSON.stringify(legacy),legacyText);
 restored.setDraft('读档后继续修改');assert.equal(restored.snapshot().story.draft,'读档后继续修改');
 assert.equal(session.snapshot().story.draft,before.story.draft);
});

test('another chapter cannot load into this runtime or cancel a live utterance',async()=>{
 let resolveTurn;
 const session=game(input=>new Promise(resolve=>{resolveTurn=()=>resolve(npcTurn(input));}));
 firstExpression(session);session.setDraft('我来转呈这份急报');const request=session.confirmExpression();
 const before=session.snapshot(),foreign={...before,chapterId:'grain'};
 assert.throws(()=>session.restore(JSON.stringify(foreign)),/版本/);
 assert.deepEqual(session.snapshot(),before);assert.equal(session.busy(),true);
 resolveTurn();assert.equal(await request,true);assert.equal(session.snapshot().speech.status,'ready');
 assert.equal(session.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,undefined);
 assert.throws(()=>new ChapterSession(content,{...flow,id:'grain'},'test-content-v1'),/章节流程/);
});

test('chapter content rejects broken scene references and duplicate identities before entering play',()=>{
 const changes=[
  candidate=>candidate.scenes.push(structuredClone(candidate.scenes[0])),
  candidate=>candidate.cinematics.push(structuredClone(candidate.cinematics[0])),
  candidate=>{candidate.sections[0].scene='other_chapter_scene';},
  candidate=>{candidate.actions[0].scene='other_chapter_scene';},
  candidate=>candidate.scenes[0].routes.push('other_chapter_scene'),
  candidate=>{candidate.entry={kind:'unknown',id:'explore'};},
 ];
 for(const change of changes){
  const invalid=structuredClone(flow);change(invalid);
  assert.throws(()=>new ChapterSession(content,invalid,'test-content-v1'));
 }
 const repeatedRows=structuredClone(content);repeatedRows.rows.push(structuredClone(content.rows[0]));
 assert.throws(()=>new ChapterSession(repeatedRows,flow,'test-content-v1'),/剧情行 ID 重复/);
});

test('first refusal stays on the actual reply and preserves wording, focus and evidence until explicit revision',async()=>{
 const session=game();firstExpression(session);session.setFocus('请先听我说');session.setDraft(session.snapshot().round===1?firstWait:secondAuthorization);const before=session.snapshot();
 await session.confirmExpression();const speech=session.snapshot().speech;assert.ok(session.acknowledgeReply());const replied=session.snapshot();
 assert.equal(replied.phase,'reply');assert.equal(session.currentReply().id,'A-40');assert.equal(session.currentReply().text,session.sourceRow('A-40').text);
 assert.equal(replied.speech.text,speech.text);assert.equal(replied.story.draft,before.story.draft);assert.equal(replied.composition.focus,before.composition.focus);assert.deepEqual(replied.story.selected,before.story.selected);
 assert.equal(replied.story.history.length,before.story.history.length+1);assert.equal(replied.story.flags.FIRST_TRANSFER_ACCEPTED,undefined);
 assert.equal(session.acknowledgeReply(),false);assert.equal(session.snapshot().story.history.length,replied.story.history.length);
 assert.equal(await session.confirmExpression(),false);assert.equal(session.snapshot().phase,'reply');
 assert.ok(session.reviseExpression());assert.equal(session.snapshot().phase,'expression');assert.equal(session.currentReply()==null,true);assert.equal(session.snapshot().speech,null);
 assert.equal(session.snapshot().story.draft,speech.text);assert.equal(session.snapshot().composition.focus,before.composition.focus);assert.deepEqual(session.snapshot().story.selected,before.story.selected);
});

test('reply notes and saved reload return to the same refusal without repeating history or granting authority',async()=>{
 for(const round of [1,2]){
  const session=game();if(round===1)firstExpression(session);else {toExpression(session);session.selectEvidence('C08');}
  session.setDraft(session.snapshot().round===1?firstWait:secondAuthorization);await session.confirmExpression();session.acknowledgeReply();assert.equal(session.snapshot().phase,'reply');
  const before=session.snapshot(),replyId=session.currentReply().id;assert.ok(session.openNotes());assert.equal(session.snapshot().notesReturn,'reply');
  const notesSave=game();notesSave.restore(session.serialize());assert.ok(notesSave.closeNotes());assert.equal(notesSave.snapshot().phase,'reply');assert.equal(notesSave.currentReply().id,replyId);
  const restored=game();restored.restore(notesSave.serialize());assert.equal(restored.snapshot().phase,'reply');assert.equal(restored.currentReply().id,replyId);assert.equal(restored.acknowledgeReply(),false);
  assert.deepEqual(restored.snapshot().story.history,before.story.history);assert.deepEqual(restored.snapshot().story.selected,before.story.selected);assert.equal(restored.snapshot().story.draft,before.story.draft);
  assert.equal(restored.snapshot().story.flags.JIANG_AUTH_GRANTED,before.story.flags.JIANG_AUTH_GRANTED);assert.equal(restored.snapshot().story.flags.PERSUADED,undefined);assert.equal(restored.snapshot().story.flags.REPORT_CLOSED,undefined);
  assert.ok(restored.reviseExpression());assert.equal(restored.snapshot().phase,'expression');
 }
});

test('a second utterance replaces the visible reply and success still enters real NPC dialogue',async()=>{
 let verdict='R1-RETRY';const session=game(async input=>npcTurn(input,verdict));firstExpression(session);
 session.setDraft('先请将军稍候。');await session.confirmExpression();session.acknowledgeReply();const old=session.currentReply().text;
 assert.ok(session.reviseExpression());session.setDraft('请把急报交给我，我立即转呈。');verdict='ok';await session.confirmExpression();
 assert.equal(session.snapshot().phase,'spoken');assert.equal(session.currentReply()==null,true);assert.equal(session.snapshot().speech.text,'请把急报交给我，我立即转呈。');assert.notEqual(session.snapshot().speech.text,old);
 assert.equal(session.snapshot().story.history.length,1);session.acknowledgeReply();assert.equal(session.snapshot().phase,'dialogue');assert.ok(session.row());assert.equal(session.currentReply()==null,true);
 assert.equal(session.snapshot().story.history.length,2);assert.equal(session.snapshot().story.history[1].feedback,'好，速速转达，莫误军情。');assert.equal(session.row().text,'好，速速转达，莫误军情。');assert.equal(session.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,undefined);
 read(session);assert.equal(session.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,true);
});

test('confirmed speech is immutable until the player explicitly returns from the reply to editing',async()=>{
 const session=game();firstExpression(session);session.setFocus('请先听我说');session.setDraft(session.snapshot().round===1?firstWait:secondAuthorization);await session.confirmExpression();
 for(const phase of ['spoken','reply']){
  if(phase==='reply')session.acknowledgeReply();assert.equal(session.snapshot().phase,phase);const before=session.snapshot();
  session.setDraft('不得改写已经说出口的话');session.setFocus('不得改写已确认发言的重点');session.selectEvidence('C06');session.setDraft(session.snapshot().round===1?firstWait:secondAuthorization);
  assert.deepEqual(session.snapshot(),before);
 }
 assert.ok(session.reviseExpression());session.setDraft('现在可以明确修改。');assert.equal(session.snapshot().story.draft,'现在可以明确修改。');
});

test('reply reload rejects missing or mismatched history, including notes that would return to a reply',async()=>{
 for(const round of [1,2]){
  const session=game();if(round===1)firstExpression(session);else {toExpression(session);session.selectEvidence('C08');}
  session.setDraft(session.snapshot().round===1?firstWait:secondAuthorization);await session.confirmExpression();session.acknowledgeReply();assert.equal(session.snapshot().phase,'reply');
  for(const inNotes of [false,true]){
   if(inNotes)assert.ok(session.openNotes());
   for(const change of [raw=>raw.story.history.pop(),raw=>{raw.story.history.at(-1).feedback='这不是该结果的真实回应。';},raw=>{raw.story.history.at(-1).text='这不是本次说过的话。';},raw=>{raw.story.history.at(-1).accepted=true;},raw=>{raw.speech.result=round===1?'P2-F4':'R1-RETRY';}]){
    const raw=session.snapshot();change(raw);assert.throws(()=>game().restore(JSON.stringify(raw)));
   }
  }
 }
});

test('the main chapter traverses real scene actions, films, death and rewind',async()=>{
 const session=game();assert.equal(session.snapshot().phase,'cinematic');assert.equal(session.act('intercept-weiyan'),false);
 await playFirstRound(session);assert.ok(session.snapshot().story.completed.includes('A-33'));assert.ok(session.snapshot().story.completed.includes('A-34'));
 assert.equal(session.snapshot().story.flags.REPORT_CLOSED,undefined);assert.deepEqual(session.snapshot().story.collected,['C06','T02','C05']);
 session.rewind();read(session);assert.equal(session.snapshot().round,2);assert.equal(session.snapshot().scene,'camp_gate');assert.equal(session.collected.length,0);
});
test('investigation records sources at actual dialogue completion and memory only after D26',()=>{
 const session=game();firstRound(session);session.rewind();read(session);session.act('ask-guard');session.nextLine();assert.equal(session.collected.includes('C06'),false);session.nextLine();assert.equal(session.collected.includes('C06'),true);read(session);
 act(session,'ask-relay');assert.equal(session.snapshot().story.flags.JIANG_DUTY_KNOWN,true);assert.equal(session.snapshot().story.flags.JIANG_AUTH_GRANTED,undefined);assert.equal(session.collected.includes('C05'),false);
 act(session,'ask-scout');assert.equal(session.collected.length,5);assert.equal(session.collected.includes('C05'),true);assert.equal(session.snapshot().phase,'thought-prompt');assert.deepEqual(session.snapshot().panelOpened,[]);assert.ok(session.beginThinking());assert.deepEqual(session.snapshot().panelOpened,['P1']);
});
test('R02 remains a plan and incomplete/invalidated proofs cannot enter the real authorization scene',()=>{
 const session=game();toCanvas(session);session.connect('C02','C03');assert.equal(session.followPlan(),false);session.connect('R01','C06');session.connect('C06','C07');
 assert.equal(session.snapshot().story.flags.JIANG_AUTH_GRANTED,undefined);session.deleteConnection('C02|C03');assert.equal(session.followPlan(),false);session.connect('C02','C03');assert.ok(session.followPlan());
});
test('the same graph and draft survive opening notes from dialogue and expression',()=>{
 const session=game();toExpression(session);const edges=session.snapshot().story.edges;session.selectEvidence('C08');session.setDraft('我自己的短句');assert.ok(session.openNotes());assert.ok(session.selectEvidence('R01'));assert.ok(session.closeNotes());
 assert.equal(session.snapshot().phase,'expression');assert.equal(session.snapshot().story.draft,'我自己的短句');assert.deepEqual(session.snapshot().story.edges,edges);assert.deepEqual(session.snapshot().panelOpened,['P1','P2']);
});

test('a short partial answer first shows its actual P2 reply, then explicit repair can accumulate sourced statements',async()=>{
 const session=game();toExpression(session);session.selectEvidence('C08');session.setDraft(secondAuthorization);const before=session.snapshot();await session.confirmExpression();session.acknowledgeReply();assert.equal(session.snapshot().phase,'reply');assert.equal(session.currentReply().id,'P2-F4');assert.match(session.currentReply().text,/不同/);assert.equal(session.snapshot().story.flags.JIANG_AUTH_GRANTED,true);
 assert.equal(session.snapshot().story.draft,before.story.draft);assert.deepEqual(session.snapshot().story.selected,before.story.selected);assert.ok(session.reviseExpression());assert.equal(session.snapshot().phase,'expression');
 session.selectEvidence('C08');session.selectEvidence('R01');session.setDraft(secondMilitary);await session.confirmExpression();session.acknowledgeReply();assert.equal(session.snapshot().story.flags.PERSUADED,true);assert.deepEqual(session.snapshot().panelOpened,['P1','P2']);
});
test('late model success after cancellation cannot mutate speech, authorization or story events',async()=>{
 let resolve;const session=game(()=>new Promise(ok=>resolve=ok));toExpression(session);session.setDraft('我要自由表达');const request=session.confirmExpression();assert.equal(session.snapshot().speech.status,'waiting');session.cancelSpeech();resolve('ok');await request;
 assert.equal(session.snapshot().speech.status,'cancelled');assert.equal(session.snapshot().phase,'spoken');assert.equal(session.currentReply()==null,true);assert.equal(session.acknowledgeReply(),false);assert.equal(session.snapshot().story.flags.PERSUADED,undefined);assert.equal(session.snapshot().story.flags.REPORT_CLOSED,undefined);assert.equal(session.snapshot().story.draft,'我要自由表达');assert.ok(session.reviseExpression());
});
test('service failure and invalid model output preserve all acquired evidence and the editable draft',async()=>{
 const session=game(async()=>{throw Error('offline');});toExpression(session);const edges=session.snapshot().story.edges,history=session.snapshot().story.history;session.setDraft('先听我说');await session.confirmExpression();assert.equal(session.snapshot().speech.status,'failed');assert.equal(session.snapshot().phase,'spoken');assert.equal(session.currentReply()==null,true);assert.equal(session.acknowledgeReply(),false);assert.deepEqual(session.snapshot().story.history,history);assert.deepEqual(session.snapshot().story.edges,edges);assert.equal(session.snapshot().story.flags.JIANG_AUTH_GRANTED,true);session.reviseExpression();assert.equal(session.snapshot().story.draft,'先听我说');
});
test('save/reload restores the exact scene, dialogue, graph and confirmed speech without new grants',async()=>{
 const session=game();toExpression(session);session.selectEvidence('R01');session.selectEvidence('C08');session.setDraft(secondComplete);await session.confirmExpression();const restored=game();restored.restore(session.serialize());assert.equal(restored.snapshot().phase,'spoken');assert.deepEqual(restored.snapshot().story.edges,session.snapshot().story.edges);assert.equal(restored.snapshot().speech.text,session.snapshot().speech.text);restored.acknowledgeReply();assert.equal(restored.snapshot().story.flags.PERSUADED,true);assert.equal(restored.snapshot().story.flags.REPORT_CLOSED,undefined);
});
test('stored invented authorization and report flags are rebuilt from actual sources, never trusted',()=>{
 const session=game();toCanvas(session);const raw=session.snapshot();raw.story.flags.JIANG_AUTH_GRANTED=true;raw.story.flags.REPORT_CLOSED=true;const restored=game();restored.restore(JSON.stringify(raw));assert.equal(restored.snapshot().story.flags.JIANG_AUTH_GRANTED,undefined);assert.equal(restored.snapshot().story.flags.REPORT_CLOSED,undefined);
 raw.phase='ending';assert.throws(()=>restored.restore(JSON.stringify(raw)),/接报/);raw.contentVersion='unknown';assert.throws(()=>restored.restore(JSON.stringify(raw)),/版本/);
});
test('a manual save at P1 restores a completed plan before actual authorization',()=>{
 const session=game();toCanvas(session);session.connect('C02','C03');session.connect('R01','C05');session.connect('R01','C06');session.connect('C06','C07');
 const restored=game();restored.restore(session.serialize());assert.deepEqual(restored.snapshot().story.edges,session.snapshot().story.edges);assert.ok(restored.graph().R02);assert.equal(restored.snapshot().story.flags.JIANG_AUTH_GRANTED,undefined);
});
test('moving around, viewing notes and duplicate completion never penalize time or revoke real events',()=>{
 const session=game();toExpression(session);session.openNotes();const before=session.snapshot();session.connect('R01','C05');session.deleteConnection('R01|C05');assert.equal(session.snapshot().story.flags.JIANG_AUTH_GRANTED,true);assert.equal(session.snapshot().story.flags.COMPANION_PRESENT,true);assert.equal(session.snapshot().finishedSections.length,before.finishedSections.length);assert.equal(session.finishCinematic(),false);
});

test('two military clues produce one answer, and continuation gates the next question',()=>{
 const s=game();toCanvas(s);assert.deepEqual(s.snapshot().thinking.placed,['C02','C03']);
 assert.equal(s.placeThought('C08'),false);assert.equal(s.placeThought('C04'),false);
 assert.equal(s.think(),'R01');assert.equal(s.think(),null);assert.equal(s.placeThought('C06'),false);
 assert.equal(s.snapshot().thinking.history.length,1);assert.equal(s.snapshot().story.flags.JIANG_AUTH_GRANTED,undefined);
 assert.ok(s.continueThought());assert.ok(s.placeThought('C06'));assert.equal(s.think(),null);assert.ok(s.placeThought('C07'));assert.equal(s.think(),'R02');
 assert.deepEqual(s.snapshot().thinking.history.at(-1).outputs,[{id:'R02',used:['R01','C06','C07']}]);
 assert.equal(s.snapshot().story.flags.JIANG_AUTH_GRANTED,undefined);assert.ok(s.followPlan());read(s);
 assert.equal(s.snapshot().story.flags.JIANG_AUTH_GRANTED,true);assert.ok(s.collected.includes('C08'));
});

test('the inherited answer stays fixed while the one new premise remains removable',()=>{
 const s=game();toCanvas(s);s.think();s.continueThought();assert.equal(s.removeThought('R01'),false);
 s.placeThought('C06');s.placeThought('C07');s.think();assert.ok(s.reviseThought());assert.ok(s.graph().R01);assert.equal(s.graph().R02,undefined);
 assert.ok(s.removeThought('C06'));assert.equal(s.think(),null);s.placeThought('C06');s.placeThought('C07');assert.equal(s.think(),'R02');
});

test('opening notes before investigation does not suppress acquired comparison clues',()=>{
 const s=game();firstRound(s);s.rewind();read(s);act(s,'ask-guard');s.openNotes();assert.equal(s.think(),null);
 assert.equal(s.placeThought('C06'),false);s.closeNotes();act(s,'ask-relay');act(s,'ask-scout');assert.ok(s.beginThinking());
 assert.deepEqual(s.snapshot().thinking.placed,['C02','C03']);assert.deepEqual(new Set(s.collected),new Set(['C02','C03','C05','C06','C07']));
});

test('neither a single military clue nor the unrelated shouting supplies the comparison',()=>{
 for(const ids of [['C02'],['C03'],['C02','C05'],['C03','C05']]){
  const s=game();toCanvas(s);s.removeThought('C02');s.removeThought('C03');ids.forEach(id=>s.placeThought(id));
  assert.equal(s.think(),null);assert.equal(s.graph().R01,undefined);assert.equal(s.followPlan(),false);
 }
});

test('capacity is two for each question; inherited answers consume no manual slot',()=>{
 const s=game();toCanvas(s);assert.equal(s.placeThought('C05'),false);s.think();s.continueThought();
 assert.ok(s.placeThought('C05'));assert.ok(s.placeThought('C06'));assert.equal(s.placeThought('C07'),false);assert.equal(s.think(),null);
 s.removeThought('C05');s.placeThought('C06');s.placeThought('C07');assert.equal(s.think(),'R02');
});

test('saved over-capacity drafts retain the input but require removing the excess',()=>{
 const s=game();toCanvas(s);const saved=s.snapshot();saved.thinking.placed=['C02','C03','C06'];
 s.restore(JSON.stringify(saved));assert.equal(s.snapshot().thinking.placed.length,3);assert.equal(s.think(),null);
 s.removeThought('C06');assert.equal(s.think(),'R01');
});

test('undo and reload preserve the first answer, unfinished second input and real authorization',()=>{
 const s=game();toCanvas(s);s.think();s.continueThought();s.placeThought('C06');s.placeThought('C07');const restored=game();restored.restore(s.serialize());
 assert.deepEqual(restored.snapshot().thinking,s.snapshot().thinking);restored.think();assert.ok(restored.reviseThought());
 assert.ok(restored.graph().R01);assert.equal(restored.graph().R02,undefined);restored.think();assert.ok(restored.followPlan());read(restored);
 assert.ok(restored.snapshot().story.flags.JIANG_AUTH_GRANTED);restored.restore(restored.serialize());assert.ok(restored.collected.includes('C08'));
});

test('language organization opens only in the real conversation and can revisit reasoning without losing the draft',()=>{
 const session=game();toCanvas(session);assert.equal(session.setThoughtMode('language'),false);assert.equal(session.snapshot().phase,'thoughts');
 const speaking=game();toExpression(speaking);speaking.selectEvidence('R01');speaking.setDraft('禀将军，这是我的措辞。');assert.ok(speaking.setThoughtMode('reasoning'));assert.equal(speaking.snapshot().notesReturn,'expression');assert.ok(speaking.setThoughtMode('language'));assert.equal(speaking.snapshot().phase,'expression');assert.equal(speaking.snapshot().story.draft,'禀将军，这是我的措辞。');assert.deepEqual(speaking.snapshot().story.selected,['R01']);
});



test('phone and 50-yuan allowance unlock only at action speech; retry/load never recharge and a new run clears items', async () => {
 const s=game(); firstExpression(s); assert.equal(s.canPrepareSupplies(),false); assert.equal(balance(s.snapshot().supplies),0);
 toCanvas(s); s.connect('C02','C03');  s.connect('R01','C06');s.connect('C06','C07'); 
 assert.equal(balance(s.snapshot().supplies),0); assert.equal(s.canPrepareSupplies(),false);
 assert.ok(s.followPlan()); read(s); assert.equal(balance(s.snapshot().supplies),0); assert.equal(s.canPrepareSupplies(),false);
 const beforeAction=s.serialize(); s.restore(beforeAction); assert.equal(balance(s.snapshot().supplies),0);
 act(s,'intercept-weiyan'); assert.equal(balance(s.snapshot().supplies),5000); assert.equal(s.canPrepareSupplies(),true);
 assert.ok(s.buyItem('batteries')); assert.equal(balance(s.snapshot().supplies),3610);
 s.setDraft(secondAuthorization); await s.confirmExpression(); s.acknowledgeReply(); assert.ok(s.reviseExpression());
 assert.equal(balance(s.snapshot().supplies),3610); s.restore(s.serialize()); assert.equal(balance(s.snapshot().supplies),3610);
 s.restart(); assert.equal(balance(s.snapshot().supplies),0); assert.deepEqual(s.snapshot().supplies.purchases,[]); assert.equal(s.canPrepareSupplies(),false);
});
