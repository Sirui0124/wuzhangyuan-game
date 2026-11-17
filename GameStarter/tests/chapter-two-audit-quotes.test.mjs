import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, relative, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = mkdtempSync(join(tmpdir(), 'wuzhang-audit-quotes-')), compiled = new Set();
function compile(path) {
    path = resolve(path); assert.ok(path.startsWith(root + sep));
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
const load = async name => import(pathToFileURL(compile(join(root, 'GameStarter/web-demo/src/chapters/chapter-two', name + '.ts'))).href);
const { resolveAuditQuoteReferences } = await load('dialogue-audit-quotes');
const { parseJudgment } = await load('open-dialogue');
const { verifyDialogueResponse } = await load('dialogue-response');
const { parseIntentCandidate } = await load('dialogue-intents');
const { beginDialogueDiagnostic } = await load('dialogue-diagnostics');
// Historical audit-format compatibility only; active online flow is tested separately.
async function judgeOpenDialogue(input,rubric,evidence,signal){const response=await fetch('mock',{body:JSON.stringify({})});const raw=JSON.parse((await response.json()).text);const judgment=parseJudgment(JSON.stringify(raw),input,rubric);const candidate=parseIntentCandidate(raw.responseCandidate,judgment,rubric.scene,evidence);const id=beginDialogueDiagnostic({input,rubricVersion:rubric.version});const result=await verifyDialogueResponse(candidate,judgment,rubric,evidence,[],signal,id);return {...judgment,response:result,diagnosticId:id};}
const { exportDialogueDiagnostics } = await load('dialogue-diagnostics');
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; assert.equal(dirname(resolve(output)), resolve(tmpdir())); rmSync(output, { recursive: true, force: true }); });
// Derived, immutable fixtures copied from the preserved v3 observer failures; no test reads player saves.
const cases = JSON.parse(readFileSync(new URL('./fixtures/chapter-two-audit-quote-failures.json', import.meta.url))).map(r => ({ id: r.id,
    record: { input: r.input, raw: r.generationRaw, auditRaw: r.auditRaw, rubricJson: JSON.stringify(r.rubric), evidenceJson: JSON.stringify(r.evidence) } }));
function references(audit) {
    const value = structuredClone(audit);
    for (const item of Object.values(value.scoreEvidence)) for (const proof of item.conditionEvidence) {
        delete proof.playerQuote; proof.playerQuoteRef = 'player-words';
    }
    return value;
}
function queue(generation, audit, inspect = () => {}) {
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
        assert.ok(calls < 2, 'no audit retry or extra model request');
        inspect(JSON.parse(options.body), calls);
        return new Response(JSON.stringify({ text: calls++ === 0 ? generation : JSON.stringify(audit), responseId: `mock-${calls}` }), { status: 200 });
    };
    return () => calls;
}
for (const { id, record } of cases) {
    test(`${id}: code references expand to unchanged complete input; judgments and explanations remain byte-for-byte equal`, () => {
        const audit = references(JSON.parse(record.auditRaw)), before = structuredClone(audit);
        const result = resolveAuditQuoteReferences(audit, record.input);
        assert.deepEqual(audit, before); assert.equal(result.resolvedFields.length, 3);
        for (const [key, item] of Object.entries(result.audit.scoreEvidence)) {
            assert.equal(item.conditionEvidence[0].playerQuote, record.input);
            delete item.conditionEvidence[0].playerQuote;
            assert.deepEqual(item, before.scoreEvidence[key]);
        }
        assert.deepEqual(result.audit, before);
    });
    test(`${id}: real failure raw still fails as a legacy quote; reference fixture keeps scoring and completes in two calls`, async () => {
        const old = JSON.parse(record.auditRaw), rubric = JSON.parse(record.rubricJson), evidence = JSON.parse(record.evidenceJson);
        const calls1 = queue(record.raw, old);
        await assert.rejects(judgeOpenDialogue(record.input, rubric, evidence, new AbortController().signal), e => e.code === 'score-audit-quote-invalid');
        assert.equal(calls1(), 2);
        const next = references(old), calls2 = queue(record.raw, next, (request, index) => {
            if (index === 1) {
                assert.ok(request.text.includes('每一项都须在本次playerWords中有语义表达'));
                assert.ok(request.text.includes('资料中知道他救过我、前轮表达过感恩、本轮没有否认恩情'));
                const payload = JSON.parse(request.text.slice(request.text.lastIndexOf('\n') + 1));
                assert.equal(payload.quoteSources['player-words'], record.input);
                assert.deepEqual(payload.scoreRequirements.trust, { currentLevel: old.scoreEvidence.trust.currentLevel, rubricText: old.scoreEvidence.trust.rubricText });
            }
        });
        const judgment = await judgeOpenDialogue(record.input, rubric, evidence, new AbortController().signal);
        assert.deepEqual(judgment.scores, JSON.parse(record.raw).scores); assert.equal(calls2(), 2);
        const diagnostic = JSON.parse(exportDialogueDiagnostics()).find(r => r.id === judgment.diagnosticId);
        assert.equal(diagnostic.auditRaw, JSON.stringify(next));
        assert.equal(diagnostic.events.filter(e => e.event === 'audit-quote-references-resolved').length, 1);
        assert.equal(diagnostic.events.filter(e => e.event === 'quote-repair-requested').length, 0);
    });
}
test('unknown or conflicting references are rejected; legal legacy continuous quotes stay unchanged', () => {
    const r = cases[0].record, audit = references(JSON.parse(r.auditRaw));
    audit.scoreEvidence.trust.conditionEvidence[0].playerQuoteRef = 'previous-round';
    assert.throws(() => resolveAuditQuoteReferences(audit, r.input), e => e.code === 'score-audit-quote-reference-invalid');
    audit.scoreEvidence.trust.conditionEvidence[0].playerQuoteRef = 'player-words';
    audit.scoreEvidence.trust.conditionEvidence[0].playerQuote = '伪摘要';
    assert.throws(() => resolveAuditQuoteReferences(audit, r.input), e => e.code === 'score-audit-quote-reference-conflict');
    const legal = JSON.parse(r.auditRaw);
    for (const item of Object.values(legal.scoreEvidence)) item.conditionEvidence[0].playerQuote = r.input;
    assert.deepEqual(resolveAuditQuoteReferences(legal, r.input), { audit: legal, resolvedFields: [] });
});
test('reference expansion never turns unsupported conditions or false audit checks into acceptance', async () => {
    const r = cases[1].record, rubric = JSON.parse(r.rubricJson), evidence = JSON.parse(r.evidenceJson);
    for (const failure of ['supported', 'check']) {
        const audit = references(JSON.parse(r.auditRaw));
        if (failure === 'supported') {
            audit.scoreEvidence.trust.supported = false;
            audit.scoreEvidence.trust.conditionEvidence[0].explanation = '当前原话没有承认救命与欺瞒并存；开发拒收样例。';
        } else audit.checks.scoresSupported = false;
        const before = structuredClone(audit), calls = queue(r.raw, audit);
        await assert.rejects(judgeOpenDialogue(r.input, rubric, evidence, new AbortController().signal), e => e.code === (failure === 'supported' ? 'score-audit-unsupported' : 'response-audit-rejected'));
        assert.deepEqual(audit, before); assert.equal(calls(), 2);
    }
});
