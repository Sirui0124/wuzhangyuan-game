import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { dialogueFixtures } from '../../tools/ai/dialogue-fixtures.mjs';
import { freshReview, commitRow, currentClueSources } from '../web-demo/.build/GameStarter/web-demo/src/thought-canvas-model.js';
import { jiangDutyMigration } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/jiang-duty-migration.js';
import { roleLabelMigration } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/content-version-compatibility.js';
import { chapterOneDecision } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/narrative-decision.js';
import { narrativeChoiceHTML } from '../web-demo/.build/GameStarter/web-demo/src/game/narrative-choice.js';
const f = await dialogueFixtures(resolve('GameStarter/web-demo/.build'));

test('乙的完整职责对白解锁 C07，通传详情按时补充，不能授本人应允', () => {
  const story = freshReview(f.content.version);
  commitRow(story, 'D08'); assert.ok(!story.collected.includes('C07'));
  commitRow(story, 'D09'); assert.deepEqual(story.collected, ['C07']);
  assert.deepEqual(currentClueSources('C07', story.completed), ['D08', 'D09']);
  for (const id of ['D11', 'D12']) commitRow(story, id);
  assert.deepEqual(currentClueSources('C07', story.completed), ['D08', 'D09']);
  commitRow(story, 'D13'); commitRow(story, 'D09');
  assert.equal(currentClueSources('C07', story.completed).length, 5);
  assert.deepEqual(story.collected, ['C07']);
  assert.equal(story.flags.JIANG_AUTH_GRANTED, undefined);
});

test('旧图关系仍校验完整依据，当前展示为剧情选择且不提前授予应允', async () => {
  for (const first of ['C06', 'C07']) {
    const s = await f.thoughts(); s.think(); s.continueThought();
    s.placeThought(first); assert.equal(s.think(), null);
    s.placeThought(first === 'C06' ? 'C07' : 'C06'); assert.equal(s.think(), 'R02');
    assert.equal(s.snapshot().story.flags.JIANG_AUTH_GRANTED, undefined);
    const html = narrativeChoiceHTML(chapterOneDecision(s.snapshot()));
    assert.match(html, /data-narrative-choice="continue-story"/);
    assert.doesNotMatch(html, /data-inventory-item/);
    assert.ok(s.followPlan()); f.read(s); assert.ok(s.collected.includes('C08'));
  }
});

function previousSave(s) {
  const old = s.snapshot(); old.contentVersion = jiangDutyMigration.from;
  old.story.collected = old.story.collected.filter(id => id !== 'C07');
  old.story.edges = old.story.edges.filter(edge => !edge.includes('C07'));
  if (old.thinking) {
    old.thinking.placed = old.thinking.placed.filter(id => id !== 'C07');
    for (const record of old.thinking.history) {
      record.inputs = record.inputs.filter(id => id !== 'C07');
      record.added = record.added.filter(edge => !edge.includes('C07'));
      record.outputs.forEach(output => output.used = output.used.filter(id => id !== 'C07'));
    }
  }
  return old;
}

test('旧存档仅凭已听乙对白补职责：保留已做推理，不替玩家完成未做推理', async () => {
  for (const completed of [false, true]) {
    const s = await f.thoughts(); s.think(); s.continueThought(); s.placeThought('C06');
    if (completed) {s.placeThought('C07'); s.think();}
    const old = previousSave(s), restored = new f.ChapterSession(f.content, f.flow, roleLabelMigration.to);
    restored.restore(JSON.stringify(old));
    assert.ok(restored.collected.includes('C07'));
    assert.equal(!!restored.graph().R02, completed);
    assert.deepEqual(restored.snapshot().story.completed, old.story.completed);
    assert.equal(restored.snapshot().story.flags.JIANG_AUTH_GRANTED, undefined);
    restored.restore(restored.serialize());
    assert.equal(restored.collected.filter(id => id === 'C07').length, 1);
  }
  const early = f.first(), restored = new f.ChapterSession(f.content, f.flow, roleLabelMigration.to);
  restored.restore(JSON.stringify(previousSave(early)));
  assert.ok(!restored.collected.includes('C07'));
});
