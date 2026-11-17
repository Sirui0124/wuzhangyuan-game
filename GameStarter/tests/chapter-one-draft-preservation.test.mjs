import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, relative, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { npcTurn } from './npc-fixture.mjs';

// Exercise the current sources without changing the shared playable build or using any AI service.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = mkdtempSync(join(tmpdir(), 'wuzhang-draft-preservation-')), compiled = new Set();
function compile(path) {
    path = resolve(path); assert.ok(path.startsWith(root + sep));
    const destination = join(output, relative(root, path).replace(/\.ts$/, '.mjs'));
    if (compiled.has(path)) return destination; compiled.add(path);
    let code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
    code = code.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_, a, specifier, b) => {
        compile(resolve(dirname(path), specifier.replace(/\.js$/, '') + '.ts'));
        return `${a}${specifier.replace(/\.js$/, '')}.mjs${b}`;
    });
    mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, code); return destination;
}
const load = async name => import(pathToFileURL(compile(join(root, 'GameStarter/web-demo/src', name + '.ts'))).href);
const { ChapterSession } = await load('chapter-session');
const { expressionAgents } = await load('expression-agent');
const { ExpressionInputConflictError } = await load('expression-audit');
const { offlineExpressionAgents } = await load('offline-expression-agents');
const content = JSON.parse(readFileSync(join(root, 'content/chapters/wuzhang/chapter-one.script.json')));
const flow = JSON.parse(readFileSync(join(root, 'content/chapters/wuzhang/chapter-one.flow.json')));
const original = '帐前有禁令，不能擅入。营门尚未失守，魏军只是在探问丞相与发令者。将军先留步，我替你通报，绝不误军情。';
// Build once through ordinary actions, then restore the same fixed save for each case.
const prepared = new ChapterSession(content, flow, 'g02-fixed-fixture');
const read = () => { let n = 0; while (prepared.row() && n++ < 200) prepared.nextLine(); assert.ok(n < 200); };
const act = id => { const action = flow.actions.find(a => a.id === id); if (prepared.snapshot().scene !== action.scene) prepared.move(action.scene); assert.ok(prepared.act(id)); read(); };
prepared.finishCinematic(); read(); act('read-notice'); act('meet-first-scout'); prepared.chooseScout('a'); read(); act('intercept-first'); prepared.setDraft(original);
const fixture = prepared.serialize();
const candidateFor = (input, text = original) => ({ status: 'ok', text, evidenceIds: input.brief.selectedEvidence.map(e => e.id) });
function session(generate, judge) {
    const s = new ChapterSession(content, flow, 'g02-fixed-fixture', judge, generate);
    s.restore(fixture); return s;
}
async function capture(draft, focus, unselect = false) {
    let input;
    const s = session(async data => { input = data; return candidateFor(data, draft || focus); });
    if (unselect) for (const id of s.snapshot().story.selected) s.selectEvidence(id);
    s.setDraft(draft); s.setFocus(focus); assert.equal(await s.generateExpression(), true);
    return { s, input };
}
function apiQueue(values) {
    const calls = [];
    return { calls, api: { respond: async request => {
        calls.push(request.text); assert.ok(values.length, 'unexpected request');
        return { text: JSON.stringify(values.shift()) };
    } } };
}
const payload = text => JSON.parse(text.slice(text.lastIndexOf('资料：') + 3));
after(() => {
    assert.equal(dirname(resolve(output)), resolve(tmpdir()));
    assert.ok(relative(tmpdir(), output).startsWith('wuzhang-draft-preservation-'));
    rmSync(output, { recursive: true, force: true });
});

test('fixed restored C001 state sends the entire manual draft, including the reporting promise', async () => {
    const { s, input } = await capture(original, '');
    assert.deepEqual(input.brief.playerIntent, { mode: 'compose-selected-with-intent', words: original, draft: original, focus: '' });
    assert.equal(s.snapshot().speech, null); assert.deepEqual(s.snapshot().story.history, JSON.parse(fixture).story.history);
    assert.equal(s.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED, undefined);
});
test('draft-only, focus-only and compatible combined inputs remain distinct, including with no evidence', async () => {
    for (const [draft, focus] of [[original, ''], ['', '我替你通报'], [original, '说简短些']]) {
        const { input } = await capture(draft, focus, true);
        assert.equal(input.brief.playerIntent.words, draft || focus);
        assert.equal(input.brief.playerIntent.draft, draft); assert.equal(input.brief.playerIntent.focus, focus);
        assert.deepEqual(input.brief.selectedEvidence, []);
        const q = apiQueue([candidateFor(input, draft || focus)]);
        await expressionAgents(q.api).generate(input, new AbortController().signal);
        assert.deepEqual(payload(q.calls[0]).playerIntent, input.brief.playerIntent);
        assert.equal(q.calls.length, 1);
    }
});
test('legacy writer refusal keeps the draft editable and preserves both inputs without an audit error', async () => {
    for (const status of ['input_conflict', 'needs_revision']) {
        let calls = 0;
        const api = { respond: async request => {
            calls++; assert.equal(payload(request.text).playerIntent.draft, original);
            return { text: JSON.stringify({ status, text: '', evidenceIds: [], itemLinks: [] }) };
        } };
        const s = session(expressionAgents(api).generate); s.setFocus('改成我不通报');
        assert.equal(await s.generateExpression(), true);
        assert.equal(s.snapshot().story.draft, original); assert.equal(s.snapshot().composition.focus, '改成我不通报');
        assert.equal(s.snapshot().composition.error, ''); assert.equal(s.snapshot().composition.status, 'ready'); assert.equal(s.snapshot().speech, null);
        assert.equal(calls, 1); assert.equal(s.canRestorePreviousDraft, false);
    }
});
test('combined input returns the writer draft without requiring a conflict audit result', async () => {
    const { input } = await capture(original, '说简短些');
    const q = apiQueue([candidateFor(input)]);
    assert.equal((await expressionAgents(q.api).generate(input, new AbortController().signal)).text, original);
    assert.equal(q.calls.length, 1);
});
test('an incomplete candidate is still reviewable and undoable, with no semantic gate or story advance', async () => {
    let calls = 0;
    const s = session(expressionAgents({ respond: async () => { calls++; return { text: JSON.stringify({ status: 'ok', text: '帐前禁入。', evidenceIds: [] }) }; } }).generate);
    s.setFocus('说简短些'); const history = s.snapshot().story.history;
    assert.ok(await s.generateExpression()); assert.equal(calls, 1);
    assert.equal(s.snapshot().story.draft, '帐前禁入。'); assert.equal(s.canRestorePreviousDraft, true);
    assert.equal(s.snapshot().speech, null); assert.deepEqual(s.snapshot().story.history, history);
    assert.ok(s.restorePreviousDraft()); assert.equal(s.snapshot().story.draft, original);
});
test('manual edits, supplementary edits and cancel discard late success or failure without touching draft history', async () => {
    for (const change of [s => s.setDraft('我先问清楚。'), s => s.setFocus('保留原话'), s => s.cancelGeneration()]) {
        for (const reject of [false, true]) {
            let settle;
            const s = session(() => new Promise((resolve, fail) => { settle = reject ? fail : resolve; }));
            const pending = s.generateExpression(); change(s); const before = s.serialize();
            settle(reject ? new ExpressionInputConflictError() : { text: '迟到候选', evidenceIds: [] });
            assert.equal(await pending, false); assert.equal(s.serialize(), before);
        }
    }
});

test('cancelled or failed polish leaves the preserved draft speakable without regeneration, while pending work stays blocked', async () => {
    for (const outcome of ['cancelled', 'failed']) {
        let settle, judged = 0;
        const s = session(() => outcome === 'failed' ? Promise.reject(Error('test writer unavailable')) : new Promise(resolve => { settle = resolve; }),
            async input => { judged++; assert.equal(input.current, original); return npcTurn(input); });
        const pending = s.generateExpression();
        assert.equal(await s.confirmExpression(), false, 'cannot submit while polishing');
        if (outcome === 'cancelled') s.cancelGeneration(); else await pending;
        assert.equal(s.snapshot().composition.status, outcome);
        assert.equal(await s.confirmExpression(), true);
        assert.equal(judged, 1); assert.equal(s.snapshot().speech.text, original); assert.equal(s.snapshot().speech.status, 'ready');
        if (outcome === 'cancelled') {
            const before = s.serialize(); settle({text:'迟到候选',evidenceIds:[]});
            assert.equal(await pending, false); assert.equal(s.serialize(), before);
        }
    }
});
test('restore is limited to the latest successful polish, survives save, and cancels a pending replacement', async () => {
    let input, settle, count = 0;
    const s = session(async data => { input = data; if (++count === 3) return new Promise(resolve => { settle = resolve; }); return candidateFor(data, count === 1 ? '第一版润色' : '第二版润色'); });
    assert.equal(s.canRestorePreviousDraft, false);
    await s.generateExpression(); assert.equal(s.canRestorePreviousDraft, true);
    await s.generateExpression(); assert.equal(s.snapshot().composition.previousDraft.text, '第一版润色');
    const restored = session(); restored.restore(s.serialize());
    assert.equal(restored.canRestorePreviousDraft, true); assert.equal(restored.restorePreviousDraft(), true);
    assert.equal(restored.snapshot().story.draft, '第一版润色'); assert.equal(restored.canRestorePreviousDraft, false);
    const pending = s.generateExpression(); assert.equal(s.restorePreviousDraft(), true); const before = s.serialize();
    settle(candidateFor(input, '迟到第三版')); assert.equal(await pending, false); assert.equal(s.serialize(), before);
    assert.equal(s.snapshot().speech, null); assert.equal(s.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED, undefined);
});
test('a failed polish leaves the existing restore point unchanged, and malformed restore data is rejected', async () => {
    let fails = false; const s = session(async data => { if (fails) throw Error('offline'); return candidateFor(data, '成功新稿'); });
    await s.generateExpression(); const previous = s.snapshot().composition.previousDraft;
    fails = true; await s.generateExpression(); assert.deepEqual(s.snapshot().composition.previousDraft, previous);
    const bad = s.snapshot(); bad.composition.previousDraft = { text: '伪造', provenance: 'manual', evidenceIds: ['UNKNOWN'] };
    assert.throws(() => session().restore(JSON.stringify(bad)), /草稿记录不完整/);
});
test('legacy words-only generator input and no-AI draft-only composition remain compatible', async () => {
    const { input } = await capture(original, '', true);
    delete input.brief.playerIntent.draft; delete input.brief.playerIntent.focus;
    const q = apiQueue([candidateFor(input)]);
    assert.equal((await expressionAgents(q.api).generate(input, new AbortController().signal)).text, original);
    assert.equal((await offlineExpressionAgents().generate(input, new AbortController().signal)).text, original);
});
test('no-AI mode preserves both fields and reports its inability to merge, without pretending to judge a conflict', async () => {
    const s = session(offlineExpressionAgents().generate); s.setFocus('说简短些');
    assert.equal(await s.generateExpression(), false);
    assert.equal(s.snapshot().story.draft, original); assert.equal(s.snapshot().composition.focus, '说简短些');
    assert.match(s.snapshot().composition.error, /无法合并补充说明/);
    assert.doesNotMatch(s.snapshot().composition.error, /有不一致/);
    assert.equal(s.snapshot().speech, null);
});
