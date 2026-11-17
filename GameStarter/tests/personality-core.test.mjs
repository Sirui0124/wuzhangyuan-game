import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPersonalityStore } from '../web-demo/.build/GameStarter/web-demo/src/personality/store.js';
import { normalizePersonalityConfig, personalityNamespace, linkPersonalitySources } from '../web-demo/.build/GameStarter/web-demo/src/personality/config.js';
import { personalityHTML, personalityShareText } from '../web-demo/.build/GameStarter/web-demo/src/personality/view.js';
import { coordinates } from '../web-demo/.build/GameStarter/web-demo/src/personality/model.js';
const read = name => JSON.parse(readFileSync(new URL(`../../docs/design/personality/${name}.json`, import.meta.url)));
const config = normalizePersonalityConfig(read('characters-and-model'), read('chapter-one-two-scoring'), read('chapter-three-scoring'));
const at = '2026-10-27T00:00:00.000Z';
const memory = () => { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
function fixture(storage = memory(), namespace = 'test') {
  let id = 0; const store = createPersonalityStore({ storage, namespace, now: () => at, newRunId: () => `run-${++id}` });
  store.configure(config); store.startChapter('grain'); return { store, storage };
}
const choose = (store, optionId = 'N1-A', chapterId = 'grain', extra = {}) => store.recordChoice({ chapterId, optionId, ...extra });
const open = (store, input = '我先核实，再如实报告。', nodeId = 'CH2-LY03-018') => {
  const token = store.makeOpenToken({ chapterId: 'grain', nodeId, input }); assert.ok(token); return token;
};
const assess = (store, token, vector = [-1, null, -1, null]) => store.recordOpen({ token, vector,
  quotes: vector.map(v => v === null ? null : token.input) });

test('authored configuration loads 36 characters and choice slots without guessing from endings', () => {
  assert.equal(config.characters.length, 36);
  assert.equal(config.choices.find(c => c.optionId === 'UI-CASE-confirm').decisionId, 'CH2.final-action');
  assert.equal(config.openQuestions.find(c => c.nodeId === 'P2-01').decisionId, 'CH1.open.authorized');
  assert.equal(config.choices.some(c => c.optionId === 'E1'), false);
});

test('evidence source IDs and prompts resolve to actual playable chapter questions and options', () => {
  const sources = JSON.parse(readFileSync(new URL('../web-demo/.build/story/personality/evidence-sources.json', import.meta.url)));
  const linked = linkPersonalitySources(structuredClone(config), sources);
  for (const chapterId of ['grain', 'jieting']) {
    const file = chapterId === 'grain' ? 'grain/chapter-two.films.json' : 'jieting/chapter-three.story.json';
    const story = JSON.parse(readFileSync(new URL(`../../content/chapters/${file}`, import.meta.url)));
    for (const node of story.nodes) for (const option of node.options ?? []) {
      const definition = linked.choices.find(c => c.chapterId === chapterId && c.nodeId === node.id && c.optionId === option.id);
      assert.ok(definition, option.id); assert.equal(definition.text, option.text);
      assert.equal(definition.prompt, node.text ?? '');
    }
  }
});

test('new source options remain unscored and current wording replaces duplicate display copy', () => {
  const original = structuredClone(config), authored = original.choices.find(c => c.chapterId === 'jieting');
  const vector = [...authored.vector], weight = authored.weight;
  const sources = [{chapterId: authored.chapterId, nodeId: authored.nodeId, prompt: '现行问题', path: 'story.json',
    options: [{id: authored.optionId, text: '现行台词'}, {id:'new-option',text:'未经评分的新台词'}]}];
  const linked = linkPersonalitySources(original, sources);
  assert.equal(authored.text, '现行台词'); assert.deepEqual(authored.vector, vector); assert.equal(authored.weight, weight);
  const added = linked.choices.find(c => c.optionId === 'new-option');
  assert.equal(added.weight, 0); assert.deepEqual(added.vector, [null,null,null,null]);
  const count = linked.choices.length; linkPersonalitySources(linked, sources); assert.equal(linked.choices.length, count);
});

test('confirmation evidence shows the confirmed decision and expands the exact original option without changing scores', () => {
  const { store } = fixture(); choose(store, 'UI-CASE-confirm'); store.completeChapter('grain', 'E4-late');
  const before = store.getState(), view = store.getView(), evidence = view.evidence[0];
  assert.equal(evidence.source.nodeId, 'UI-CASE'); assert.equal(evidence.source.optionId, 'UI-CASE-confirm');
  assert.equal(evidence.source.text, '确认');
  assert.match(evidence.source.prompt, /全部真实材料一并交案/);
  const html = personalityHTML(view);
  assert.match(html, /典型依据/); assert.match(html, /确认：全部真实材料一并交案/);
  assert.match(html, /所选原文/); assert.match(html, /data-evidence-option="UI-CASE-confirm"/);
  assert.doesNotMatch(html, /示例中的选择|你曾这样选择/);
  assert.deepEqual(store.getState(), before);
  // Share text uses the same context instead of exporting a meaningless stand-alone confirmation.
  const ready = { ...view, status: 'ready', ready: true, character: config.characters[0] };
  assert.match(personalityShareText(ready), /确认：全部真实材料一并交案/);
});

test('open evidence preserves the complete confirmed words alongside the assessed excerpt', () => {
  const { store } = fixture();
  const input = '我先核清交接记录。即使他怨我，也要照实报告。';
  const token = open(store, input); store.recordOpen({ token, vector: [null, null, -2, -2],
    quotes: [null, null, '即使他怨我，也要照实报告。', '即使他怨我，也要照实报告。'] });
  const evidence = store.getView().evidence[0];
  assert.equal(evidence.source.kind, 'open'); assert.equal(evidence.source.text, input);
  assert.equal(evidence.quote, '即使他怨我，也要照实报告。');
  assert.match(personalityHTML(store.getView()), /你的原话/);
  assert.ok(personalityHTML(store.getView()).includes(input));
});

test('any second-chapter ending unlocks the menu permanently, including an evidence-free early ending', () => {
  const { store, storage } = fixture();
  assert.equal(store.getView().status, 'locked');
  store.completeChapter('grain', 'E4-early');
  assert.equal(store.getView().status, 'insufficient');
  store.restartChapter('grain');
  const reloaded = fixture(storage).store;
  assert.equal(reloaded.getView().unlocked, true);
  assert.equal(reloaded.getView().status, 'insufficient');
  assert.equal(reloaded.getView().completedChapters, 0);
});

test('a chapter replay clears its score and pending text but preserves other latest chapters and read-only deaths', () => {
  const { store } = fixture(); choose(store); open(store);
  store.startChapter('jieting'); choose(store, 'JT-O016', 'jieting');
  store.archiveDeath({ chapterId: 'grain', endingId: 'era-arrest', title: '言语失察' });
  const before = store.getState(); store.restartChapter('grain'); const after = store.getState();
  assert.deepEqual(after.chapters.grain.events, []);
  assert.equal(store.getPendingOpen().length, 0);
  assert.deepEqual(after.chapters.jieting, before.chapters.jieting);
  assert.deepEqual(after.deaths, before.deaths);
  assert.equal(after.chapters.grain.epoch, before.chapters.grain.epoch + 1);
});

test('round-one choices and mandatory Wei Yan death contribute nothing, then the same story run can leave tutorial mode', () => {
  const { store } = fixture(); store.startChapter('wuzhang', { round: 1, runId: 'same-story' });
  assert.equal(choose(store, 'tent:side:continue', 'wuzhang', { round: 1 }).reason, 'tutorial-excluded');
  assert.equal(store.makeOpenToken({ chapterId: 'wuzhang', nodeId: 'R1-LANG', input: '我要拦住你。', round: 1 }), null);
  store.archiveDeath({ chapterId: 'wuzhang', endingId: 'tutorial-sacrifice' });
  store.completeChapter('wuzhang', 'tutorial-sacrifice');
  const runId = store.getState().chapters.wuzhang.runId;
  store.finishTutorial('wuzhang');
  assert.equal(store.getState().chapters.wuzhang.runId, runId);
  assert.equal(store.getState().deaths[0].forced, true);
  assert.deepEqual(store.getState().deaths[0].snapshot.events, []);
  assert.equal(choose(store, 'tent:side:continue', 'wuzhang', { round: 2 }).accepted, true);
});

test('pending assessment survives subsequent choices and a terminal ending', () => {
  const { store } = fixture(); const token = open(store);
  choose(store, 'N4-C'); choose(store, 'N1-A'); store.completeChapter('grain', 'E4-early');
  assert.equal(assess(store, token).accepted, true);
  assert.equal(store.getView().status, 'ready');
  assert.equal(store.getView().pendingCount, 0);
  assert.equal(store.getState().chapters.grain.events.length, 3);
});

test('one or two observed axes reveal only those directions, not a complete character result', () => {
  const { store, storage } = fixture(); choose(store);
  const token = open(store); assess(store, token, [-1, null, null, null]);
  store.completeChapter('grain', 'E4-early');
  const view = store.getView();
  assert.equal(view.observedAxes, 2); assert.equal(view.status, 'insufficient');
  assert.equal(view.character, undefined); assert.equal(store.getState().latestResult, null);
  assert.equal(view.axes[2].value, null); assert.ok(view.evidence.length > 0);
  assert.equal(fixture(storage).store.getView().status, 'insufficient');
});

test('a third observed axis reveals a character, and replay can return to insufficient without relocking the page', () => {
  const { store } = fixture(); choose(store); const token = open(store); assess(store, token);
  store.completeChapter('grain', 'E1');
  assert.equal(store.getView().observedAxes, 3); assert.equal(store.getView().status, 'ready');
  assert.ok(store.getState().latestResult);
  store.restartChapter('grain'); choose(store);
  assert.equal(store.getView().status, 'insufficient'); assert.equal(store.getView().unlocked, true);
  assert.equal(store.getState().latestResult, null);
});

test('pending input persists across refresh and can be resumed with the same decision identity', () => {
  const { store, storage } = fixture(); const original = open(store);
  const reloaded = fixture(storage).store, pending = reloaded.getPendingOpen('grain');
  assert.equal(pending.length, 1); assert.deepEqual(pending[0].token, original);
  assert.equal(assess(reloaded, pending[0].token).accepted, true);
  assert.equal(reloaded.getPendingOpen().length, 0);
});

test('checkpoint with a pending placeholder restores its prefix without losing a completed assessment', () => {
  const { store } = fixture(); const token = open(store), checkpoint = store.createCheckpoint('grain');
  choose(store, 'N4-C'); assess(store, token);
  assert.equal(store.restoreCheckpoint(checkpoint).accepted, true);
  assert.equal(store.getState().chapters.grain.events.length, 1);
  assert.equal(store.getState().chapters.grain.events[0].status, 'ready');
  assert.deepEqual(store.getState().chapters.grain.events[0].vector, [-1, null, -1, null]);
});

test('rolling back before a submitted answer rejects its old callback but a preserved pending prefix can still resolve', () => {
  const { store } = fixture(); const before = store.createCheckpoint('grain'), old = open(store);
  const pending = store.createCheckpoint('grain'); choose(store, 'N4-C');
  store.restoreCheckpoint(pending); assert.equal(assess(store, old).accepted, true);
  store.restoreCheckpoint(before); assert.equal(assess(store, old).reason, 'stale-assessment');
  assert.deepEqual(store.getState().chapters.grain.events, []);
});

test('a new submission at the same question replaces its contribution and rejects the old words', () => {
  const { store } = fixture(); const first = open(store); assess(store, first);
  const second = open(store, '我现在就去，后果由我承担。');
  assert.equal(store.getState().chapters.grain.events.length, 1);
  assert.equal(assess(store, first).reason, 'stale-assessment');
  assert.equal(assess(store, second, [2, null, null, null]).accepted, true);
  assert.deepEqual(store.getState().chapters.grain.events[0].vector, [2, null, null, null]);
});

test('cancelling pending work blocks its callbacks; failed assessments remain visibly pending and can retry', () => {
  const { store } = fixture(); const token = open(store);
  store.markOpenFailure(token); assert.equal(store.getPendingOpen()[0].status, 'failed');
  assert.equal(store.getView().pendingCount, 1); assert.equal(assess(store, token).accepted, true);
  const next = open(store, '重说一句。'); store.invalidatePending('grain');
  assert.equal(assess(store, next).reason, 'stale-assessment'); assert.equal(store.getView().pendingCount, 0);
});

test('replay rejects old checkpoints and asynchronous answers even if run IDs are accidentally reused', () => {
  const { store } = fixture(); const token = open(store), checkpoint = store.createCheckpoint('grain');
  store.restartChapter('grain', { runId: checkpoint.runId });
  assert.equal(store.restoreCheckpoint(checkpoint).reason, 'old-epoch');
  assert.equal(assess(store, token).reason, 'stale-assessment');
});

test('local retry removes the failed decision and all later contributions without deleting its death history', () => {
  const { store } = fixture(); choose(store); const token = open(store); assess(store, token); choose(store, 'N4-C');
  store.archiveDeath({ chapterId: 'grain', endingId: 'era-arrest' });
  assert.equal(store.retryFromDecision('grain', 'CH2.open.O1').accepted, true);
  assert.deepEqual(store.getState().chapters.grain.events.map(e => e.decisionId), ['UI-N1']);
  assert.equal(store.getState().deaths.length, 1);
  assert.equal(assess(store, token).reason, 'stale-assessment');
});

test('death-page rerenders deduplicate; a new attempt gets a separate immutable historical snapshot', () => {
  const { store } = fixture(); choose(store);
  const death = () => store.archiveDeath({ chapterId: 'grain', endingId: 'era-arrest' });
  assert.equal(death().accepted, true); assert.equal(death().reason, 'already-archived');
  const first = store.getState().deaths[0];
  assert.equal(store.restoreCheckpoint(first.snapshot).reason, 'history-read-only');
  store.retryFromDecision('grain', 'UI-N1'); choose(store, 'N1-B'); death();
  assert.equal(store.getState().deaths.length, 2); assert.deepEqual(store.getState().deaths[0], first);
  first.snapshot.events[0].vector[1] = 2;
  assert.equal(store.getState().deaths[0].snapshot.events[0].vector[1], -1);
});

test('refreshing the same completed death checkpoint does not create another death attempt', () => {
  const { store, storage } = fixture(); choose(store);
  store.completeChapter('grain', 'test-death');
  store.archiveDeath({ chapterId: 'grain', endingId: 'test-death' });
  const checkpoint = store.createCheckpoint('grain');
  const reloaded = fixture(storage).store;
  assert.equal(reloaded.restoreCheckpoint(checkpoint).accepted, true);
  assert.equal(reloaded.archiveDeath({ chapterId: 'grain', endingId: 'test-death' }).reason, 'already-archived');
  assert.equal(reloaded.getState().deaths.length, 1);
});

test('final confirmed action replaces only O2 C/D; cancel leaves the intention in place', () => {
  const { store } = fixture(); const token = open(store, '我先协调双方，最后仍要完整报案。', 'CH2-O2-INPUT');
  assess(store, token, [-1, 1, -2, -2]); const before = store.getView().axes;
  choose(store, 'UI-CASE-cancel'); assert.deepEqual(store.getView().axes, before);
  choose(store, 'UI-RELEASE-confirm'); const after = store.getView();
  assert.equal(after.axes[0].value, before[0].value); assert.equal(after.axes[1].value, before[1].value);
  assert.ok(after.axes[2].value > 50); assert.ok(after.axes[3].value > 50);
  assert.equal(after.axes[2].evidenceCount, 1);
  assert.deepEqual(after.evidence.find(e => e.decisionId === 'CH2.open.O2').axes, ['A', 'B']);
});

test('unsupported axes stay null; explicit zero counts as evidence and assistant phrasing does not set B', () => {
  const { store } = fixture(); const token = open(store, '我把两端的限制都留下。');
  assert.equal(store.recordOpen({ token, vector: [0, 2, null, null], quotes: [token.input, token.input, null, null], assisted: true }).accepted, true);
  assert.equal(store.getView().axes[0].value, 50); assert.equal(store.getView().axes[0].evidenceCount, 1);
  assert.equal(store.getView().axes[1].value, null); assert.equal(store.getView().axes[2].value, null);
});

test('open scoring requires original quoted evidence and rejects out-of-range or fractional values', () => {
  const { store } = fixture(); const token = open(store);
  assert.equal(store.recordOpen({ token, vector: [-1, null, null, null], quotes: ['并没说过', null, null, null] }).reason, 'unsupported-evidence');
  for (const invalid of [-3, 0.5, 100, undefined]) assert.equal(assess(store, token, [invalid, null, null, null]).reason, 'unsupported-evidence');
  assert.equal(store.getView().pendingCount, 1);
});

test('legacy saves do not invent evidence, and a scoring-version change invalidates live scores and tokens', () => {
  const { store } = fixture(); const token = open(store); choose(store);
  store.restoreCheckpoint(undefined, 'grain'); assert.deepEqual(store.getState().chapters.grain.events, []);
  assert.equal(assess(store, token).reason, 'stale-assessment');
  const fresh = open(store); store.completeChapter('grain', 'E1');
  store.configure({ ...config, version: 'next-rules' });
  assert.equal(store.getView().unlocked, true); assert.equal(store.getView().status, 'insufficient');
  assert.equal(assess(store, fresh).reason, 'stale-assessment');
});

test('namespaces isolate playtests and denied storage leaves the game and personality functional in memory', () => {
  assert.notEqual(personalityNamespace('?playtest=item-cup'), personalityNamespace(''));
  const storage = memory(), main = fixture(storage, personalityNamespace('')).store;
  choose(main); const play = fixture(storage, personalityNamespace('?playtest=item-cup')).store;
  assert.equal(play.getState().chapters.grain.events.length, 0);
  const denied = fixture({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } }).store;
  assert.equal(choose(denied).accepted, true); assert.equal(denied.getView().storageAvailable, false);
});

test('only current evidence reaches the result, and browser aggregation agrees with the design formula', () => {
  const { store } = fixture(); choose(store); const token = open(store); assess(store, token);
  store.completeChapter('grain', 'E1'); const state = store.getState(), profile = coordinates(state.chapters, config.model);
  assert.deepEqual(state.latestResult.coordinates, profile.map(a => a.value));
  assert.equal(Object.hasOwn(state, 'results'), false); assert.equal(store.getView().character.id, state.latestResult.characterId);
  store.restartChapter('grain'); assert.equal(store.getState().latestResult, null); assert.deepEqual(store.getView().evidence, []);
});

test('storage imports whitelist narrative fields instead of carrying API settings or credentials forward', () => {
  const { store, storage } = fixture(); const token = open(store); assess(store, token);
  const raw = store.getState(); raw.apiKey = 'private'; raw.chapters.grain.events[0].authorization = 'private';
  storage.setItem('test', JSON.stringify(raw)); const loaded = fixture(storage).store.getState();
  assert.equal(Object.hasOwn(loaded, 'apiKey'), false); assert.equal(Object.hasOwn(loaded.chapters.grain.events[0], 'authorization'), false);
  assert.equal(store.makeOpenToken({ chapterId: 'grain', nodeId: 'CH2-LY03-018', input: 'Bearer abcdefghijklmnop' }), null);
});
