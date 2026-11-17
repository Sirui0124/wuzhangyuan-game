import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, restartChapter, finishTutorial, makeAssessmentToken, invalidateAssessments, commitEvent, completeChapter,
  createCheckpoint, restoreCheckpoint, retryFromDecision, archiveDeath, makeResultToken, setLatestResult } from './latest-store.mjs';

const AT = '2026-10-26T12:00:00+08:00';
const start = (store = createStore(), chapterId = 'grain', runId = 'run-1', tutorial = false) =>
  restartChapter(store, { chapterId, runId, tutorial, at: AT });
const event = (decisionId, vector = [1, null, null, null], extra = {}) =>
  ({ decisionId, optionId: `${decisionId}-A`, vector, weight: 1, at: AT, ...extra });
const commit = (store, decisionId, chapterId = 'grain', extra = {}) => {
  const result = commitEvent(store, { chapterId, event: event(decisionId, undefined, extra) });
  assert.equal(result.accepted, true, result.reason); return result.store;
};
const death = (store, endingId = 'era-arrest', chapterId = 'grain') => archiveDeath(store,
  { chapterId, endingId, storySnapshot: { nodeId: 'failure', phase: 'death', visited: ['opening'], chosen: ['decision-A'] }, at: AT });
const result = (store, characterId = 'lusu') => setLatestResult(store,
  { characterId, coordinates: [45, 70, 60, 45], evidence: [], computedAt: AT }, makeResultToken(store)).store;

test('replaying one chapter replaces only its current ledger and cached result; history and other chapters survive', () => {
  let store = commit(start(), 'D1');
  store = commit(start(store, 'wuzhang', 'ch1-run'), 'W1', 'wuzhang');
  store = result(death(store).store);
  const old = store, otherChapter = copy(store.chapters.wuzhang), deathSnapshot = copy(store.deaths);
  store = restartChapter(store, { chapterId: 'grain', runId: 'run-2', at: AT });
  assert.equal(store.chapters.grain.epoch, 2);
  assert.deepEqual(store.chapters.grain.events, []);
  assert.deepEqual(store.chapters.wuzhang, otherChapter);
  assert.deepEqual(store.deaths, deathSnapshot);
  assert.equal(store.latestResult, null);
  assert.equal(old.chapters.grain.events.length, 1);
});

test('forced tutorial death is archived but neither tutorial answers nor the death affect personality', () => {
  let store = start(createStore(), 'wuzhang', 'tutorial-run', true);
  const initial = store;
  const ignored = commitEvent(store, { chapterId: 'wuzhang', event: event('FIRST-WEIYAN', [1, 1, 1, 1]) });
  assert.equal(ignored.reason, 'tutorial-excluded'); assert.equal(ignored.store, initial);
  store = death(store, 'tutorial-sacrifice', 'wuzhang').store;
  assert.equal(store.deaths[0].forced, true);
  assert.deepEqual(store.deaths[0].personalitySnapshot.events, []);
  store = finishTutorial(store, 'wuzhang', AT);
  assert.equal(store.chapters.wuzhang.attempt, 2);
  store = commit(store, 'AUTHORIZED-WEIYAN', 'wuzhang');
  assert.equal(store.chapters.wuzhang.events.length, 1);
  assert.equal(store.deaths.length, 1);
  assert.deepEqual(store.deaths[0].personalitySnapshot.events, []);
});

test('authored tutorial exclusions still apply outside the active tutorial phase', () => {
  const store = start();
  const ignored = commitEvent(store, { chapterId: 'grain', event: event('D1', [1, 1, 1, 1], { tutorial: true }) });
  assert.equal(ignored.accepted, false); assert.equal(ignored.store, store);
});

test('tutorial checkpoints and delayed assessments cannot re-enter the scored phase', () => {
  let store = start(createStore(), 'wuzhang', 'tutorial-run', true);
  const checkpoint = createCheckpoint(store, 'wuzhang');
  const token = makeAssessmentToken(store, 'wuzhang', { decisionId: 'OPEN-1', input: '教学对白。' });
  store = finishTutorial(store, 'wuzhang', AT);
  assert.equal(restoreCheckpoint(store, checkpoint).reason, 'phase-mismatch');
  assert.equal(commitEvent(store, { chapterId: 'wuzhang', token,
    event: event('OPEN-1', undefined, { input: '教学对白。' }) }).reason, 'stale-assessment');
  assert.deepEqual(store.chapters.wuzhang.events, []);
});

test('same-run manual load restores a true prefix and removes every later personality event', () => {
  let store = commit(start(), 'D1');
  const checkpoint = createCheckpoint(store, 'grain');
  store = commit(commit(store, 'D2'), 'D3');
  store = result(store);
  const restored = restoreCheckpoint(store, checkpoint, AT);
  assert.equal(restored.accepted, true);
  assert.deepEqual(restored.store.chapters.grain.events.map(e => e.decisionId), ['D1']);
  assert.ok(restored.store.chapters.grain.revision > store.chapters.grain.revision);
  assert.equal(restored.store.latestResult, null);
});

test('old-epoch or legacy saves never revive scores cleared by replay', () => {
  let store = commit(start(), 'D1');
  const oldCheckpoint = createCheckpoint(store, 'grain');
  store = start(store, 'grain', 'run-2');
  const restored = restoreCheckpoint(store, oldCheckpoint, AT);
  assert.equal(restored.reason, 'old-epoch'); assert.equal(restored.store, store);
  assert.deepEqual(store.chapters.grain.events, []);
  assert.equal(restoreCheckpoint(store, { node: 'old-story-node' }).reason, 'legacy-without-personality');
});

test('a discarded alternate branch and altered checkpoint cannot be smuggled back as a current prefix', () => {
  let store = commit(commit(start(), 'D1'), 'D2');
  const checkpoint = createCheckpoint(store, 'grain');
  store = retryFromDecision(store, 'grain', 'D2', AT).store;
  store = commit(store, 'D2', 'grain', { optionId: 'D2-B', vector: [-1, null, null, null] });
  assert.equal(restoreCheckpoint(store, checkpoint).reason, 'not-current-prefix');
  const tampered = copy(createCheckpoint(store, 'grain')); tampered.events[0].vector[0] = -1;
  assert.equal(restoreCheckpoint(store, tampered).reason, 'not-current-prefix');
});

test('local retry removes the chosen decision and subsequent events; the replacement counts once', () => {
  let store = commit(commit(commit(start(), 'D1'), 'D2'), 'D3');
  store = death(store).store;
  const archive = copy(store.deaths);
  store = retryFromDecision(store, 'grain', 'D2', AT).store;
  assert.deepEqual(store.chapters.grain.events.map(e => e.decisionId), ['D1']);
  assert.deepEqual(store.deaths, archive);
  store = commit(store, 'D2', 'grain', { optionId: 'D2-B', vector: [-1, null, null, null] });
  const duplicate = commitEvent(store, { chapterId: 'grain', event: event('D2') });
  assert.equal(duplicate.reason, 'decision-already-committed'); assert.equal(duplicate.store, store);
  assert.equal(store.chapters.grain.events.length, 2);
});

test('death-page refresh is idempotent, while a new retry attempt can leave another historical death', () => {
  let store = result(commit(start(), 'D1'));
  const priorResult = copy(store.latestResult);
  store = death(store).store;
  assert.deepEqual(store.latestResult, priorResult);
  assert.equal(death(store).reason, 'already-archived');
  store = retryFromDecision(store, 'grain', 'D1', AT).store;
  store = commit(store, 'D1');
  store = death(store).store;
  assert.equal(store.deaths.length, 2);
  assert.notEqual(store.deaths[0].deathId, store.deaths[1].deathId);
  assert.equal(store.chapters.grain.events.length, 1);
});

test('a death personality snapshot cannot be loaded as a playable checkpoint even in the same run', () => {
  const store = death(commit(start(), 'D1')).store;
  const restored = restoreCheckpoint(store, store.deaths[0].personalitySnapshot, AT);
  assert.equal(restored.reason, 'history-read-only');
  assert.equal(restored.store, store);
  assert.equal(store.chapters.grain.attempt, 1);
});

test('death identity remains distinct when caller IDs contain the allowed separator character', () => {
  let store = start(createStore(), 'x:1', 'r');
  store = death(store, 'end', 'x:1').store;
  store = start(store, 'x', '1:r');
  store = death(store, 'end', 'x').store;
  assert.equal(store.deaths.length, 2);
  assert.notEqual(store.deaths[0].deathId, store.deaths[1].deathId);
});

test('open-answer receipts are rejected after replay even if the new run reaches the same decision', () => {
  let store = start();
  const token = makeAssessmentToken(store, 'grain', { decisionId: 'OPEN-1', input: '我会先去核查。' });
  store = start(store, 'grain', 'run-2');
  const receipt = commitEvent(store, { chapterId: 'grain', token, event: event('OPEN-1', [null, -1, null, null], { input: '我会先去核查。' }) });
  assert.equal(receipt.reason, 'stale-assessment'); assert.equal(receipt.store, store);
});

test('a response assessed under an older scoring rule version cannot enter the current ledger', () => {
  let store = start();
  const token = makeAssessmentToken(store, 'grain', { decisionId: 'OPEN-1', input: '先核实。' });
  store = { ...copy(store), ruleVersion: 'personality-design-v2' };
  const receipt = commitEvent(store, { chapterId: 'grain', token,
    event: event('OPEN-1', undefined, { input: '先核实。' }) });
  assert.equal(receipt.reason, 'stale-assessment');
  assert.equal(receipt.store, store);
});

test('open-answer receipts are bound to exact confirmed words and revision, not just node identity', () => {
  let store = start();
  const token = makeAssessmentToken(store, 'grain', { decisionId: 'OPEN-1', input: '我愿意一起补报。' });
  assert.equal(commitEvent(store, { chapterId: 'grain', token, event: event('OPEN-1', undefined, { input: '我不会帮你。' }) }).reason, 'stale-assessment');
  const checkpoint = createCheckpoint(store, 'grain');
  store = commit(store, 'D1');
  store = restoreCheckpoint(store, checkpoint, AT).store;
  assert.equal(commitEvent(store, { chapterId: 'grain', token, event: event('OPEN-1', undefined, { input: '我愿意一起补报。' }) }).reason, 'stale-assessment');
  const fresh = makeAssessmentToken(store, 'grain', { decisionId: 'OPEN-1', input: '我愿意一起补报。' });
  assert.equal(commitEvent(store, { chapterId: 'grain', token: fresh, event: event('OPEN-1', undefined, { input: '我愿意一起补报。' }) }).accepted, true);
});

test('open answers cannot bypass stale-response protection by omitting their assessment token', () => {
  const store = start();
  const receipt = commitEvent(store, { chapterId: 'grain', event: event('OPEN-1', undefined, { input: '先核实。' }) });
  assert.equal(receipt.reason, 'assessment-token-required');
  assert.equal(receipt.store, store);
});

test('editing or cancelling a pending answer retires its receipt without deleting prior decisions', () => {
  let store = commit(start(), 'D1');
  const token = makeAssessmentToken(store, 'grain', { decisionId: 'OPEN-1', input: '原来准备说的话。' });
  store = invalidateAssessments(store, 'grain');
  const receipt = commitEvent(store, { chapterId: 'grain', token,
    event: event('OPEN-1', undefined, { input: '原来准备说的话。' }) });
  assert.equal(receipt.reason, 'stale-assessment');
  assert.deepEqual(store.chapters.grain.events.map(e => e.decisionId), ['D1']);
});

test('malformed checkpoint status is rejected instead of creating a non-serializable ledger', () => {
  const store = commit(start(), 'D1');
  const checkpoint = copy(createCheckpoint(store, 'grain'));
  delete checkpoint.status;
  const restored = restoreCheckpoint(store, checkpoint);
  assert.equal(restored.reason, 'invalid-checkpoint');
  assert.equal(restored.store, store);
});

test('there is only one latest result, and stale result calculations cannot overwrite newer runs', () => {
  let store = result(commit(start(), 'D1'), 'lusu');
  const token = makeResultToken(store);
  store = result(store, 'zhugeliang');
  assert.equal(store.latestResult.characterId, 'zhugeliang');
  assert.equal(Object.hasOwn(store, 'results'), false);
  store = start(store, 'grain', 'run-2');
  const stale = setLatestResult(store, { characterId: 'lusu', coordinates: [50, 50, 50, 50] }, token);
  assert.equal(stale.reason, 'stale-result'); assert.equal(store.latestResult, null);
});

test('result explanations cannot cite a decision that exists only in death history', () => {
  let store = death(commit(start(), 'D1')).store;
  store = start(store, 'grain', 'run-2');
  assert.throws(() => setLatestResult(store, { characterId: 'lusu', coordinates: [50, 50, 50, 50],
    evidence: [{ chapterId: 'grain', decisionId: 'D1' }] }, makeResultToken(store)), /not current/);
});

test('zero is an observed balanced choice; null-only events do not become personality evidence', () => {
  let store = start();
  assert.equal(commitEvent(store, { chapterId: 'grain', event: event('D0', [null, null, null, null]) }).reason, 'unobserved');
  store = commitEvent(store, { chapterId: 'grain', event: event('D0', [0, null, null, null]) }).store;
  assert.equal(store.chapters.grain.events[0].vector[0], 0);
});

test('event scores accept only four -2..2 integers or null, with evidence weight 1 or 2', () => {
  const store = start();
  for (const invalid of [-100, -3, -1.5, 0.5, 3, 100, NaN, Infinity, undefined, '1', true]) {
    assert.throws(() => commitEvent(store, { chapterId: 'grain', event: event('D1', [invalid, null, null, null]) }), /vector/);
  }
  assert.throws(() => commitEvent(store, { chapterId: 'grain', event: event('D1', Array(4)) }), /vector/);
  for (const invalid of [0, -1, 1.5, 3, 100, NaN, Infinity, null, '1', true]) {
    assert.throws(() => commitEvent(store, { chapterId: 'grain', event: event('D1', undefined, { weight: invalid }) }), /weight/);
  }
  const scored = commitEvent(store, { chapterId: 'grain', event: event('D1', [-2, -1, 0, 2], { weight: 2 }) });
  assert.equal(scored.accepted, true);
  assert.deepEqual(scored.store.chapters.grain.events[0].vector, [-2, -1, 0, 2]);
  assert.equal(scored.store.chapters.grain.events[0].weight, 2);
  const withResult = setLatestResult(scored.store,
    { characterId: 'lusu', coordinates: [0, 45.5, 70, 100], evidence: [] }, makeResultToken(scored.store));
  assert.equal(withResult.accepted, true);
});

test('closed chapters reject accidental further choices until an explicit retry or restart', () => {
  let store = completeChapter(commit(start(), 'D1'), 'grain', 'E1', AT);
  assert.equal(commitEvent(store, { chapterId: 'grain', event: event('D2') }).reason, 'chapter-finished');
  store = retryFromDecision(store, 'grain', 'D1', AT).store;
  assert.equal(store.chapters.grain.status, 'playing');
  assert.equal(store.chapters.grain.endingId, null);
});

test('event and history APIs accept only narrative fields, never credentials or request objects', () => {
  const store = start();
  assert.throws(() => commitEvent(store, { chapterId: 'grain', event: { ...event('D1'), apiKey: 'private' } }), /Unsupported/);
  assert.throws(() => commitEvent(store, { chapterId: 'grain', event: event('D1', undefined, { input: 'Bearer abcdefghijklmnop' }) }), /credential/);
  assert.throws(() => commitEvent(store, { chapterId: 'grain', event: event('D1', undefined, { references: [{ sourceId: 'A1', quote: '军令', authorization: 'private' }] }) }), /Unsupported/);
  assert.throws(() => archiveDeath(store, { chapterId: 'grain', endingId: 'era-arrest', storySnapshot: { nodeId: 'end', settings: { apiKey: 'private' } } }), /Unsupported/);
});

test('snapshots are copied, frozen, and JSON round-trippable without losing score or archive separation', () => {
  const input = event('D1', [1, null, -1, 0], { input: '我会照实说清。', references: [{ sourceId: 'A1', quote: '军令已下。' }] });
  let store = start();
  const token = makeAssessmentToken(store, 'grain', { decisionId: 'D1', input: input.input });
  store = commitEvent(store, { chapterId: 'grain', event: input, token }).store;
  input.vector[0] = -1; input.references[0].quote = 'changed';
  assert.equal(store.chapters.grain.events[0].vector[0], 1);
  store = death(store).store;
  assert.throws(() => { store.deaths[0].personalitySnapshot.events[0].vector[0] = -1; }, TypeError);
  assert.deepEqual(JSON.parse(JSON.stringify(store)), store);
  const deserialized = JSON.parse(JSON.stringify(store));
  const restarted = start(deserialized, 'grain', 'run-2');
  assert.equal(restarted.chapters.grain.events.length, 0);
  assert.equal(restarted.deaths[0].personalitySnapshot.events.length, 1);
});

function copy(value) { return structuredClone(value); }
