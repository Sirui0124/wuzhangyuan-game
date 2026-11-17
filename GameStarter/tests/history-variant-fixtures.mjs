import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dialogueFixtures } from '../../tools/ai/dialogue-fixtures.mjs';
import { npcTurn } from './npc-fixture.mjs';
import { firstTransfer } from './dialogue-lines.mjs';

export async function runHistoryVariantCases(build, output) {
if (output) mkdirSync(output,{recursive:true});
const f=await dialogueFixtures(build);
const {createGameModals}=await import(pathToFileURL(resolve(build,'GameStarter/web-demo/src/game/modals.js')));
const media=JSON.parse(readFileSync(resolve(build,'media/manifest.json'),'utf8'));
const judge=async input=>npcTurn(input,'ok','即刻把急报转呈，莫误军情。');
const results=[];
for(const branch of ['a','b']) {
  const game=f.first(judge,undefined,branch);
  game.setDraft(firstTransfer); assert.ok(await game.confirmExpression()); assert.ok(game.acknowledgeReply());
  f.read(game);
  const handoff=f.flow.actions.find(action=>action.id==='deliver-first');
  if(game.snapshot().scene!==handoff.scene) assert.ok(game.move(handoff.scene));
  assert.ok(game.act('deliver-first'));
  const displayed=[];
  while(game.snapshot().phase==='dialogue') { const row=game.row(); displayed.push({id:row.id,text:row.text}); assert.ok(game.nextLine()); }
  const a42=displayed.find(row=>row.id==='A-42'); assert.ok(a42);
  assert.equal(a42.text.includes('营门未破。'),branch==='a');
  assert.equal(game.recordedRow('A-42').text,a42.text);
  assert.equal(game.snapshot().displayedRows['A-42'],a42.text);
  assert.equal(game.recordedRow('D09'),undefined,'Unread row cannot be recalled');
  const modal=()=>createGameModals(game,f.flow,media,{overlay:'records'},()=>null,()=>'',()=>'', 'isolated').modalHTML(game.snapshot());
  assert.ok(modal().includes(a42.text));
  if(branch==='b') assert.ok(!modal().includes('营门未破。'));
  const original=game.serialize(), restored=new f.ChapterSession(f.content,f.flow,f.version,judge);
  restored.restore(original); assert.equal(restored.recordedRow('A-42').text,a42.text);
  // Pre-snapshot saves retain only completed-row order. Current clues are not used.
  const old=JSON.parse(original); delete old.displayedRows;
  const legacy=new f.ChapterSession(f.content,f.flow,f.version,judge); legacy.restore(JSON.stringify(old));
  assert.equal(legacy.recordedRow('A-42').text,a42.text);
  f.act(game,'stand-watch');
  assert.ok(game.finishCinematic()); f.read(game); assert.ok(game.rewind()); f.read(game);
  assert.equal(game.snapshot().story.collected.includes('T02'),false);
  assert.equal(game.recordedRow('A-42').text,a42.text,'Rewind must not change the past wording');
  restored.restore(game.serialize()); assert.equal(restored.recordedRow('A-42').text,a42.text);
  const oldRewind=JSON.parse(game.serialize()); delete oldRewind.displayedRows;
  legacy.restore(JSON.stringify(oldRewind)); assert.equal(legacy.recordedRow('A-42').text,a42.text);
  const before=restored.snapshot(); const bad=JSON.parse(game.serialize()); bad.displayedRows.D09='unread';
  assert.throws(()=>restored.restore(JSON.stringify(bad)),/已读对白记录不完整/);
  assert.deepEqual(restored.snapshot(),before,'Invalid snapshot must not replace current state');
  if (output) writeFileSync(resolve(output,`branch-${branch}-save.json`),game.serialize());
  results.push({branch,observedA42:a42.text,sourceA42:game.sourceRow('A-42').text,hasT02AtReading:branch==='a',newSave:true,legacySave:true,rewind:true,readOnlyHistory:true,invalidSnapshotRejected:true});
}
const report={passed:true,scope:'local synthetic state and rendered history, not audio approval or live model quality',cases:results}; if (output) writeFileSync(resolve(output,'results.json'),JSON.stringify(report,null,2));
return report;
}
