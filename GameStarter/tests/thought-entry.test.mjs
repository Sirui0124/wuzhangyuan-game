import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dialogueFixtures } from '../../tools/ai/dialogue-fixtures.mjs';
import { npcTurn } from './npc-fixture.mjs';
import { firstTransfer } from './dialogue-lines.mjs';

// A real completed first round and investigation establish the checkpoint.
// The injected accepted NPC turn is a setup fixture, not a semantic assertion.
const f = await dialogueFixtures(fileURLToPath(new URL('../web-demo/.build/', import.meta.url)));
const judge = async input => npcTurn(input, 'ok');
const seed = f.first(judge);
seed.setDraft(firstTransfer);
assert.ok(await seed.confirmExpression());
assert.ok(seed.acknowledgeReply());
f.read(seed);
for (const id of ['deliver-first', 'stand-watch']) f.act(seed, id);
assert.ok(seed.finishCinematic()); f.read(seed);
assert.ok(seed.rewind()); f.read(seed);
for (const id of ['ask-guard', 'ask-relay']) f.act(seed, id);
assert.ok(seed.move('report_post')); assert.ok(seed.act('ask-scout'));
for (let count = 0; seed.row()?.id !== 'D26' && count < 100; count++) assert.ok(seed.nextLine());
assert.equal(seed.row()?.id, 'D26');
const beforeFinalLine = seed.serialize();
if (process.env.THOUGHT_ENTRY_FIXTURE_OUTPUT) {
  mkdirSync(dirname(process.env.THOUGHT_ENTRY_FIXTURE_OUTPUT), { recursive: true });
  writeFileSync(process.env.THOUGHT_ENTRY_FIXTURE_OUTPUT, beforeFinalLine);
}
const create = () => new f.ChapterSession(f.content, f.flow, f.version, judge);
const prompt = () => {
  const game = create(); game.restore(beforeFinalLine); assert.ok(game.nextLine());
  assert.equal(game.snapshot().phase, 'thought-prompt'); return game;
};
const progress = state => ({
  collected: state.story.collected, completed: state.story.completed, edges: state.story.edges,
  selected: state.story.selected, seen: state.story.seen, history: state.story.history,
  finishedSections: state.finishedSections, scene: state.scene, round: state.round,
});

test('D26 commits its memory once, then waits in the original scene before opening P1', () => {
  const game = create(); game.restore(beforeFinalLine);
  assert.ok(!game.collected.includes('C05'));
  assert.equal(game.beginThinking(), false);
  assert.ok(game.nextLine());
  const state = game.snapshot();
  assert.equal(state.phase, 'thought-prompt'); assert.equal(state.scene, 'report_post');
  assert.ok(state.story.completed.includes('D26')); assert.ok(state.finishedSections.includes('scout-investigation'));
  assert.equal(state.story.collected.filter(id => id === 'C05').length, 1);
  assert.equal(state.story.collected.length, 5);
  assert.ok(!state.panelOpened.includes('P1')); assert.equal(state.story.flags.P1_OPENED, undefined);
  assert.equal(state.thinking, null);
});

test('notes, ordinary advance and movement cannot bypass the explicit thinking choice', () => {
  const game = prompt(), before = game.snapshot();
  assert.equal(game.openNotes(), false); assert.equal(game.nextLine(), false);
  assert.equal(game.move('camp_gate'), false); assert.equal(game.setThoughtMode('reasoning'), false);
  assert.equal(game.think(), null); assert.equal(game.placeThought('C04'), false);
  assert.deepEqual(game.snapshot(), before);
});

test('saving and loading the choice retains its wait and already acquired facts', () => {
  const game = prompt(), before = game.snapshot(), restored = create();
  restored.restore(game.serialize());
  assert.equal(restored.snapshot().phase, 'thought-prompt');
  assert.deepEqual(progress(restored.snapshot()), progress(before));
  assert.deepEqual(restored.snapshot().panelOpened, before.panelOpened);
  assert.equal(restored.snapshot().thinking, null); assert.equal(restored.openNotes(), false);
  assert.ok(restored.beginThinking()); assert.equal(restored.snapshot().phase, 'thoughts');
});

test('beginThinking initializes P1 once without granting any new evidence or conclusion', () => {
  const game = prompt(), before = game.snapshot();
  assert.ok(game.beginThinking()); const opened = game.snapshot();
  assert.equal(opened.phase, 'thoughts'); assert.equal(opened.notesReturn, 'explore');
  assert.equal(opened.notesPurpose, 'P1'); assert.deepEqual(opened.panelOpened, ['P1']);
  assert.equal(opened.story.flags.P1_OPENED, true);
  assert.deepEqual(opened.thinking.placed, ['C02', 'C03']); assert.deepEqual(opened.thinking.history, []);
  assert.deepEqual(progress(opened), progress(before));
  assert.equal(game.graph().R01, undefined); assert.equal(game.graph().R02, undefined);
  assert.equal(game.beginThinking(), false); assert.deepEqual(game.snapshot(), opened);
});

test('an existing thoughts save restores directly with its completed reasoning intact', () => {
  const game = prompt(); assert.ok(game.beginThinking()); 
  assert.equal(game.think(), 'R01'); const before = game.snapshot();
  // This is the pre-prompt save shape: phase thoughts, with no presentation flag.
  const restored = create(); restored.restore(game.serialize());
  assert.equal(restored.snapshot().phase, 'thoughts'); assert.equal(restored.beginThinking(), false);
  assert.deepEqual(progress(restored.snapshot()), progress(before));
  assert.deepEqual(restored.snapshot().thinking, before.thinking);
  assert.equal(restored.snapshot().story.flags.P1_OPENED, true);
});

test('closing and reopening the canvas preserves reasoning and does not repeat the choice', () => {
  const game = prompt(); assert.ok(game.beginThinking()); 
  assert.equal(game.think(), 'R01'); const before = game.snapshot();
  assert.ok(game.closeNotes()); assert.equal(game.snapshot().phase, 'explore');
  assert.equal(game.beginThinking(), false); assert.ok(game.openNotes());
  assert.equal(game.snapshot().phase, 'thoughts');
  assert.deepEqual(progress(game.snapshot()), progress(before));
  assert.deepEqual(game.snapshot().thinking, before.thinking);
  assert.deepEqual(game.snapshot().panelOpened, ['P1']);
});
