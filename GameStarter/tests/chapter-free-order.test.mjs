import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChapterSession } from '../web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
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

test('甲乙可任选先后，必须两段完成；单人进度读档后保留且不提前取得另一人的线索',()=>{
 for(const order of [['ask-guard','ask-relay'],['ask-relay','ask-guard']]){
  const session=game();firstRound(session);session.rewind();read(session);
  for(const id of order){session.move(flow.actions.find(a=>a.id===id).scene);assert.equal(session.actionState(id).enabled,true);}
  session.move('report_post');assert.equal(session.act('ask-scout'),false);
  act(session,order[0]);assert.equal(session.snapshot().phase,'explore');
  const guardFirst=order[0]==='ask-guard';
  for(const clue of guardFirst?['C06']:['C02','C07'])assert.ok(session.collected.includes(clue));
  for(const clue of guardFirst?['C02','C07']:['C06'])assert.ok(!session.collected.includes(clue));
  const saved=game();saved.restore(session.serialize());assert.deepEqual(saved.collected,session.collected);
  saved.move('report_post');assert.equal(saved.act('ask-scout'),false);assert.ok(!saved.actions().some(a=>a.id==='ask-scout'));
  const first=flow.actions.find(a=>a.id===order[0]);saved.move(first.scene);assert.equal(saved.act(first.id),false);
  const second=flow.actions.find(a=>a.id===order[1]);saved.move(second.scene);assert.equal(saved.act(second.id),true);
  saved.nextLine();assert.ok(!saved.snapshot().finishedSections.includes(second.section));
  assert.equal(saved.act('ask-scout'),false);read(saved);
  assert.deepEqual(new Set(saved.collected),new Set(['C06','C02','C07']));
  saved.move('report_post');assert.equal(saved.actionState('ask-scout').enabled,true);act(saved,'ask-scout');
  assert.equal(saved.snapshot().phase,'thought-prompt');assert.equal(saved.collected.length,5);assert.ok(saved.beginThinking());assert.equal(saved.snapshot().phase,'thoughts');
 }
});

test('精简版不播放停用句，完整接报与回令仍分别在实际完成后生效',async()=>{
 const removed=['A-15','A-18','A-31','A-32','A-41','A-58','J01','J07','E04A','E04B','E06','E07'];
 assert.ok(flow.sections.every(section=>section.rows.every(id=>!removed.includes(id))));
 assert.ok(!content.rows.some(row=>row.id==='A-58'));
 const session=game();toExpression(session);session.setDraft(secondComplete);await session.confirmExpression();session.acknowledgeReply();
 while(session.row()?.id!=='E04C'){assert.equal(session.snapshot().phase,'dialogue');session.nextLine();}
 assert.equal(session.snapshot().story.flags.FORMAL_REPORT_RECEIVED,undefined);session.nextLine();
 assert.equal(session.snapshot().story.flags.FORMAL_REPORT_RECEIVED,true);assert.equal(session.snapshot().story.flags.REPORT_CLOSED,undefined);
 assert.match(session.row().text,/严守营门.*再探敌情.*不得追击.*立即报我/);
 while(session.row()?.id!=='E10'){assert.equal(session.snapshot().phase,'dialogue');session.nextLine();}
 assert.equal(session.snapshot().story.flags.REPORT_CLOSED,undefined);session.nextLine();
 assert.equal(session.snapshot().story.flags.REPORT_CLOSED,true);
 const restored=game();restored.restore(session.serialize());assert.equal(restored.snapshot().story.flags.REPORT_CLOSED,true);
});

