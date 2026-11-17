// Explicit real-model regression, using the currently served game build and no player storage.
// Run from the workspace root: node tools/ai/weiyan-semantic-check.mjs --live
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { dialogueFixtures } from './dialogue-fixtures.mjs';

if (!process.argv.includes('--live')) throw Error('Pass --live to call the configured local game model');
const selectedIds = [];
let outputPath = 'outputs/weiyan-false-rejection-20261025/after.json';
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--live') continue;
    if (arg === '--case' || arg === '--output') {
        const value = process.argv[++i];
        if (!value || value.startsWith('--')) throw Error('Missing value for ' + arg);
        if (arg === '--case') selectedIds.push(value); else outputPath = value;
    } else if (arg.startsWith('--case=')) selectedIds.push(arg.slice('--case='.length));
    else if (arg.startsWith('--output=')) outputPath = arg.slice('--output='.length);
    else throw Error('Unknown argument: ' + arg);
}
const output = resolve(outputPath);
const origin = 'http://127.0.0.1:8812';
const status = await (await fetch(origin + '/__local/status')).json();
const health = await (await fetch('http://127.0.0.1:8787/health')).json();
assert.equal(status.phase, 'ready', 'Wait for the requested build to finish before checking it');
assert.ok(health.configured, 'A configured local game proxy is required');
assert.equal(health.thinking, 'disabled');
assert.match(status.current.id, /^[a-f0-9-]{36}$/);
const buildRoot = resolve('.cache/local-game/builds', status.current.id);
const load = name => import(pathToFileURL(resolve(buildRoot, name)));
const { expressionAgents } = await load('GameStarter/web-demo/src/expression-agent.js');
const { parseWeiyanAssessment, decideWeiyan } = await load('GameStarter/web-demo/src/weiyan-judgment.js');
const { compactWeiyanFacts } = await load('GameStarter/web-demo/src/weiyan-facts.js');
const { weiyanConfig } = await load('GameStarter/web-demo/src/weiyan-prompt-config.js');
const { GameApi } = await load('GameStarter/assets/scripts/GameApi.js');
const fixtures = await dialogueFixtures(buildRoot), session = await fixtures.authorized(), api = new GameApi();
assert.equal(session.snapshot().round, 2);
assert.equal(session.snapshot().story.flags.JIANG_AUTH_GRANTED, true);
assert.equal(session.snapshot().story.flags.COMPANION_PRESENT, true);

const original = '将军，今夜敌军随我军调动改变方向，与前几夜不同，恐怕是在试探我军反应。丞相已让姜维代为处置军报，姜维亲口答应在帐外接报、判断是否禀报丞相并担责，此刻就在帐外等候。今夜不得入帐，还请将军在帐外与姜维接报。';
const consent = '姜维亲口答应在帐外接报、判断并担责。';
const change = '与往夜不同，今夜敌军随着我们调兵换向，可能在试探我军反应。';
const handoff = '今夜不得入丞相帐，请将军现在随我到帐外，向姜维当面交报。';
const classicChange = '敌军前几夜闻号即退，今夜不退，还随我军调动换向，可能在试探虚实。';
const allCases = [
    { id: 'reported-original-1', current: original, expected: 'accept' },
    { id: 'reported-original-2', current: original, expected: 'accept' },
    { id: 'concrete-change-without-horn', current: consent + change + handoff, expected: 'accept' },
    { id: 'vague-change-without-any-detail', current: consent + '今夜与往日不同，可能在试探我军反应。' + handoff,
        expected: 'clarify', requireChecks: ['authorization', 'inference', 'handoff'], expectUnsupported: false },
    { id: 'missing-spoken-consent', current: '丞相让姜维代为处置军报。' + change + handoff,
        expected: 'clarify', expectedReason: 'authorization', requireChecksExcept: ['authorization'], expectUnsupported: false },
    { id: 'unearned-c08-cannot-be-claimed', current: consent + classicChange + handoff, withoutConsent: true,
        expected: 'clarify', note: 'Negative adapter boundary: remove C08 from acquired evidence; this does not bypass the real session entry gate.' },
    { id: 'invented-enemy-retreat', current: consent + classicChange + '敌军现在已经全部退走了。' + handoff,
        expected: 'clarify', expectedReason: 'unsupported', requireChecks: ['authorization', 'handoff'], expectUnsupported: true },
    { id: 'guaranteed-retreat', current: consent + classicChange + '我保证敌军今夜必定退走。' + handoff,
        expected: 'clarify', expectedReason: 'unsupported', requireChecksExcept: [], expectUnsupported: true },
    { id: 'same-round-concrete-change-retained', said: [change], current: consent + handoff, expected: 'accept' },
    { id: 'classic-horn-comparison', current: consent + classicChange + handoff, expected: 'accept' },
];
for (const id of selectedIds) assert.ok(allCases.some(test => test.id === id), 'Unknown case: ' + id);
const cases = selectedIds.length ? allCases.filter(test => selectedIds.includes(test.id)) : allCases;

const moduleChecks = [];
for (const name of ['weiyan-judgment', 'weiyan-facts', 'weiyan-prompt-config', 'weiyan-reply-audit']) {
    const path = `GameStarter/web-demo/src/${name}.js`;
    const compiled = readFileSync(resolve(buildRoot, path), 'utf8');
    const response = await fetch(origin + '/' + path), served = await response.text();
    assert.equal(response.status, 200);
    assert.equal(served, compiled, 'Served build changed during setup: ' + path);
    moduleChecks.push({ path, sha256: createHash('sha256').update(compiled).digest('hex'), servedMatches: true });
}
const report = {
    kind: 'real-model-semantic-regression', startedAt: new Date().toISOString(), status,
    health: { model: health.model, thinking: health.thinking, configured: health.configured },
    buildRoot, contentVersion: fixtures.version, moduleChecks, checks: weiyanConfig.stages.authorized.checks,
    maxConcurrency: 1, selectedCases: cases.map(test => test.id), total: cases.length, completed: 0, passed: 0, cases: [],
};
mkdirSync(dirname(output), { recursive: true });
const save = () => writeFileSync(output, JSON.stringify(report, null, 2));
const decode = text => JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
save();

for (const test of cases) {
    const input = session.expressionContext(test.current);
    input.said = test.said ?? [];
    if (test.withoutConsent) input.evidence = input.evidence.filter(evidence => evidence.id !== 'C08');
    const facts = compactWeiyanFacts(input.evidence);
    assert.equal(facts.status.jiangConsent.state, test.withoutConsent ? '未取得' : '已确认');
    assert.equal(input.items?.length ?? 0, 0, 'These cases isolate ordinary speech from item outcomes');
    const record = { ...test, input, facts, startedAt: new Date().toISOString(), calls: [], errors: [] };
    report.cases.push(record);
    const started = Date.now();
    const agents = expressionAgents({ respond: async (request, ...args) => {
        const call = { request, startedAt: new Date().toISOString() };
        record.calls.push(call); save();
        try {
            const response = await api.respond(request, ...args);
            Object.assign(call, { response, ms: Date.now() - Date.parse(call.startedAt) }); save();
            return response;
        } catch (error) { call.error = error.message; save(); throw error; }
    } });
    try {
        record.turn = await agents.judge(input, new AbortController().signal);
        record.rawAssessment = decode(record.calls[0].response.text);
        record.assessment = parseWeiyanAssessment(record.rawAssessment, input);
        record.decision = decideWeiyan(input.stage, record.assessment);
        if (record.decision.result !== test.expected) record.errors.push('result');
        if (test.expectedReason && record.decision.reason !== test.expectedReason) record.errors.push('reason');
        if (test.expectUnsupported !== undefined && Boolean(record.assessment.unsupported) !== test.expectUnsupported) record.errors.push('unsupported');
        const requireChecks = test.requireChecksExcept
            ? Object.keys(record.assessment.checks).filter(id => !test.requireChecksExcept.includes(id)) : test.requireChecks ?? [];
        for (const id of requireChecks) if (!record.assessment.checks[id]) record.errors.push('unrelated-missing-check:' + id);
        if (record.decision.result === 'accept' && record.turn.reply.text !== weiyanConfig.stages.authorized.fixedAcceptReply) record.errors.push('fixed-accept-reply');
        if (record.calls[0].request.temperature !== 0) record.errors.push('classifier-temperature');
    } catch (error) { record.error = error.message; record.errors.push('technical-failure'); }
    record.passed = record.errors.length === 0;
    record.ms = Date.now() - started;
    report.completed++; if (record.passed) report.passed++;
    report.updatedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ id: test.id, passed: record.passed, decision: record.decision,
        unsupported: record.assessment?.unsupported, errors: record.errors, error: record.error, ms: record.ms }));
}
report.finishedAt = new Date().toISOString(); save();
console.log(JSON.stringify({ passed: report.passed, total: report.total, report: output }));
if (report.passed !== report.total) process.exitCode = 1;
