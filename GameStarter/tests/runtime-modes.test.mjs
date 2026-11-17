import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChapterSession } from '../web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
import { offlineExpressionAgents, offlineWeiyanTurn } from '../web-demo/.build/GameStarter/web-demo/src/offline-expression-agents.js';
import { balance } from '../web-demo/.build/GameStarter/web-demo/src/phone/supplies.js';
import { firstTransfer, secondComplete, secondAuthorization, secondMilitary } from './dialogue-lines.mjs';
const built = path => JSON.parse(readFileSync(new URL(`../web-demo/.build/${path}`, import.meta.url)));
const script = built('story/chapter-one.script.json'), flow = built('story/chapter-one.flow.json');
const { contentVersion } = built('story/session-manifest.json');
const local = offlineExpressionAgents();
const game = (mode = 'offline', judge = local.judge) => new ChapterSession(script, flow, contentVersion, judge, local.generate, mode);
const fixture = (g, round = 2) => { g.restore(JSON.stringify(built(`playtest/weiyan-${round === 1 ? 'first' : 'second'}.json`))); return g; };
const read = g => { let i = 0; while (g.snapshot().phase === 'dialogue' && i++ < 200) g.nextLine(); assert.ok(i < 200); };
const act = (g, id) => { const a = flow.actions.find(a => a.id === id); if (g.snapshot().scene !== a.scene) assert.ok(g.move(a.scene)); assert.ok(g.act(id)); read(g); };

test('offline first chapter completes both rounds and the final report without a model', async () => {
    const g = game(); g.finishCinematic(); read(g);
    act(g, 'read-notice'); act(g, 'meet-first-scout'); g.chooseScout('a'); read(g); act(g, 'intercept-first');
    assert.ok(await g.generateExpression()); assert.equal(g.snapshot().composition.provenance, 'local');
    assert.equal(g.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED, undefined);
    assert.ok(await g.confirmExpression()); assert.equal(g.snapshot().speech.result, 'ok');
    g.acknowledgeReply(); read(g); act(g, 'deliver-first'); act(g, 'stand-watch'); g.finishCinematic(); read(g);
    assert.equal(g.snapshot().end, 'tutorial-sacrifice'); g.rewind(); read(g);
    for (const id of ['ask-guard', 'ask-relay', 'ask-scout']) act(g, id);
    g.beginThinking(); g.connect('C02', 'C03'); g.connect('R01', 'C06');g.connect('C06','C07'); assert.ok(g.followPlan()); read(g); act(g, 'intercept-weiyan');
    for (const id of ['C02', 'C03', 'C06', 'C08']) if (!g.snapshot().story.selected.includes(id)) g.selectEvidence(id);
    assert.equal(balance(g.snapshot().supplies), 0); assert.equal(g.canPrepareSupplies(), false);
    assert.ok(await g.generateExpression()); const restored = game(); restored.restore(g.serialize());
    assert.equal(restored.snapshot().composition.provenance, 'local'); assert.equal(balance(restored.snapshot().supplies), 0);
    assert.ok(await restored.confirmExpression()); assert.equal(restored.snapshot().speech.result, 'ok');
    assert.equal(restored.snapshot().story.flags.REPORT_CLOSED, undefined); restored.acknowledgeReply(); read(restored);
    while (restored.snapshot().phase === 'cinematic') { restored.finishCinematic(); read(restored); }
    assert.equal(restored.snapshot().end, 'safe'); assert.equal(restored.snapshot().story.flags.REPORT_CLOSED, true);
});

test('local rules preserve incomplete, questioned, negated and unsupported facts as clarification', () => {
    const g = fixture(game()); const base = g.expressionContext(secondComplete);
    assert.equal(offlineWeiyanTurn(base).classification.code, 'ok');
    for (const current of [secondMilitary, secondAuthorization, secondComplete.replace('已亲口应允', '没有亲口应允'),
        secondComplete.replace('可能在试探', '不是可能在试探'), secondComplete.replace('已亲口应允在帐外接报，', '已亲口应允在帐外接报？'),
        secondComplete + '不过军报已经送达。', secondComplete + '我不愿交报。']) {
        assert.notEqual(offlineWeiyanTurn({ ...base, current }).classification.code, 'ok', current);
    }
    assert.notEqual(offlineWeiyanTurn({ ...base, evidence: base.evidence.filter(e => e.id !== 'C08') }).classification.code, 'ok');
    assert.equal(offlineWeiyanTurn({ ...base, said: [secondAuthorization], current: secondMilitary }).classification.code, 'ok');
    assert.notEqual(offlineWeiyanTurn({ ...base, said: [secondComplete], current: '姜维没有答应接报。' }).classification.code, 'ok');
    assert.equal(offlineWeiyanTurn({ ...base, current: '将军能否再说清军情？' }).classification.disposition, 'revise');
    assert.equal(offlineWeiyanTurn({ ...base, current: '你是个蠢货！' }).classification.code, 'execute');
    assert.notEqual(offlineWeiyanTurn({ ...base, current: '不能骂您“你是个蠢货”。' }).classification.code, 'execute');
});

test('first-round fallback respects the unacquired camp situation', () => {
    const g = fixture(game(), 1), input = g.expressionContext(firstTransfer);
    assert.equal(offlineWeiyanTurn(input).classification.code, 'ok');
    assert.equal(offlineWeiyanTurn({ ...input, evidence: input.evidence.filter(e => e.id !== 'T02') }).classification.code, 'R1-RETRY');
});

test('mode gates phone purchase and attachment, preserves settled records and grants only once', () => {
    const g = fixture(game());
    for (const mode of ['offline', 'ai']) {
        g.setRuntimeMode(mode); assert.equal(g.canPrepareSupplies(), false); assert.equal(g.buyItem('batteries'), false);
    }
    g.setRuntimeMode('ai-phone'); assert.equal(g.canPrepareSupplies(), true); assert.equal(balance(g.snapshot().supplies), 5000);
    assert.ok(g.buyItem('batteries')); assert.ok(g.attachItem('batteries'));
    g.setRuntimeMode('ai'); assert.deepEqual(g.snapshot().supplies.attached, []); assert.equal(g.attachItem('batteries'), false);
    const restored = game('offline'); restored.restore(g.serialize());
    assert.deepEqual(restored.snapshot().supplies.purchases, ['batteries']); assert.equal(restored.canPrepareSupplies(), false);
    restored.setRuntimeMode('ai-phone'); assert.equal(balance(restored.snapshot().supplies), 3610);
    assert.equal(restored.snapshot().supplies.rewards.length, 1);
});

test('switching mode cancels a late judgment and cannot commit an unread result from another mode', async () => {
    let resolve;
    const g = fixture(game('ai', input => new Promise(done => { resolve = () => done(offlineWeiyanTurn(input)); })), 1);
    g.setDraft(firstTransfer); const pending = g.confirmExpression();
    g.setRuntimeMode('offline'); resolve(); assert.equal(await pending, false);
    assert.equal(g.snapshot().phase, 'expression'); assert.equal(g.snapshot().speech, null);
    assert.equal(g.snapshot().story.draft, firstTransfer); assert.equal(g.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED, undefined);
    const source = fixture(game('ai'), 1); source.setDraft(firstTransfer); await source.confirmExpression();
    const restored = game(); restored.restore(source.serialize()); assert.equal(restored.snapshot().phase, 'expression');
    assert.equal(restored.acknowledgeReply(), false);
});

test('local reference generation retains input literally and cites only selected sources', async () => {
    const g = fixture(game()); g.setFocus('姜维答应了吗？');
    assert.ok(await g.generateExpression()); assert.equal(g.snapshot().story.draft, '姜维答应了吗？');
    assert.equal(g.snapshot().story.flags.PERSUADED, undefined);
    g.setFocus(''); g.selectEvidence('C08'); assert.ok(await g.generateExpression());
    assert.equal(g.snapshot().story.draft, '姜维答应了吗？', 'Clearing the focus must preserve the existing draft');
    g.setDraft(''); assert.ok(await g.generateExpression());
    assert.match(g.snapshot().story.draft, /姜维已亲口答应/); assert.doesNotMatch(g.snapshot().story.draft, /闻号|调动/);
});


test('AI connection fallback preserves AI preference without reviving the retired phone', async () => {
    const modes = await import('../web-demo/.build/GameStarter/web-demo/src/runtime-mode.js');
    const values = new Map(), originalStorage = globalThis.localStorage, originalFetch = globalThis.fetch;
    globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    try {
        modes.setRuntimeConnection(true);
        assert.equal(modes.readRuntimeMode(), 'ai'); assert.equal(modes.readPhonePreference(), false);
        let requests = 0;
        globalThis.fetch = async url => { assert.match(url, /\/health$/); requests++; return { ok: true, json: async () => ({ configured: false }) }; };
        assert.equal(await modes.initializeRuntimeMode(), 'offline'); assert.equal(requests, 1);
        assert.equal(values.has(modes.RUNTIME_MODE_KEY), false);
        assert.equal(modes.setRuntimeConnection(true), 'ai');
        modes.saveRuntimeMode('ai'); assert.equal(modes.readPhonePreference(), false);
        assert.equal(modes.setRuntimeConnection(false), 'offline');
        assert.equal(modes.setRuntimeConnection(true), 'ai');
        modes.saveItemSystemEnabled(false); modes.saveRuntimeMode('offline'); assert.equal(modes.readPhonePreference(), false);
        assert.equal(modes.setRuntimeConnection(true), 'offline');
        modes.saveItemSystemEnabled(true);
        modes.saveRuntimeMode('ai-phone'); assert.equal(values.get(modes.RUNTIME_MODE_KEY), 'ai'); modes.saveRuntimeMode('offline'); assert.equal(modes.readPhonePreference(), false);
    } finally { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; modes.setRuntimeConnection(true); }
});

test('tutorial accepts a current relay proposal without optional scout intelligence', async () => {
    const { dialogueFixtures } = await import('../../tools/ai/dialogue-fixtures.mjs');
    const { resolve } = await import('node:path');
    const fixtures = await dialogueFixtures(resolve('GameStarter/web-demo/.build'));
    for (const branch of ['a', 'b']) {
        const s = fixtures.first(undefined, undefined, branch);
        for (const current of ['将军，帐前有禁令，我来替您转达。', '不能闯帐，让我传报。'])
            assert.equal(offlineWeiyanTurn(s.expressionContext(current)).classification.code, 'ok', branch + current);
        for (const current of ['将军，帐前有禁令。', '帐前有禁令，我明天再报。', '帐前有禁令，我不会转呈。'])
            assert.notEqual(offlineWeiyanTurn(s.expressionContext(current)).classification.code, 'ok', current);
    }
});
