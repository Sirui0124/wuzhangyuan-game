import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { dialogueFixtures } from './dialogue-fixtures.mjs';

// Explicit live-model diagnostic. Uses isolated saves and captures only this test's requests.
const f = await dialogueFixtures('GameStarter/web-demo/.build');
const out = resolve('outputs/selected-expression-20261025'); mkdirSync(out, { recursive: true });
const server = createStaticServer(); await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`, saveKey = 'wuzhang-chapter-session-v1';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [];
const tests = [
    { name: 'two-clues-intent', selected: ['C06', 'C05'], words: '我来帮你转达' },
    { name: 'one-clue-intent', selected: ['C06'], words: '我来帮你转达' },
    { name: 'words-only', selected: [], words: '我来帮你转达' },
    { name: 'clues-only', selected: ['C06', 'C05'], words: '' },
];
try {
    for (const test of tests.filter(test => !process.env.EXPRESSION_CASE || test.name === process.env.EXPRESSION_CASE)) {
        const session = f.first();
        for (const id of [...session.snapshot().story.selected]) session.selectEvidence(id);
        for (const id of test.selected) session.selectEvidence(id);
        session.setFocus(test.words);
        const state = session.snapshot(); state.lastFeedback = '究竟有何军情，为何还不必闯帐？';
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
        await context.addInitScript(({ state, saveKey }) => {
            if (!localStorage.getItem(saveKey)) localStorage.setItem(saveKey, JSON.stringify(state));
            localStorage.setItem('wuzhang-runtime-mode-v1', 'ai'); localStorage.setItem('wuzhang-reduced-motion', '1');
        }, { state, saveKey });
        const page = await context.newPage(), calls = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
            if (request.url().endsWith('/api/game/respond') && request.method() === 'POST') calls.push({ request: request.postDataJSON() });
        });
        page.on('response', async response => {
            if (response.url().endsWith('/api/game/respond') && response.request().method() === 'POST') {
                const call = calls.find(call => !call.response);
                if (call) call.response = { status: response.status(), body: await response.json() };
            }
        });
        await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('.game-menu [data-action=continue]').click();
        await page.locator('#player-expression').waitFor();
        await page.locator('[data-action=generate-expression]').click();
        await page.waitForFunction(key => ['ready', 'failed'].includes(JSON.parse(localStorage.getItem(key)).composition.status), saveKey, { timeout: 90000 });
        const actual = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
        const data = prompt => JSON.parse(prompt.slice(prompt.lastIndexOf('资料：') + 3));
        const brief = data(calls[0].request.text);
        const result = { ...test, status: actual.composition.status, text: actual.story.draft, evidenceIds: actual.composition.evidenceIds, error: actual.composition.error, brief, calls };
        writeFileSync(resolve(out, test.name + '.json'), JSON.stringify(result, null, 2));
        assert.equal(actual.composition.status, 'ready', JSON.stringify(result));
        assert.deepEqual(brief.selectedEvidence.map(e => e.id), test.selected);
        assert.equal(brief.playerIntent.words, test.words);
        assert.equal(brief.conversation.listenerTurn.text, state.lastFeedback);
        assert.deepEqual([...actual.composition.evidenceIds].sort(), [...test.selected].sort());
        assert.equal(calls.length, 2); assert.ok(calls.every(call => call.response?.status === 200));
        const audit = JSON.parse(calls[1].response.body.text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
        if (test.selected.length) assert.equal(audit.checks.coverage, true);
        if (test.selected.includes('C06')) assert.match(actual.story.draft, /帐|禁令/);
        if (test.selected.includes('C05')) assert.match(actual.story.draft, /发令/);
        else assert.doesNotMatch(actual.story.draft, /魏军|发令|探问/);
        if (test.words) assert.match(actual.story.draft, /转达|转呈|传达/);
        else assert.doesNotMatch(actual.story.draft, /我.{0,5}(转达|转呈|递报|通报)|稍候|等候|明示/);
        assert.doesNotMatch(actual.story.draft, /营门未|没有攻营|尚未攻营|已知病情|姜维|伯约/);
        assert.equal(actual.phase, 'expression'); assert.equal(actual.speech, null);
        await page.screenshot({ path: resolve(out, test.name + '.png') });
        results.push({ name: test.name, text: actual.story.draft, selected: test.selected, evidenceIds: actual.composition.evidenceIds, coverage: audit.checks.coverage });
        await context.close();
    }
    assert.deepEqual(errors, []);
    writeFileSync(resolve(out, process.env.EXPRESSION_CASE ? process.env.EXPRESSION_CASE + '-verification.json' : 'verification.json'), JSON.stringify({ passed: true, realApi: true, results, errors }, null, 2));
    console.log(JSON.stringify({ passed: true, results }));
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
