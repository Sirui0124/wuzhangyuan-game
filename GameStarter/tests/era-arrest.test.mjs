import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChapterSession } from '../web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
import { withItemDialogue } from './item-conduct-fixture.mjs';
import { parseEraAssessment, parseEraFailure, isEraFailure, eraArrestReply } from '../web-demo/.build/GameStarter/web-demo/src/phone/era-judgment.js';
import { parseItemDecision, balance, buySuggestedSupply } from '../web-demo/.build/GameStarter/web-demo/src/phone/supplies.js';
import { GrainSession } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import { parseJudgment, judgeOpenDialogue } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/open-dialogue.js';
import { GameApi } from '../web-demo/.build/GameStarter/assets/scripts/GameApi.js';
import { toggleGrainItem, grainPhone } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/phone.js';
import { npcTurn } from './npc-fixture.mjs';
const json = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const content = json('../../content/chapters/wuzhang/chapter-one.script.json'), flow = json('../../content/chapters/wuzhang/chapter-one.flow.json');
const checkpoint = json('../web-demo/.build/playtest/weiyan-second.json');
const story = json('../../content/chapters/grain/chapter-two.playable.json'), rubric = json('../../content/chapters/grain/chapter-two.rubric.json');
const words = '看我放出这悬空人影！这是我拘来的魂魄，我乃天降神人，你们都须听我号令。';
const item = { id: 'shop-11111111-2222-4333-8444-555555555555', name: '便携全息风扇显示器', price: 1000, ability: '用旋转灯条显示预装的人像，呈现悬浮影像效果。', boundary: '需供电，无网络，不能拘魂或创造生命。', source: '', quote: '测试估价', date: '2026-10-25', priceKind: 'estimate', why: '展示', request: '买显示器', searchState: 'empty', sources: [] };
const era = (overrides = {}) => ({ version: 1, severeMismatch: true, explanation: 'incoherent', itemIds: [item.id], quote: words, reason: '所示悬空人像远超当时常识，自称拘魂不能解释实际器具。', ...overrides });
const failureTurn = input => ({ npcTurn: npcTurn(input, 'P2-F1', eraArrestReply), itemDecision: { version: 1, route: null, itemIds: [item.id], quote: input.current, reason: era().reason, eraFailure: era({ quote: input.current }) } });
function first(judge = async input => failureTurn(input)) {
    const s = new ChapterSession(content, flow, checkpoint.contentVersion, judge);
    s.restore(JSON.stringify(checkpoint)); assert.ok(s.buySuggestedItem(item)); assert.ok(s.attachItem(item.id)); s.setDraft(words); return s;
}
function second() {
    const s = new GrainSession(story, undefined, rubric);
    for (let i = 0; i < 100 && s.current.kind !== 'open'; i++) assert.ok(s.advance(s.current.options?.[0]?.id));
    s.unlockPhone(); assert.ok(buySuggestedSupply(s.state.supplies, item)); toggleGrainItem(s, item.id); s.state.draft = words; return s;
}

test('chapter two malformed model JSON reports a retry message without exposing parser internals', async () => {
    const original = GameApi.prototype.respond;
    try {
        for (const text of ['{"valid":true,"scores":{', 'null', '[]']) {
            GameApi.prototype.respond = async () => ({ text });
            await assert.rejects(judgeOpenDialogue(words, rubric, [], new AbortController().signal, [item]),
                { kind: 'protocol', message: '系统未能完整处理这次回应，原话和线索已保留，可以原样重试。' });
        }
    } finally { GameApi.prototype.respond = original; }
});
test('arrest requires BOTH conditions, actual offered IDs and a quote from committed speech', () => {
    for (const severeMismatch of [true, false]) for (const explanation of ['coherent', 'incoherent', 'uncertain']) {
        const checked = parseEraAssessment(era({ severeMismatch, explanation }), [item.id], words);
        assert.equal(isEraFailure(checked), severeMismatch && explanation === 'incoherent');
    }
    for (const bad of [undefined, {}, era({ severeMismatch: 'true' }), era({ itemIds: [] }), era({ itemIds: ['invented'] }), era({ itemIds: [item.id, item.id] }), era({ quote: '不是原话' }), era({ quote: '' }), era({ reason: '' })])
        assert.throws(() => parseEraAssessment(bad, [item.id], words));
    assert.throws(() => parseEraFailure(era(), [], words));
    assert.throws(() => parseEraFailure(era({ explanation: 'coherent' }), [item.id], words));
    assert.throws(() => parseItemDecision({ version: 1, route: 'item-plan', itemIds: [item.id], quote: words, reason: era().reason, eraFailure: era() }, [item.id], words));
});
test('shared assessment in item adapter takes precedence over success; coherent/uncertain cases keep ordinary flow', async () => {
    const s = first(), input = s.expressionContext(words);
    for (const [assessment, arrested] of [[era(), true], [era({ explanation: 'coherent' }), false], [era({ explanation: 'uncertain' }), false], [era({ severeMismatch: false }), false]]) {
        const judge = withItemDialogue({ respond: async () => ({ text: JSON.stringify({ eraAssessment: assessment, decision: { version: 1, route: 'item-plan', itemIds: [item.id], quote: words, reason: '可执行' }, reply: '已经得到授权。' }) }) }, async () => { throw Error('wrong adapter'); });
        const out = await judge(input, new AbortController().signal);
        assert.equal(!!out.itemDecision.eraFailure, arrested);
        assert.equal(out.itemDecision.route, arrested ? null : 'item-plan');
        if (arrested) assert.equal(out.npcTurn.reply.text, eraArrestReply);
    }
});
test('chapter one: committed reply, arrest, save/restore and retry retain money, items, evidence and authorization', async () => {
    const s = first(), before = s.snapshot(), events = [];
    s.onChange(e => { if (e.type === 'ending') events.push(e.id); });
    assert.equal(s.snapshot().end, null); assert.equal(s.finishEraArrest(), false);
    assert.ok(await s.confirmExpression()); assert.equal(s.snapshot().end, null);
    // An unread result can restore, but does not itself advance to the ending.
    s.restore(s.serialize()); assert.equal(s.snapshot().speech.status, 'ready');
    assert.ok(s.openNotes()); s.restore(s.serialize()); assert.ok(s.closeNotes());
    assert.ok(s.acknowledgeReply()); assert.equal(s.currentReply().text, eraArrestReply);
    assert.ok(s.openNotes()); s.restore(s.serialize()); assert.ok(s.closeNotes());
    assert.equal(s.reviseExpression(), false); assert.equal(s.finishExecution(), false);
    s.restore(s.serialize()); assert.ok(s.finishEraArrest()); assert.deepEqual(events, ['era-arrest']);
    const end = s.snapshot(); assert.equal(end.end, 'era-arrest'); assert.equal(end.story.flags.REPORT_CLOSED, undefined);
    assert.equal(end.supplies.agreement, null); assert.deepEqual(end.supplies.consumed, []); assert.equal(s.toMap(), false);
    s.restore(s.serialize()); assert.equal(s.snapshot().end, 'era-arrest'); assert.ok(s.retryEraArrest());
    const retry = s.snapshot(); assert.equal(retry.phase, 'expression'); assert.equal(retry.story.draft, words);
    assert.equal(balance(retry.supplies), balance(before.supplies)); assert.deepEqual(retry.supplies, before.supplies);
    assert.deepEqual(retry.story.collected, before.story.collected); assert.deepEqual(retry.story.history, before.story.history);
    s.restore(s.serialize()); assert.ok(s.attachItem(item.id)); // Can retract the item after rewind.
});
test('malformed, mismatched and late results never arrest or spend items', async () => {
    for (const alter of [r => { r.itemDecision.eraFailure.itemIds = ['invented']; }, r => { r.npcTurn.reply.text = '我已把你斩首。'; }, r => { r.itemDecision.eraFailure.severeMismatch = false; }]) {
        const s = first(async input => { const r = failureTurn(input); alter(r); return r; });
        assert.equal(await s.confirmExpression(), false); assert.equal(s.snapshot().speech.status, 'failed');
        assert.equal(s.snapshot().end, null); assert.deepEqual(s.snapshot().supplies.consumed, []); assert.ok(s.reviseExpression());
    }
    for (const operation of ['cancel', 'restore', 'restart']) {
        let finish;
        const s = first(input => new Promise(resolve => { finish = () => resolve(failureTurn(input)); }));
        const pending = s.confirmExpression();
        if (operation === 'cancel') s.cancelSpeech(); else if (operation === 'restore') s.restore(s.serialize()); else s.restart();
        const before = s.serialize(); finish(); assert.equal(await pending, false); assert.equal(s.serialize(), before);
    }
});
test('chapter one rejects a forged ending, false dual condition and mismatched history atomically', async () => {
    const s = first(); await s.confirmExpression(); s.acknowledgeReply(); s.finishEraArrest();
    for (const alter of [r => { delete r.speech.itemDecision.eraFailure; }, r => { r.speech.itemDecision.eraFailure.explanation = 'coherent'; }, r => { r.story.history.at(-1).itemDecision.eraFailure.itemIds = ['invented']; }, r => { r.end = 'weiyan-execution'; }]) {
        const before = s.serialize(), changed = JSON.parse(before); alter(changed);
        assert.throws(() => s.restore(JSON.stringify(changed))); assert.equal(s.serialize(), before);
    }
});
test('chapter two arrests before progression or gift scoring, survives reload and retries only this conversation', () => {
    const s = second(), before = structuredClone(s.state), scores = s.scores;
    const judgment = parseJudgment(JSON.stringify({ eraFailure: era() }), words, rubric, [item.id]);
    assert.ok(s.submit(judgment)); assert.deepEqual(s.scores, scores); assert.equal(s.state.end, null);
    assert.deepEqual(s.state.gifts, []); assert.deepEqual(s.state.supplies.consumed, []);
    assert.equal(grainPhone(() => s, () => {}).canPrepareSupplies(), false);
    toggleGrainItem(s, item.id); assert.deepEqual(s.state.supplies.attached, [item.id]);
    assert.equal(s.submit(judgment), false); assert.ok(s.advance()); assert.equal(s.state.end, 'era-arrest');
    assert.equal(s.current.id, before.node); assert.equal(s.advance(), false);
    const restored = new GrainSession(story, structuredClone(s.state), rubric);
    assert.equal(restored.state.end, 'era-arrest'); assert.ok(restored.retryEraArrest());
    assert.equal(restored.state.draft, words); assert.deepEqual(restored.state.visited, before.visited);
    assert.deepEqual(restored.state.supplies, before.supplies); assert.deepEqual(restored.scores, scores);
    assert.equal(restored.advance(), false); toggleGrainItem(restored, item.id); assert.deepEqual(restored.state.supplies.attached, []);
});
test('chapter two rejects unowned/consumed/forged failure records and gifts with arrest', () => {
    assert.throws(() => parseJudgment(JSON.stringify({ eraFailure: era(), gift: { ids: [item.id], quote: words } }), words, rubric, [item.id]));
    const s = second(); s.submit(parseJudgment(JSON.stringify({ eraFailure: era() }), words, rubric, [item.id])); s.advance();
    for (const change of [r => { r.supplies.attached = []; }, r => { r.supplies.consumed = [item.id]; }, r => { delete r.judgments[r.node].eraFailure; }, r => { r.visited.push(r.node); }]) {
        const copy = structuredClone(s.state); change(copy); assert.throws(() => new GrainSession(story, copy, rubric));
    }
});
