import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChapterSession } from '../web-demo/.build/GameStarter/web-demo/src/chapter-session.js';

const built = path => JSON.parse(readFileSync(new URL(`../web-demo/.build/${path}`, import.meta.url)));
const script = built('story/chapter-one.script.json'), flow = built('story/chapter-one.flow.json');
const version = built('story/session-manifest.json').contentVersion;
const create = () => new ChapterSession(script, flow, version);
const read = s => { while (s.snapshot().phase === 'dialogue') s.nextLine(); };
function afterNotice() {
    const s = create(); s.finishCinematic(); read(s); s.act('read-notice'); read(s); return s;
}

test('tent opens only after reading the notice; hearing a cough does not grant a clue or skip the main story', () => {
    const s = create();
    assert.equal(s.tentAction('listen'), false);
    s.finishCinematic(); read(s);
    assert.equal(s.tentAction('listen'), false);
    s.act('read-notice');
    assert.equal(s.tentAction('listen'), false);
    read(s);
    const story = s.snapshot().story;
    assert.ok(s.tentAction('listen'));
    assert.equal(s.snapshot().tent, 'cough');
    assert.equal(s.tentAction('continue'), false);
    assert.ok(s.tentAction('next'));
    assert.equal(s.snapshot().phase, 'explore');
    assert.deepEqual(s.snapshot().story, story);
    assert.ok(s.tentAction('listen'));
    assert.equal(s.snapshot().tent, 'side');
    assert.ok(s.tentAction('leave'));
    assert.equal(s.snapshot().phase, 'explore');
    assert.deepEqual(s.snapshot().story, story);
    assert.ok(s.tentAction('listen'));
    assert.ok(s.tentAction('continue'));
    assert.equal(s.snapshot().tent, 'footsteps');
    assert.equal(s.tentAction('next'), false);
    assert.ok(s.tentAction('leave'));
    assert.equal(s.snapshot().phase, 'explore');
    assert.deepEqual(s.snapshot().story, story);
    assert.ok(s.move('report_post'));
    assert.equal(s.tentAction('listen'), false);
    assert.ok(s.act('meet-first-scout'));
});

test('each eavesdropping stage reloads, death unlocks once, and retry preserves previous progress', () => {
    let s = afterNotice();
    const before = s.snapshot();
    const endings = [];
    for (const [action, stage] of [['listen', 'cough'], ['next', 'heard'], ['listen', 'side'], ['continue', 'footsteps'], ['continue', 'caught'], ['next', 'dead']]) {
        s.onChange(e => { if (e.type === 'ending') endings.push(e.id); });
        assert.ok(s.tentAction(action));
        assert.equal(s.snapshot().tent, stage);
        const raw = s.serialize(); s = create(); s.restore(raw);
        assert.equal(s.snapshot().tent, stage);
    }
    assert.deepEqual(endings, ['tent-execution']);
    assert.equal(s.snapshot().phase, 'death');
    assert.equal(s.tentAction('next'), false);
    assert.ok(s.tentAction('retry'));
    const after = s.snapshot();
    assert.equal(after.phase, 'explore');
    assert.equal(after.tent, 'unheard');
    assert.equal(after.end, null);
    assert.equal(after.round, before.round);
    assert.deepEqual(after.story.completed, before.story.completed);
    assert.deepEqual(after.story.collected, before.story.collected);
    assert.deepEqual(after.finishedSections, before.finishedSections);
    assert.deepEqual(after.supplies, before.supplies);
    assert.ok(s.move('report_post'));
    assert.ok(s.act('meet-first-scout'));
});

test('existing saves without a tent field still load', () => {
    const previous = afterNotice().snapshot(); delete previous.tent;
    const s = create(); s.restore(JSON.stringify(previous));
    assert.equal(s.snapshot().tent, 'unheard');
    assert.ok(s.tentAction('listen'));
});
