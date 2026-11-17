import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, relative, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

// Compile this dependency graph in an isolated directory; never rebuild the shared playable build.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = mkdtempSync(join(tmpdir(), 'wuzhang-grain-dialogue-'));
const compiled = new Set();
function compile(path) {
    path = resolve(path);
    assert.ok(path.startsWith(root + sep));
    const destination = join(output, relative(root, path).replace(/\.ts$/, '.mjs'));
    if (compiled.has(path)) return destination;
    compiled.add(path);
    let text = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
    text = text.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_, a, specifier, b) => {
        compile(resolve(dirname(path), specifier.replace(/\.js$/, '') + '.ts'));
        return `${a}${specifier.replace(/\.js$/, '')}.mjs${b}`;
    });
    mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, text); return destination;
}
const base = join(root, 'GameStarter/web-demo/src/chapters/chapter-two');
const load = async name => import(pathToFileURL(compile(join(base, name + '.ts'))).href);
const { parseJudgment, judgeOpenDialogue, rubricForRound } = await load('open-dialogue');
const { GrainSession } = await load('session');
const { fixedJudgment } = await load('film-dialogue');
const { parseResponseCandidate, fixedDialogueResponse, responseVersion, currentScoringView } = await load('dialogue-response');
const { parseIntentCandidate, composeIntentResponse, responseIntentBank } = await load('dialogue-intents');
const { repairJudgmentQuotes } = await load('dialogue-quote-repair');
const { beginDialogueDiagnostic, recordDialogueDiagnostic, exportDialogueDiagnostics } = await load('dialogue-diagnostics');
const rubric = JSON.parse(readFileSync(join(root, 'content/chapters/grain/chapter-two.films-rubric.json')));
const story = JSON.parse(readFileSync(join(root, 'content/chapters/grain/chapter-two.films.json')));
const originalFetch = globalThis.fetch;
after(() => {
    globalThis.fetch = originalFetch;
    const expectedParent = resolve(tmpdir());
    assert.equal(dirname(resolve(output)), expectedParent);
    assert.ok(relative(expectedParent, output).startsWith('wuzhang-grain-dialogue-'));
    rmSync(output, { recursive: true, force: true });
});
const input = '六月初二才在永安领粮。五月那一场酒，不能说明这批粮是你耽误的。';
function score(values = [0, 2, 0], words = input) {
    return { valid: true, scores: Object.fromEntries(['trust', 'rigor', 'responsibility'].map((key, i) => [key, { delta: values[i], quote: values[i] ? words : '', reason: values[i] ? '当前原话支持' : '未体现' }])) };
}
const intentCandidate = { kind: 'intent-bank', intents: [{ id: 'date_gap', quote: input }] };
const basicEvidence = [{ id: 'LY-X04' }, { id: 'LY-X06' }, { id: 'LY-C02' }];
const candidate = { kind: 'dynamic', text: composeIntentResponse(intentCandidate, 'O1'), playerQuotes: [input] };
function auditFor(result = score(), activeRubric = rubricForRound(rubric, 'O1'), words = input, selectedIntents = intentCandidate) {
    return { scoreEvidence: Object.fromEntries(Object.entries(result.scores).map(([key, value]) => {
        const text = activeRubric.dimensions[key].levels[String(value.delta)];
        return [key, { currentLevel: value.delta, rubricText: text, supported: true,
            conditionEvidence: [{ condition: text, playerQuote: words, explanation: '开发协议样例；真实语义由独立审核判断。' }] }];
    })), intentEvidence: selectedIntents.intents.map(choice => ({ ...choice, supported: true, explanation: '开发协议样例；真实语义由独立审核判断。' })),
    checks: { scoresSupported: true, grounded: true, faithful: true, responsive: true, continuity: true, templateFit: true }, reason: '' };
}
const audit = auditFor();
function mockQueue(values, inspect = () => {}) {
    const calls = [];
    globalThis.fetch = async (_url, options) => {
        const request = JSON.parse(options.body); calls.push(request); inspect(request, calls.length, options.signal);
        assert.ok(values.length, 'unexpected live request');
        const next = values.shift();
        if (next instanceof Error) throw next;
        return new Response(JSON.stringify({ text: typeof next === 'string' ? next : JSON.stringify(next), responseId: `mock-${calls.length}` }), { status: 200 });
    };
    return calls;
}
function reach(s, id) {
    for (let i = 0; i < 160 && s.current.id !== id; i++) {
        if (s.current.kind === 'open') s.submit(fixedJudgment(s.current.round ?? 'O1', 0, s.currentRubric).judgment);
        assert.equal(s.advance(s.current.options?.[0]?.id), true, s.current.id);
    }
    assert.equal(s.current.id, id);
}

test('protocol failures identify exact fields while all-zero related expressions stay valid', () => {
    assert.deepEqual(Object.values(parseJudgment(JSON.stringify(score([0, 0, 0])), input, rubric).scores).map(s => s.delta), [0, 0, 0]);
    const cases = [
        ['dimension-required', 'scores.trust', s => delete s.scores.trust],
        ['integer-required', 'scores.rigor.delta', s => s.scores.rigor.delta = '2'],
        ['out-of-range', 'scores.rigor.delta', s => s.scores.rigor.delta = 3],
        ['quote-not-in-input', 'scores.rigor.quote', s => s.scores.rigor.quote = '玩家没有这样说'],
        ['quote-required', 'scores.rigor.quote', s => s.scores.rigor.quote = ''],
        ['reason-required', 'scores.trust.reason', s => s.scores.trust.reason = ''],
    ];
    for (const [code, field, mutate] of cases) { const value = score(); mutate(value);
        assert.throws(() => parseJudgment(JSON.stringify(value), input, rubric), e => e.kind === 'protocol' && e.code === code && e.field === field && e.message.includes('可以原样重试')); }
    assert.throws(() => parseJudgment('{"valid":false}', input, rubric), e => e.kind === 'expression');
});

test('verified response survives commit/reload; legacy score-only saves and offline speeches remain compatible', () => {
    const s = new GrainSession(story, undefined, rubric, false); reach(s, 'CH2-LY03-018');
    const j = parseJudgment(JSON.stringify({ ...score(), response: { ...candidate, version: responseVersion, verified: true } }), input, s.currentRubric);
    s.submit(j); const restored = new GrainSession(story, structuredClone(s.state), rubric, false);
    assert.equal(restored.state.judgments[s.current.id].reply, candidate.text); assert.deepEqual(restored.scores, s.scores);
    const old = structuredClone(s.state); delete old.judgments[s.current.id].response; old.judgments[s.current.id].reply = '当时已显示的旧回应';
    const legacy = new GrainSession(story, old, rubric, false); assert.equal(legacy.current.id, s.current.id); assert.deepEqual(legacy.scores, s.scores); assert.equal(legacy.state.judgments[s.current.id].reply, '当时已显示的旧回应');
    for (const round of ['O1', 'O2']) for (let i = 0; i < 5; i++) { const fixed = fixedJudgment(round, i, rubricForRound(rubric, round)); assert.ok(fixed.judgment.reply); assert.equal(fixed.judgment.response.verified, true); }
});

test('resubmission context excludes old current-round scores and preserves selectedAt compatibility', () => {
    const s = new GrainSession(story, undefined, rubric, false); reach(s, 'CH2-O2-INPUT');
    const base = structuredClone(s.dialogueResponseContext);
    s.submit(fixedJudgment('O2', 0, s.currentRubric).judgment); assert.deepEqual(s.dialogueResponseContext, base);
    s.submit(fixedJudgment('O2', 4, s.currentRubric).judgment); assert.deepEqual(s.dialogueResponseContext, base);
    s.state.selectedAt = 'CH2-LY03-018'; assert.equal(new GrainSession(story, structuredClone(s.state), rubric, false).state.selectedAt, 'CH2-LY03-018');
    const invalid = structuredClone(s.state); invalid.selectedAt = 'V01'; assert.equal(new GrainSession(story, invalid, rubric, false).state.selectedAt, undefined);
    delete invalid.selectedAt; assert.equal(new GrainSession(story, invalid, rubric, false).state.selectedAt, undefined);
});

test('diagnostics retain scoring and audit responses, rubric snapshot, cancellation times and bounded redaction', () => {
    const id = beginDialogueDiagnostic({ input, rubricVersion: rubric.version, rubric, evidence: [{ id: 'LY-X06', text: '六月初二' }], selected: ['LY-X06'] });
    recordDialogueDiagnostic(id, 'model-returned', { raw: '{"scores":{}}', responseId: null });
    recordDialogueDiagnostic(id, 'response-audit-returned', { auditRaw: '{"checks":{}}', auditResponseId: 'mock-audit' });
    recordDialogueDiagnostic(id, 'cancelled', { snapshot: { apiKey: 'never-log-me' } });
    const records = JSON.parse(exportDialogueDiagnostics()), entry = records.find(r => r.id === id);
    assert.equal(entry.raw, '{"scores":{}}'); assert.equal(entry.auditRaw, '{"checks":{}}'); assert.equal(entry.responseId, null); assert.equal(entry.auditResponseId, 'mock-audit');
    assert.deepEqual(JSON.parse(entry.rubricJson), rubric); assert.ok(entry.events.every(e => e.elapsedMs >= 0)); assert.ok(!exportDialogueDiagnostics().includes('never-log-me'));
    for (let i = 0; i < 40; i++) beginDialogueDiagnostic({ input: 'record-' + i, rubricVersion: 'test' });
    assert.ok(JSON.parse(exportDialogueDiagnostics()).length <= 24);
    assert.ok(new TextEncoder().encode(exportDialogueDiagnostics()).length < 300000);
});

test('diagnostic timing uses the same monotonic clock even when wall time moves backward', () => {
    const id = beginDialogueDiagnostic({ input, rubricVersion: rubric.version });
    const originalNow = Date.now, initial = originalNow();
    try { Date.now = () => initial - 10000; recordDialogueDiagnostic(id, 'reply-visible'); }
    finally { Date.now = originalNow; }
    const record = JSON.parse(exportDialogueDiagnostics()).find(r => r.id === id), last = record.events.at(-1);
    assert.equal(last.clockSession, record.startedClockSession); assert.ok(last.monotonicElapsedMs >= 0);
    assert.equal(last.monotonicElapsedMs, last.monotonicMs - record.startedMonotonicMs);
    assert.ok(last.wallElapsedMs < 0); assert.equal(last.elapsedMs, 0);
});
