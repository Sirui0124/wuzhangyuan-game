import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChapterSession } from '../web-demo/.build/GameStarter/web-demo/src/chapter-session.js';

const built = path => JSON.parse(readFileSync(new URL(`../web-demo/.build/${path}`, import.meta.url)));
const script = built('story/chapter-one.script.json');
const flow = built('story/chapter-one.flow.json');
const { contentVersion } = built('story/session-manifest.json');

test('special playtests restore against the current build without stale story versions', () => {
    for (const [file, phase, round] of [
        ['art-review/thought-playtest.json', 'thoughts', 2],
        ['playtest/weiyan-first.json', 'expression', 1],
        ['playtest/weiyan-second.json', 'expression', 2],
    ]) {
        const fixture = built(file);
        assert.equal(fixture.contentVersion, contentVersion, file);
        const session = new ChapterSession(script, flow, contentVersion);
        session.restore(JSON.stringify(fixture));
        const state = session.snapshot();
        assert.equal(state.phase, phase, file);
        assert.equal(state.round, round, file);
        if (phase === 'thoughts') {
            assert.ok(state.story.collected.includes('C03'));
            assert.ok(!state.story.flags.Q1_DONE);
            assert.ok(!state.story.flags.JIANG_AUTH_GRANTED);
        }
    }
});
