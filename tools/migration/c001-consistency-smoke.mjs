import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { dialogueFixtures } from '../ai/dialogue-fixtures.mjs';

// Independent regression contexts. Never connects to the concurrent player servers.
const build = resolve(process.argv[2] ?? 'GameStarter/web-demo/.build');
const label = process.argv[3] ?? 'after';
const output = resolve(process.env.C001_OUTPUT ?? 'outputs/bugfix-c001-20261026', label);
mkdirSync(output, { recursive: true });
const f = await dialogueFixtures(build);
const setupJudge = async input => ({ schemaVersion: 1, npcId: 'weiyan', stage: input.stage,
    classification: { code: 'ok', disposition: 'accept', reason: '回归准备', evidenceIds: [] },
    reply: { speaker: '魏延', text: '即刻转呈。' } });
const first = f.first(setupJudge);
first.setDraft('将军，帐内有禁令，我立刻替您转呈军报。');
assert.ok(await first.confirmExpression()); assert.ok(first.acknowledgeReply()); f.read(first);
const firstSave = first.serialize();
f.act(first, 'deliver-first'); f.act(first, 'stand-watch'); first.finishCinematic(); f.read(first);
assert.ok(first.rewind()); f.read(first);
const secondSave = first.serialize();
const tent = new f.ChapterSession(f.content, f.flow, f.version);
tent.finishCinematic(); f.read(tent); f.act(tent, 'read-notice');
for (const action of ['listen', 'next', 'listen', 'continue', 'continue', 'next', 'retry']) assert.ok(tent.tentAction(action));
assert.equal(tent.snapshot().phase, 'explore');
const authorized = await f.authorized();
assert.ok(authorized.snapshot().supplies.worldItems.acquired.includes('jiang-headscarf'));
writeFileSync(resolve(output, 'fixture-saves.json'), JSON.stringify({ first: firstSave, second: secondSave, items: authorized.serialize() }, null, 2));
const server = createStaticServer({ root: build });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], observations = [];
async function open(saved) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('http://127.0.0.1:8787/**', r => r.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { configured: true } }));
    await context.addInitScript(saved => {
        localStorage.setItem('wuzhang-runtime-mode-v1', 'ai-phone');
        localStorage.setItem('wuzhang-phone-enabled-v1', '1');
        localStorage.setItem('wuzhang-chapter-session-v1', saved);
    }, saved);
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(base); await page.locator('[data-action=continue]').click();
    return { page, context };
}
async function capture(page, name) {
    const observed = await page.evaluate(() => ({
        scene: document.querySelector('.game-scene')?.getAttribute('data-scene'),
        selected: document.querySelector('[data-move][aria-current=location]')?.getAttribute('data-move'),
        background: document.querySelector('.scene-image')?.getAttribute('style'),
        actions: [...document.querySelectorAll('[data-scene-action]')].map(el => el.getAttribute('data-scene-action')),
        tent: !!document.querySelector('[data-tent=listen]'),
        savedScene: JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1'))?.scene,
    }));
    await page.screenshot({ path: resolve(output, name + '.png') });
    observations.push({ name, observedAt: new Date().toISOString(), ...observed });
    return observed;
}
try {
    const media = JSON.parse(readFileSync(resolve(build, 'media/manifest.json')));
    for (const [round, saved, expected, destination] of [[1, firstSave, [], 'jiangwei_tent_front'], [2, secondSave, ['ask-relay'], 'jiangwei_tent_front'], ['tent-retry', tent.serialize(), ['meet-first-scout'], 'report_post']]) {
        const { page, context } = await open(saved);
        await capture(page, `round${round}-before-move`);
        await page.locator(`[data-move=${destination}]`).click();
        for (const frame of ['immediate', 'stable']) {
            if (frame === 'stable') await page.waitForTimeout(1200);
            const shot = await capture(page, `round${round}-${frame}`);
            assert.equal(shot.scene, destination); assert.equal(shot.selected, shot.scene);
            assert.equal(shot.savedScene, shot.scene); assert.equal(shot.tent, false);
            assert.ok(shot.background.includes(media.scenes[destination]));
            assert.deepEqual(shot.actions, expected);
        }
        await page.locator('[data-move=camp_gate]').click();
        const back = await capture(page, `round${round}-return`);
        assert.equal(back.scene, 'camp_gate'); assert.equal(back.selected, 'camp_gate'); assert.equal(back.tent, true);
        await context.close();
    }
    const { page, context } = await open(authorized.serialize());
    await page.locator('[data-action=items]').click();
    const inventory = page.locator('.thought-inventory');
    const text = await inventory.innerText();
    assert.equal(await inventory.locator('[data-attach-item]').count(), 0);
    if (label !== 'before') assert.match(text, /头巾.*仅供收藏或出售.*不能用于本次交涉/);
    else assert.match(text, /暂无可用物品/);
    observations.push({ name: 'headscarf-picker', text });
    await page.screenshot({ path: resolve(output, 'headscarf-picker.png') });
    await (label !== 'before' ? inventory.locator('[data-action=bag]') : page.locator('[data-action=bag]')).click();
    await page.getByRole('heading', { name: '姜维赠予的头巾', exact: true }).waitFor();
    await page.screenshot({ path: resolve(output, 'headscarf-bag.png') });
    await context.close();
    if (label !== 'before') {
        // Purchased supplies remain selectable; a collectible cannot become evidence by this UI change.
        assert.equal(authorized.attachItem('jiang-headscarf'), false);
        assert.ok(authorized.buyItem('batteries'));
        const purchased = await open(authorized.serialize());
        await purchased.page.locator('[data-action=items]').click();
        await purchased.page.locator('[data-attach-item=batteries]').click();
        const selected = await purchased.page.evaluate(() => JSON.parse(localStorage.getItem('wuzhang-chapter-session-v1')).supplies.attached);
        assert.deepEqual(selected, ['batteries']);
        assert.equal(await purchased.page.locator('[data-attach-item=jiang-headscarf]').count(), 0);
        await purchased.page.locator('[data-inventory-search]').fill('头巾');
        await purchased.page.getByText('未找到相关物品', { exact: true }).waitFor();
        await purchased.context.close();
    }
    assert.deepEqual(errors, []);
    writeFileSync(resolve(output, 'report.json'), JSON.stringify({ passed: true, build, base, label, originalC001Images: false, observations, errors }, null, 2));
    console.log(`C001 consistency checks passed (${label})`);
} finally { await browser.close(); await new Promise(ok => server.close(ok)); }
