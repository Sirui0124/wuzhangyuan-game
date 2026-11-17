import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const base = process.env.GAME_BASE || 'http://127.0.0.1:8812';
const out = resolve('outputs/chapter-three-integration-20261026/browser-reading');
mkdirSync(out, { recursive: true });
const storyPath = resolve('content/chapters/jieting/chapter-three.story.json');
const source = readFileSync(storyPath, 'utf8');
const story = JSON.parse(source), sourceHash = createHash('sha256').update(source).digest('hex');
const nodeById = new Map(story.nodes.map(n => [n.id, n]));
const SAVE = 'jieting-chapter-three-v1';
const pages = {
    'JT-002': [
        '这一次，我到了街亭。《三国演义》里，马谡不听王平的劝，偏要上山扎营，后来被魏军断了水道，街亭失守，诸葛亮挥泪斩马谡。',
        '读到这里时，我总觉得可惜。可现在，山下的帐篷才拆了一半，兵还在搬东西。这场仗还没打，我得想想办法。',
    ],
    'JT-151': [
        '我把马谡的回话转告王平，又留在坡脚听他安排。',
        '该补到哪处、该留在哪处，我都问清记下；若有援兵，等领队清点完到营的人数，我才带回报上山。',
    ],
};
for (const [id, expected] of Object.entries(pages)) assert.equal(expected.join(''), nodeById.get(id).text, `${id} expected pages preserve source text`);
assert.deepEqual(pages['JT-002'].map(p => [...p].length), [58, 49]);
assert.deepEqual(pages['JT-151'].map(p => [...p].length), [22, 44]);
const choices = { 'JT-Q1':'JT-O018', 'JT-Q2':'JT-O029', 'JT-Q3':'JT-O093', 'JT-Q4':'JT-O111', 'JT-R1-FIXED':'JT-O132', 'JT-R2-FIXED':'JT-O167' };
const errors = [], results = [], mockRequests = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let page;
const report = () => writeFileSync(resolve(out, 'report.json'), JSON.stringify({ base, storyVersion:story.version, sourceHash, results, errors, mockRequests }, null, 2));
try {
    // Fresh storage partition only: no user profile, real saves, credentials or live model requests.
    const context = await browser.newContext({ viewport: { width:1440, height:900 } });
    assert.deepEqual((await context.storageState()).origins, []);
    await context.addInitScript(() => { localStorage.setItem('wuzhang-runtime-mode-v1', 'offline'); localStorage.setItem('wuzhang-reduced-motion', '1'); });
    await context.route('http://127.0.0.1:8787/**', route => {
        const url = new URL(route.request().url()); mockRequests.push({ method:route.request().method(), path:url.pathname });
        return route.fulfill({ status:url.pathname === '/health' ? 200 : 503, headers:{ 'Access-Control-Allow-Origin':'*' }, json:url.pathname === '/health' ? { configured:false } : { error:'Reading smoke never calls a live API' } });
    });
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const position = () => page.locator('#game-root').evaluate(root => ({ node:root.dataset.node, page:root.dataset.readingPage }));
    const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), SAVE);
    const slot = number => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), `${SAVE}:slot:${number}`);
    const below = s => 5000 + Object.values(s.roundResults).reduce((sum, r) => sum + (r.arrived ? r.troops : 0), 0);
    const business = s => { const { reading, savedAt, ...rest } = s; return rest; };
    const occurrences = (s, text) => s.transcript.filter(entry => entry.text === text).length;
    async function expectPage(id, index) {
        await page.waitForFunction(({ id, index }) => { const root = document.querySelector('#game-root'); return root?.dataset.node === id && root?.dataset.readingPage === String(index); }, { id, index });
        assert.equal(await page.locator('#spoken-line').textContent(), pages[id][index]);
        const state = await saved();
        assert.deepEqual(state.reading, { node:id, text:nodeById.get(id).text, page:index });
    }
    async function advance(option) {
        const before = await position();
        if (option) await page.locator(`[data-option="${option}"]`).click();
        else await page.locator('.dialogue-advance').click();
        await page.waitForFunction(previous => { const root = document.querySelector('#game-root'); return root?.dataset.node !== previous.node || root?.dataset.readingPage !== previous.page; }, before);
    }
    async function walk(target) {
        for (let i=0; i<350; i++) {
            const current = (await position()).node;
            if (current === target) return;
            const options = page.locator('[data-option]');
            if (await options.count()) {
                const pick = choices[current] ?? (current === 'JT-VISIT-REMAINING' ? await options.first().getAttribute('data-option') : null);
                assert.ok(pick, `Missing explicit choice at ${current}`); await advance(pick);
            } else await advance();
        }
        throw new Error(`Did not reach ${target}`);
    }
    async function assertFullOptions(id, screenshot) {
        assert.equal((await position()).node, id);
        const expected = nodeById.get(id).options.map(option => ({ id:option.id, text:option.text }));
        const actual = await page.locator('[data-option]').evaluateAll(nodes => nodes.map(node => ({ id:node.dataset.option, text:node.querySelector('span')?.textContent })));
        assert.deepEqual(actual, expected, `${id} keeps complete authored options`);
        const metrics = await page.locator('[data-option]').evaluateAll(nodes => nodes.map(node => {
            const rect = node.getBoundingClientRect(), text = node.querySelector('span'), range = document.createRange();
            range.selectNodeContents(text); const textRect = range.getBoundingClientRect();
            return { id:node.dataset.option, insideViewport:rect.left>=0 && rect.right<=innerWidth && rect.top>=0 && rect.bottom<=innerHeight,
                textInside:textRect.left>=rect.left-1 && textRect.right<=rect.right+1 && textRect.top>=rect.top-1 && textRect.bottom<=rect.bottom+1,
                scrollWidth:node.scrollWidth, clientWidth:node.clientWidth, scrollHeight:node.scrollHeight, clientHeight:node.clientHeight };
        }));
        assert.ok(metrics.every(m => m.insideViewport && m.textInside && m.scrollWidth<=m.clientWidth+1 && m.scrollHeight<=m.clientHeight+1), JSON.stringify(metrics));
        await page.screenshot({ path:resolve(out,screenshot) });
        results.push({ case:`${id} options unchanged and visible`, metrics });
    }
    await page.goto(`${base}/?chapter=jieting`, { waitUntil:'domcontentloaded' });
    await expectPage('JT-002',0);
    const openingStart = await saved();
    assert.equal(occurrences(openingStart,nodeById.get('JT-002').text),0);
    assert.ok(!openingStart.visited.includes('JT-002'));
    await page.screenshot({ path:resolve(out,'opening-page-1.png') });
    await advance(); await expectPage('JT-002',1);
    assert.deepEqual(business(await saved()),business(openingStart),'Turning an inner page does not alter model progress, events or transcript');
    await page.screenshot({ path:resolve(out,'opening-page-2.png') });

    await page.reload({ waitUntil:'domcontentloaded' }); await expectPage('JT-002',1);
    assert.deepEqual(business(await saved()),business(openingStart));
    await page.getByRole('button',{name:'线索',exact:true}).click();
    assert.match(await page.locator('.game-modal').innerText(),/还没有收录线索/);
    await page.locator('[data-action=close-modal]').click(); await expectPage('JT-002',1);
    await page.getByRole('button',{name:'存档',exact:true}).click();
    await page.locator('[data-store-slot="1"]').click();
    assert.deepEqual((await slot(1)).reading,(await saved()).reading);
    await page.locator('[data-action=close-modal]').click(); await expectPage('JT-002',1);
    await advance();
    assert.notEqual((await position()).node,'JT-002');
    let current = await saved();
    assert.equal(occurrences(current,nodeById.get('JT-002').text),1);
    assert.equal(current.visited.filter(id=>id==='JT-002').length,1);
    assert.equal(current.sourceReadings['JT-002'].text,nodeById.get('JT-002').text);

    await page.getByRole('button',{name:'存档',exact:true}).click();
    await page.locator('[data-load-slot="1"]').click(); await expectPage('JT-002',1);
    assert.deepEqual(business(await saved()),business(openingStart),'Loading the manual slot restores both page and business checkpoint');
    await advance(); current=await saved();
    assert.equal(occurrences(current,nodeById.get('JT-002').text),1,'Replaying the final page after loading does not duplicate the full line');
    await page.getByRole('button',{name:'记录',exact:true}).click();
    const records=await page.locator('.game-modal').innerText();
    assert.equal(records.split(nodeById.get('JT-002').text).length-1,1);
    await page.locator('[data-action=close-modal]').click();
    results.push({case:'opening 58/49 pages; refresh, clues and manual save/load retain page 2; only complete read records full text once',pageLengths:[58,49]});

    await walk('JT-R1-FIXED'); await page.setViewportSize({width:1366,height:768});
    await assertFullOptions('JT-R1-FIXED','r1-options-1366.png');
    await advance('JT-O132'); await walk('JT-151'); await expectPage('JT-151',0);
    const arrivalStart=await saved();
    assert.equal(arrivalStart.roundResults[1].ordered,true);assert.equal(arrivalStart.roundResults[1].arrived,false);assert.equal(arrivalStart.roundResults[1].reported,false);assert.equal(below(arrivalStart),5000);
    assert.equal(occurrences(arrivalStart,nodeById.get('JT-151').text),0);
    await page.screenshot({path:resolve(out,'r1-arrival-page-1.png')});
    await advance(); await expectPage('JT-151',1);
    assert.deepEqual(business(await saved()),business(arrivalStart),'First arrival screen does not award troops or report trust');
    await page.screenshot({path:resolve(out,'r1-arrival-page-2.png')});
    await page.reload({waitUntil:'domcontentloaded'}); await expectPage('JT-151',1);
    assert.deepEqual(business(await saved()),business(arrivalStart));
    await advance(); current=await saved();
    assert.equal(current.roundResults[1].arrived,true);assert.equal(current.roundResults[1].reported,true);assert.equal(below(current),10000);
    assert.deepEqual(current.scores,{...arrivalStart.scores,w:arrivalStart.scores.w+1});
    assert.equal(current.scoreEvents.filter(event=>event==='round1-w').length,1);
    assert.equal(occurrences(current,nodeById.get('JT-151').text),1);
    assert.equal(current.sourceReadings['JT-151'].text,nodeById.get('JT-151').text);
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('#game-root[data-node]').waitFor();
    current=await saved();assert.equal(below(current),10000);assert.equal(occurrences(current,nodeById.get('JT-151').text),1);
    results.push({case:'R1 great result remains 5,000 below until both arrival pages are read; then 10,000 and one truthful-report W point',pageLengths:[22,44]});

    await walk('JT-R2-FIXED'); await assertFullOptions('JT-R2-FIXED','r2-options-1366.png');
    await advance('JT-O167'); await walk('JT-R3-FIXED');
    await assertFullOptions('JT-R3-FIXED','longest-options-1366.png');
    assert.equal([...nodeById.get('JT-R3-FIXED').options.find(o=>o.id==='JT-O198').text].length,58);
    await page.setViewportSize({width:1440,height:900}); await assertFullOptions('JT-R3-FIXED','longest-options-1440.png');
    assert.equal(createHash('sha256').update(readFileSync(storyPath,'utf8')).digest('hex'),sourceHash,'Smoke did not change story/options/version');
    assert.equal((await saved()).version,story.version);
    assert.ok(mockRequests.every(request=>request.path==='/health'),'No model requests in the reading smoke');
    assert.deepEqual(errors,[]);report();console.log(JSON.stringify({results,errors},null,2));
    await context.close();
} catch(error) {
    errors.push(error.message);await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});report();throw error;
} finally { await browser.close(); }
