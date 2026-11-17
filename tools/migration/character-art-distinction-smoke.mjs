import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

const root = resolve('GameStarter/web-demo/.build');
const output = resolve('outputs/character-distinction-20261027');
mkdirSync(output, { recursive: true });
const { JietingSession } = await import(pathToFileURL(resolve(root, 'GameStarter/web-demo/src/chapters/chapter-three/session.js')));
const story = JSON.parse(readFileSync(resolve(root, 'story/chapter-three.story.json')));
const media = JSON.parse(readFileSync(resolve(root, 'media/manifest.json')));
const source = JSON.parse(readFileSync(resolve('GameStarter/web-demo/visual-assets.json')));
const targets = new Map([
    ['JT-008', 'wangping'], ['JT-009', 'masu'], ['JT-117', 'wangping'],
    ['JT-004', 'jieting-water'], ['JT-068', 'jieting-clerk'], ['JT-069', 'jieting-scout'],
    ['JT-061', 'jieting-mover'], ['JT-125', 'jieting-messenger'], ['JT-127', 'jieting-leader'],
]);
const picks = { 'JT-Q1':'JT-O018', 'JT-Q2':'JT-O029', 'JT-Q3':'JT-O093', 'JT-Q4':'JT-O111' };
const session = new JietingSession(story, undefined, { aiEnabled:false, phoneAllowed:false });
const snapshots = new Map();
for (let step = 0; step < 220 && snapshots.size < targets.size; step++) {
    const id = session.current.id;
    if (targets.has(id)) snapshots.set(id, structuredClone(session.state));
    if (snapshots.size === targets.size) break;
    const option = session.options.length ? picks[id] ?? (id === 'JT-VISIT-REMAINING' ? session.options[0].id : null) : undefined;
    if (session.options.length) assert.ok(option, `Missing authored choice at ${id}`);
    assert.ok(session.advance(option), `Could not advance ${id}`);
}
assert.equal(snapshots.size, targets.size);
const hash = id => createHash('sha256').update(readFileSync(resolve('GameStarter/web-demo', source.sourceRoot, source.characters[id]))).digest('hex');
for (const [oldId, newId] of [['scout','jieting-scout'], ['military-clerk','jieting-clerk'], ['guard','jieting-water'], ['relay','jieting-messenger'], ['guard','jiangwei_guard']]) assert.notEqual(hash(oldId), hash(newId));
assert.equal(new Set([...new Set([...targets.values()].filter(id => id.startsWith('jieting-'))), 'jiangwei_guard'].map(hash)).size, 7);
const server = createStaticServer();
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel:'chrome', headless:true });
const errors = [], results = [];
try {
    for (const [node, state] of snapshots) {
        const person = targets.get(node);
        // Only isolated browser storage is seeded, using progress reached through real choices.
        const context = await browser.newContext({ viewport:{ width:1440, height:900 }, reducedMotion:'reduce' });
        await context.route('http://127.0.0.1:8787/**', route => route.fulfill({ headers:{ 'Access-Control-Allow-Origin':'*' }, json:{ configured:false } }));
        await context.addInitScript(state => {
            if (!sessionStorage.getItem('art-seeded')) { localStorage.setItem('jieting-chapter-three-v1', JSON.stringify(state)); sessionStorage.setItem('art-seeded', '1'); }
        }, state);
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/?chapter=jieting`, { waitUntil:'domcontentloaded' });
        await page.locator(`[data-node="${node}"]`).waitFor();
        const image = page.locator('.character-art');
        const pair = ['masu', 'wangping'].includes(person);
        const expected = pair ? ['wangping', 'masu'] : [person];
        assert.equal(await image.count(), expected.length);
        for (const id of expected) {
            const art = page.locator(`.character-art[src="${media.characters[id]}"]`);
            await art.evaluate(async image => { await image.decode(); });
        }
        const visibleArt = async () => image.evaluateAll(images => images.map(image => {
            const style = getComputedStyle(image), rect = image.getBoundingClientRect();
            return { src:image.getAttribute('src'), opacity:Number(style.opacity),
                display:style.display, visibility:style.visibility, width:rect.width, height:rect.height,
                intersects:rect.right>0 && rect.left<innerWidth && rect.bottom>0 && rect.top<innerHeight };
        }));
        const checkVisible = async () => {
            const visible = await visibleArt();
            assert.ok(visible.every(art => art.opacity>.9 && art.display!=='none' && art.visibility==='visible' && art.width>0 && art.height>0 && art.intersects), `${node}: loaded portraits must actually be visible: ${JSON.stringify(visible)}`);
            return visible;
        };
        const visibility = await checkVisible();
        if (pair) {
            assert.equal(await page.locator('.character-art.is-speaking').getAttribute('src'), media.characters[person]);
            for (const viewport of [{width:1366,height:768}, {width:390,height:844}]) {
                await page.setViewportSize(viewport); await checkVisible();
                await page.screenshot({path:resolve(output, `${node}-pair-${viewport.width}.png`)});
            }
            await page.setViewportSize({width:1440,height:900});
        }
        await page.locator(`[data-character-open="${person}"]`).waitFor();
        await page.screenshot({ path:resolve(output, `${person}-game.png`) });
        const before = await page.evaluate(() => localStorage.getItem('jieting-chapter-three-v1'));
        await page.locator(`[data-character-open="${person}"]`).click();
        assert.equal(await page.locator('.character-portrait img').getAttribute('src'), media.characters[person]);
        assert.equal(await page.locator('[data-character-select="gouan"]').count(), 0, 'Other chapters remain absent from this dossier');
        await page.screenshot({ path:resolve(output, `${person}-dossier.png`) });
        await page.locator('[data-character-close]').click();
        assert.equal(await page.evaluate(() => localStorage.getItem('jieting-chapter-three-v1')), before);
        await page.reload({ waitUntil:'domcontentloaded' });
        await page.locator(`[data-node="${node}"]`).waitFor();
        await checkVisible();
        assert.equal(await page.locator('.character-art.is-speaking').getAttribute('src'), media.characters[person]);
        if (node === 'JT-008') {
            await page.locator('.dialogue-advance').click();
            await page.locator('[data-node="JT-009"]').waitFor();
            assert.equal(await page.locator('.character-art.is-speaking').getAttribute('src'), media.characters.masu);
            await checkVisible();
        }
        results.push({ node, person, image:media.characters[person], visibility, dossierMatches:true, restoreMatches:true });
        await context.close();
    }
    const page = await browser.newPage({ viewport:{ width:1440,height:1000 } });
    await page.goto(`${base}/art-review/character-distinction-20261027.html`);
    await page.locator('img').evaluateAll(async images => Promise.all(images.map(image => image.decode())));
    assert.equal(await page.locator('img').count(), 9);
    await page.screenshot({ path:resolve(output, 'review-board.png'), fullPage:true });
    await page.close();
    assert.deepEqual(errors, []);
    writeFileSync(resolve(output, 'browser-report.json'), JSON.stringify({ passed:true, storyVersion:story.version, results, errors }, null, 2));
    console.log(JSON.stringify({ passed:true, portraits:results.length, errors }));
} finally { await browser.close(); await new Promise(ok => server.close(ok)); }
