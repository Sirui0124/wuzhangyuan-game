import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, relative, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { makeFinalAssessmentFixture } from './helpers/chapter-two-final-assessment-fixture.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = mkdtempSync(join(tmpdir(), 'wuzhang-final-assessment-')), compiled = new Set();
function compile(path) {
    path = resolve(path); assert.ok(path.startsWith(root + sep));
    const destination = join(output, relative(root, path).replace(/\.ts$/, '.mjs'));
    if (compiled.has(path)) return destination;
    compiled.add(path);
    let text = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
    text = text.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_, a, specifier, b) => {
        compile(resolve(dirname(path), specifier.replace(/\.js$/, '') + '.ts')); return `${a}${specifier.replace(/\.js$/, '')}.mjs${b}`;
    });
    mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, text); return destination;
}
const load = async name => import(pathToFileURL(compile(join(root, 'GameStarter/web-demo/src/chapters/chapter-two', name + '.ts'))).href);
const { judgeOpenDialogue, rubricForRound } = await load('open-dialogue');
const { necessaryConditionsFor, playerQuoteSources, quoteFromSources } = await load('dialogue-conditions');
const { GrainSession } = await load('session');
const { exportDialogueDiagnostics } = await load('dialogue-diagnostics');
const rubric = JSON.parse(readFileSync(join(root, 'content/chapters/grain/chapter-two.films-rubric.json')));
const story = JSON.parse(readFileSync(join(root, 'content/chapters/grain/chapter-two.films.json')));
const savedFetch = globalThis.fetch;
after(() => { globalThis.fetch = savedFetch; assert.equal(dirname(resolve(output)), resolve(tmpdir())); rmSync(output, { recursive: true, force: true }); });
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/chapter-two-audit-quote-failures.json', import.meta.url)));
const c049 = fixtures.find(x => x.id === 'C049');
const c005 = '你说喝酒是在五月，领粮凭据却写着六月初二；李丰的信还叫你别再牵及他父亲。你先留下，把凭据和信交给丞相，请他重查迟粮到底是谁的安排。至少这条路比一走了之更能洗清你的罪名。';
const initial = input => ({ valid: true, scores: { trust: { delta: 2, quote: '错误……拼接', reason: 'PROVISIONAL_REASON_MUST_NOT_LEAK' }, rigor: { delta: 2, quote: input, reason: '候选' }, responsibility: { delta: 1, quote: input, reason: '候选' } }, responseCandidate: { kind: 'intent-bank', intents: [{ id: 'date_gap', quote: input }, { id: 'check_commitment', quote: input }] } });
function mock(generation, options = {}, mutate = () => {}, inspect = () => {}) {
    let calls = 0; const requests = [];
    globalThis.fetch = async (_url, fetchOptions) => {
        const body = JSON.parse(fetchOptions.body), payload = JSON.parse(body.text.slice(body.text.lastIndexOf('\n') + 1));
        requests.push(payload); inspect(body, payload, calls);
        let value;
        if (calls++ === 0) value = generation;
        else { assert.equal(calls, 2, 'No hidden retries'); value = makeFinalAssessmentFixture(payload, options); mutate(value, payload); }
        return new Response(JSON.stringify({ text: JSON.stringify(value), responseId: 'mock-final-' + calls }), { status: 200 });
    };
    return requests;
}
function openSession() {
    const s = new GrainSession(story, undefined, rubric, false);
    for (let i = 0; i < 80 && s.current.kind !== 'open'; i++) assert.ok(s.advance(s.current.options?.[0]?.id));
    assert.equal(s.current.kind, 'open'); return s;
}
test('independent final scoring omits provisional scores/reasons/history, while fact checking retains actual evidence', async () => {
    const r = rubricForRound(rubric, 'O2'), before = 'PREVIOUS_RESCUE_ACKNOWLEDGMENT';
    const requests = mock(initial(c049.input), { deltas: [1, 2, 2], intentIds: ['accompany_report'], met: { 'O2.trust.2.rescue': false } }, undefined,
        (body, payload, index) => { if (index === 1) {
            for (const key of ['scores', 'scoreRequirements', 'said', 'evidence', 'responseText', 'cooperation']) assert.equal(payload[key], undefined);
            assert.ok(!body.text.includes('PROVISIONAL_REASON_MUST_NOT_LEAK')); assert.ok(!body.text.includes(before));
            assert.deepEqual(payload.factCheckOnly, c049.evidence); assert.deepEqual(payload.rubric.dimensions, r.dimensions); assert.deepEqual(payload.rubric.rules, r.rules);
            assert.equal(payload.rubric.rounds, undefined); assert.equal(payload.rubric.examples, undefined);
        } });
    const j = await judgeOpenDialogue(c049.input, r, c049.evidence, new AbortController().signal, [], [before]);
    assert.equal(j.scores.trust.delta, 1); assert.equal(requests.length, 2);
    const d = JSON.parse(exportDialogueDiagnostics()).find(d => d.id === j.diagnosticId);
    assert.ok(d.raw.includes('PROVISIONAL_REASON_MUST_NOT_LEAK')); assert.equal(d.responseId, 'mock-final-1'); assert.equal(d.auditResponseId, 'mock-final-2');
    assert.equal(d.events.filter(e => e.event === 'candidate-adjusted').length, 1);
    assert.equal(d.events.filter(e => e.event === 'quote-repair-requested').length, 0);
});
test('missing current rescue condition contradicts +2, but a coherent independent lower grade succeeds without rescoring loops', async () => {
    const r = rubricForRound(rubric, 'O2'), options = { deltas: [2, 2, 2], intentIds: ['accompany_report'], met: { 'O2.trust.2.rescue': false } };
    let calls = mock(initial(c049.input), options);
    await assert.rejects(judgeOpenDialogue(c049.input, r, c049.evidence, new AbortController().signal), e => e.code === 'final-score-condition-contradiction');
    assert.equal(calls.length, 2);
    calls = mock(initial(c049.input), { ...options, deltas: [1, 2, 2] });
    assert.equal((await judgeOpenDialogue(c049.input, r, c049.evidence, new AbortController().signal)).scores.trust.delta, 1);
    assert.equal(calls.length, 2);
});
test('C005 wrong candidate actor is discarded; valid date theme and zero own responsibility proceed and survive replay', async () => {
    const s = openSession(); s.state.draft = c005; const before = structuredClone(s.state);
    mock(initial(c005), { deltas: [1, 2, 0], intentIds: ['date_gap'], met: {
        'O1.responsibility.1.own_action': false, 'O1.responsibility.2.check_report': false, 'O1.responsibility.2.check_no_concealment': false,
        'O1.trust.2.checking': false, 'O1.trust.2.truthful_return': false,
    } });
    const j = await judgeOpenDialogue(c005, s.currentRubric, s.clues, new AbortController().signal);
    assert.equal(j.scores.responsibility.delta, 0); assert.ok(!j.reply.includes('你肯去查')); assert.ok(j.reply.includes('五月喝酒'));
    assert.deepEqual(s.state, before); assert.ok(s.submit(j)); const totals = structuredClone(s.scores);
    assert.ok(s.submit(j)); assert.deepEqual(s.scores, totals);
    const restored = new GrainSession(story, structuredClone(s.state), rubric, false);
    assert.deepEqual(restored.scores, totals); assert.deepEqual(restored.state.judgments[s.current.id].scores, j.scores); assert.ok(restored.advance());
});
test('positive responsibility cannot be backed only by someone else acting', async () => {
    const r = rubricForRound(rubric, 'O1');
    mock(initial(c005), { deltas: [1, 2, 1], intentIds: ['date_gap'], met: { 'O1.responsibility.1.own_action': false } });
    await assert.rejects(judgeOpenDialogue(c005, r, [{ id: 'LY-X04' }, { id: 'LY-X06' }], new AbortController().signal), e => e.code === 'final-score-condition-contradiction' && e.field.endsWith('responsibility.delta'));
});
test('semantic same-meaning evidence is accepted by references without a required Chinese keyword', async () => {
    const words = '若不是那日你伸手，我哪能活着坐在这里。可你也一直蒙着我。我知道你正怕丢了差事，我和你一道去把事情讲明。';
    mock(initial(words), { deltas: [2, 0, 1], intentIds: ['accompany_report'] });
    const j = await judgeOpenDialogue(words, rubricForRound(rubric, 'O2'), [], new AbortController().signal);
    assert.equal(j.scores.trust.delta, 2); assert.ok(words.includes(j.scores.trust.quote));
});
test('relevant all-zero speech remains valid and can advance', async () => {
    const words = '明天能知道结果吗？', s = openSession();
    mock(initial(words), { deltas: [0, 0, 0], intentIds: ['unresolved_question'] });
    const j = await judgeOpenDialogue(words, s.currentRubric, s.clues, new AbortController().signal);
    assert.ok(Object.values(j.scores).every(s => s.delta === 0)); assert.ok(s.submit(j)); assert.ok(s.advance());
});
test('unknown revision or changed mapped condition fails before any model request', async () => {
    let calls = 0; globalThis.fetch = async () => { calls++; throw Error('must not call'); };
    const unknown = rubricForRound(rubric, 'O2'); unknown.version = 'unreviewed-revision';
    await assert.rejects(judgeOpenDialogue(c049.input, unknown, [], new AbortController().signal), e => e.code === 'condition-rubric-version-unknown');
    const changed = structuredClone(rubricForRound(rubric, 'O2')); changed.dimensions.trust.levels['2'] += '新条件';
    await assert.rejects(judgeOpenDialogue(c049.input, changed, [], new AbortController().signal), e => e.code === 'condition-rubric-text-changed'); assert.equal(calls, 0);
});
test('retained open1 playtest has an explicit legacy mapping that preserves its extra verification condition', async () => {
    const old = JSON.parse(readFileSync(join(root, 'content/chapters/grain/chapter-two.rubric.json'))), plan = necessaryConditionsFor(old);
    assert.equal(plan.variant, 'legacy-open1'); assert.ok(plan.items.some(item => item.id === 'O1.rigor.2.verification'));
    assert.ok(!necessaryConditionsFor(rubricForRound(rubric, 'O1')).items.some(item => item.id === 'O1.rigor.2.verification'));
    mock(initial(c005), { deltas: [1, 1, 0], intentIds: ['date_gap'] });
    const j = await judgeOpenDialogue(c005, old, [{ id: 'LY-X04' }, { id: 'LY-X06' }], new AbortController().signal);
    assert.equal(j.scores.rigor.delta, 1);
});
test('condition schema and source IDs reject omissions, unknown IDs and contradictions without mutation or hidden requests', async () => {
    const s = openSession(); s.state.draft = c005; const before = structuredClone(s.state);
    const cases = [
        ['condition-assessments-incomplete', a => delete a.conditions[Object.keys(a.conditions)[0]]],
        ['condition-assessment-invalid', a => { const id = Object.keys(a.conditions)[0]; a.conditions.unknown = a.conditions[id]; delete a.conditions[id]; }],
        ['assessment-source-reference-invalid', a => a.scores.trust.sourceRefs = ['previous-round']],
        ['final-assessment-version-required', a => delete a.schemaVersion],
        ['intent-audit-unsupported', a => a.intentEvidence[0].supported = false],
        ['response-audit-rejected', a => a.checks.faithful = false],
    ];
    for (const [code, mutate] of cases) { const calls = mock(initial(c005), {}, mutate);
        await assert.rejects(judgeOpenDialogue(c005, s.currentRubric, s.clues, new AbortController().signal), e => e.code === code);
        assert.equal(calls.length, 2); assert.deepEqual(s.state, before); }
    mock(initial(c005)); const recovered = await judgeOpenDialogue(c005, s.currentRubric, s.clues, new AbortController().signal); assert.ok(s.submit(recovered));
});
test('source ranges cover omitted middle sentences rather than joining discontinuous fragments', () => {
    const words = '第一句。中间句。第三句。', sources = playerQuoteSources(words);
    assert.equal(quoteFromSources(['p1', 'p3'], words, sources, 'test'), words);
    assert.throws(() => quoteFromSources(['p99'], words, sources, 'test'), e => e.code === 'assessment-source-reference-invalid');
    for (const round of ['O1', 'O2']) { const r = rubricForRound(rubric, round), plan = necessaryConditionsFor(r);
        for (const item of plan.items) assert.ok(r.dimensions[item.dimension].levels[item.level].includes(item.sourceClause)); }
    assert.equal(necessaryConditionsFor(rubricForRound(rubric, 'O1')).levels.responsibility['2'].alternatives.length, 2);
});
test('cancelled or late final result cannot commit or return a judgment', async () => {
    const controller = new AbortController(), s = openSession(); s.state.draft = c005; const before = structuredClone(s.state); let calls = 0;
    globalThis.fetch = async (_url, options) => {
        const payload = JSON.parse(JSON.parse(options.body).text.split('\n').at(-1));
        if (++calls === 1) return new Response(JSON.stringify({ text: JSON.stringify(initial(c005)) }));
        controller.abort(); // Simulate a non-cooperating transport returning after cancellation.
        return new Response(JSON.stringify({ text: JSON.stringify(makeFinalAssessmentFixture(payload)) }));
    };
    await assert.rejects(judgeOpenDialogue(c005, s.currentRubric, s.clues, controller.signal), e => e.name === 'AbortError');
    assert.equal(calls, 2); assert.deepEqual(s.state, before);
});
