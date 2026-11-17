import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPersonalityTracker } from '../web-demo/.build/GameStarter/web-demo/src/personality/module.js';
import { normalizePersonalityConfig } from '../web-demo/.build/GameStarter/web-demo/src/personality/config.js';
const config = normalizePersonalityConfig(...['characters-and-model', 'chapter-one-two-scoring', 'chapter-three-scoring']
    .map(name => JSON.parse(readFileSync(new URL(`../../docs/design/personality/${name}.json`, import.meta.url)))));
const storage = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) }; };
const paused = () => {
    const requests = [];
    return { requests, assess: (input, signal) => new Promise(resolve => requests.push({ input, signal, resolve })), cancel() {}, dispose() {} };
};
const resolveAnswer = request => request.resolve({ vector: [-1, -1, -1, null], quotes: [request.input.input, request.input.input, request.input.input, null] });
const tick = () => new Promise(resolve => setImmediate(resolve));
const options = (saved, assess) => ({ storage: saved, namespace: 'module-test', config, assess });

test('confirmed input is stored before the request; a late answer cannot resurrect a restarted chapter', async () => {
    const saved = storage(), assessor = paused(), tracker = await createPersonalityTracker('grain', options(saved, assessor));
    tracker.attach(null); tracker.open('CH2-LY03-018', '先核清，再如实交代。', { origin: 'self-authored' });
    assert.equal(tracker.snapshot().checkpoint.events[0].status, 'pending');
    tracker.restart(); resolveAnswer(assessor.requests[0]); await tick();
    assert.equal(tracker.snapshot().checkpoint.events.length, 0); tracker.dispose();
});

test('a new chapter resumes an interrupted older answer with its original source information', async () => {
    const saved = storage(), a = paused(), one = await createPersonalityTracker('wuzhang', options(saved, a));
    one.attach(null); one.open('P2-01', '将军请先在帐外等，我来传报。', { origin: 'self-authored', round: 2 });
    one.dispose();
    const b = paused(), two = await createPersonalityTracker('grain', options(saved, b));
    two.attach(null);
    assert.equal(b.requests.length, 1); assert.equal(b.requests[0].input.chapterId, 'wuzhang');
    assert.equal(b.requests[0].input.origin, 'self-authored');
    resolveAnswer(b.requests[0]); await tick();
    assert.equal(two.getView().pendingCount, 0); two.dispose();
});

test('restoring a chapter checkpoint keeps only its prefix and resumes saved confirmed speech', async () => {
    const saved = storage(), assessor = paused(), tracker = await createPersonalityTracker('grain', options(saved, assessor));
    tracker.attach(null); tracker.choice('N1-A');
    tracker.open('CH2-LY03-018', '我先查明。', { origin: 'self-authored' });
    const snapshot = { personality: tracker.snapshot() };
    tracker.choice('N4-C'); tracker.attach(snapshot);
    assert.equal(tracker.snapshot().checkpoint.events.length, 2);
    assert.equal(assessor.requests.length, 2);
    resolveAnswer(assessor.requests[0]); await tick();
    assert.equal(tracker.getView().pendingCount, 1);
    resolveAnswer(assessor.requests[1]); await tick();
    assert.equal(tracker.getView().pendingCount, 0); tracker.dispose();
});

test('turning AI off cancels work, preserves evidence and only resumes after enabling', async () => {
    let enabled = true;
    const assessor = paused(), tracker = await createPersonalityTracker('grain', { ...options(storage(), assessor), enabled: () => enabled });
    tracker.attach(null); tracker.open('CH2-LY03-018', '我先查明。', { origin: 'self-authored' });
    enabled = false; tracker.resume(); assert.ok(assessor.requests[0].signal.aborted);
    resolveAnswer(assessor.requests[0]); await tick(); assert.equal(tracker.getView().pendingCount, 1);
    enabled = true; tracker.resume(); assert.equal(assessor.requests.length, 2);
    resolveAnswer(assessor.requests[1]); await tick(); assert.equal(tracker.getView().pendingCount, 0); tracker.dispose();
});

test('old story saves never import guessed historical choices; finished chapter unlock remains', async () => {
    const tracker = await createPersonalityTracker('grain', options(storage(), paused()));
    tracker.attach(null); tracker.choice('N1-A'); tracker.complete('E4-early');
    tracker.attach({ chosen: ['N1-A', 'N4-C'] });
    assert.equal(tracker.snapshot().checkpoint.events.length, 0);
    assert.equal(tracker.getView().status, 'insufficient'); tracker.dispose();
});
