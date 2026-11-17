import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChapterSession } from '../web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
import { chapterOneDecision } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/narrative-decision.js';
import { availableChoice } from '../web-demo/.build/GameStarter/web-demo/src/narrative/presentation.js';
import { narrativeChoiceHTML } from '../web-demo/.build/GameStarter/web-demo/src/game/narrative-choice.js';
import { createCompositionGuard } from '../web-demo/.build/GameStarter/web-demo/src/game/composition-guard.js';
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const content = json('../../content/chapters/wuzhang/chapter-one.script.json');
const flow = json('../../content/chapters/wuzhang/chapter-one.flow.json');
const checkpoint = () => json('../web-demo/.build/art-review/thought-playtest.json');
const create = () => { const value = checkpoint(); const game = new ChapterSession(content, flow, value.contentVersion, undefined, undefined, 'offline'); game.restore(JSON.stringify(value)); return game; };

test('old canvas saves continue by a factual story choice without granting Jiang authorization', () => {
    const game = create();
    assert.ok(availableChoice(chapterOneDecision(game.snapshot()), 'continue-story'));
    assert.ok(game.continueStory());
    assert.equal(game.snapshot().section, 'jiang-commitment');
    assert.equal(game.snapshot().phase, 'dialogue');
    assert.ok(!game.snapshot().story.collected.includes('C08'));
    assert.equal(game.continueStory(), false, 'a stale choice must not execute twice');
    const restored = create(); restored.restore(game.serialize());
    assert.equal(restored.snapshot().section, 'jiang-commitment');
});

test('missing factual conditions cannot expose the request choice or invent authorization', () => {
    const state = checkpoint(); state.story.collected = state.story.collected.filter(id => id !== 'C07');
    assert.equal(availableChoice(chapterOneDecision(state), 'continue-story'), undefined);
    state.story.collected.push('C07'); state.story.completed = state.story.completed.filter(id => id !== 'D13');
    assert.equal(availableChoice(chapterOneDecision(state), 'continue-story'), undefined);
});

test('returning to the scene keeps the next real action reachable', () => {
    const game = create(); assert.ok(game.returnToStory());
    assert.equal(game.snapshot().phase, 'explore');
    assert.ok(game.move('camp_gate')); assert.ok(game.actionState('meet-jiang').enabled);
    assert.ok(game.act('meet-jiang'));
});

test('choice projection is read-only, escapes text and rejects disabled or unknown actions', () => {
    const decision = { id: 'test', text: '<question>', choices: [{ id: 'safe', text: '<safe>' }, { id: 'locked', text: 'Locked', enabled: false }] };
    const before = JSON.stringify(decision), html = narrativeChoiceHTML(decision);
    assert.match(html, /&lt;question&gt;/); assert.match(html, /disabled/);
    assert.equal(JSON.stringify(decision), before);
    assert.equal(availableChoice(decision, 'locked'), undefined);
    assert.equal(availableChoice(decision, 'invented'), undefined);
});

test('asynchronous rendering waits for Chinese composition and coalesces pending updates', async () => {
    class Editor extends EventTarget { matches(selector) { return selector === 'input,textarea'; } }
    const root = new Editor(); let renders = 0;
    const guard = createCompositionGuard(root, () => { renders++; });
    root.dispatchEvent(new Event('compositionstart'));
    assert.equal(guard.defer(), true); assert.equal(guard.defer(), true); assert.equal(renders, 0);
    root.dispatchEvent(new Event('compositionend'));
    assert.equal(renders, 0, 'the final input event gets the rest of the task');
    await Promise.resolve(); assert.equal(renders, 1); assert.equal(guard.defer(), false);
});
