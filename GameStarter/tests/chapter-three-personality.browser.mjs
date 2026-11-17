import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createStaticServer } from '../web-demo/serve.mjs';

// A disposable origin and browser context: no user saves, API credentials or live model calls.
const server = createStaticServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [], errors = [];
const output = resolve('outputs/personality-integration-20261027/chapter-three-browser');
mkdirSync(output, { recursive: true });
const buildFiles = ['index.html', 'GameStarter/web-demo/src/entry.js', 'GameStarter/web-demo/src/chapter-three.js',
  'GameStarter/web-demo/src/personality/module.js', 'story/chapter-three.story.json', 'media/manifest.json'];
const buildInfo = () => Object.fromEntries(buildFiles.map(name => {
  try {
    const file = resolve('GameStarter/web-demo/.build', name), info = statSync(file);
    return [name, { modified: info.mtime.toISOString(), size: info.size, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }];
  } catch (error) { return [name, { error: error.code ?? error.name }]; }
}));
const diagnostics = { buildAtStart: buildInfo(), fixtures: [], requestsFailed: [], httpErrors: [], consoleErrors: [], pageErrors: errors };
let fixtureNumber = 0;
const fields = ['gapEstablished', 'reinforcementUse', 'concernAnswered', 'risk', 'route', 'reception', 'motive', 'means', 'withdrawal'];
function npc(data, followup = false, execute = false) {
  const clue = data.context.ownedClues.find(c => c.id === 'JT-C04') ?? data.context.ownedClues[0];
  const raw = { version: 1, valid: true, factsReliable: true, factualIssues: [], maintain: { value: false, quote: '' },
    criteria: Object.fromEntries(fields.map(key => [key, { value: false, quote: '', evidenceIds: [], itemIds: [], reason: '' }])),
    acknowledgment: followup ? '这个缺口我听明白了。' : '这趟回话已经听清。',
    followup: { needed: followup, question: followup ? '为什么不能等告急以后再增兵？' : '' },
    offense: execute ? { direct: true, target: 'ma-su', kind: 'insult', context: 'asserted', intent: 'abuse',
      targetQuote: '马谡', actQuote: '你是废物', quote: data.playerWords, reason: '测试输入直接辱骂当前听者。' }
      : { direct: false, target: 'none', kind: 'none', context: 'asserted', intent: 'argument', targetQuote: '', actQuote: '', quote: '', reason: '正常进言' },
    eraAssessment: { version: 1, severeMismatch: false, explanation: 'coherent', itemIds: [], quote: '', reason: '不涉及时代物品' },
    deploymentTasks: [{ task: 'road', quote: data.playerWords }],
  };
  for (const key of ['gapEstablished', 'reinforcementUse', ...(followup ? [] : ['concernAnswered'])]) raw.criteria[key] = {
    value: true, quote: data.playerWords, evidenceIds: [clue.id], itemIds: [], reason: '以当前军报核验部署。',
  };
  return raw;
}

async function fixture() {
  const fixtureId = ++fixtureNumber;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('wuzhang-runtime-mode-v1', 'ai'));
  const control = { firstFollowup: false, execute: false, holdFirstPersonality: false, held: null, personality: [], calls: 0 };
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  await context.route('http://127.0.0.1:8787/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const reply = json => route.fulfill({ headers, json });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path === '/health') return reply({ configured: true });
    if (path === '/api/game/respond') {
      const prompt = request.postDataJSON().text, data = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
      const followup = control.firstFollowup && control.calls++ === 0;
      return reply({ text: JSON.stringify(npc(data, followup, control.execute)), responseId: 'isolated-npc' });
    }
    if (path === '/api/game/personality') {
      const data = request.postDataJSON(); control.personality.push(data);
      const quote = '宁肯多等一晚，也先核清记录';
      const vector = data.input.includes(quote) ? [-2, null, null, null] : [null, null, null, null];
      const result = { vector, quotes: [vector[0] === null ? null : quote, null, null, null],
        reasons: ['受控接口测试', '无依据', '无依据', '无依据'], excluded: false,
        sceneId: data.nodeId, slot: 'CH3.open.reinforcement.1', rubricVersion: 'isolated-test' };
      if (control.holdFirstPersonality && control.personality.length === 1) {
        await new Promise(resolve => { control.held = async () => { try { await reply(result); } catch {} finally { resolve(); } }; });
        return;
      }
      return reply(result);
    }
    return route.fulfill({ status: 501, headers, json: { error: `Unmocked route ${path}` } });
  });
  const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => diagnostics.requestsFailed.push({ fixtureId, url: request.url(), error: request.failure()?.errorText }));
  page.on('response', response => { if (response.status() >= 400) diagnostics.httpErrors.push({ fixtureId, url: response.url(), status: response.status() }); });
  page.on('console', message => { if (message.type() === 'error') diagnostics.consoleErrors.push({ fixtureId, text: message.text() }); });
  await page.goto(`${base}/?chapter=jieting&playtest=reinforcement`, { waitUntil: 'domcontentloaded' });
  // data-node belongs to the outer mount, whose own box is not the playable control.
  // Check its committed state separately, then require the actual editor to be visible.
  await page.waitForFunction(() => document.querySelector('#game-root')?.getAttribute('data-node') === 'JT-OPEN-R1', undefined, { timeout: 12000 });
  await page.locator('#player-expression').waitFor({ state: 'visible' });
  diagnostics.fixtures.push({ fixtureId, build: buildInfo(), mounted: await page.locator('#game-root').evaluate(root => {
    const box = root.getBoundingClientRect(); return { node: root.dataset.node, width: box.width, height: box.height, visibility: getComputedStyle(root).visibility };
  }) });
  const key = 'jieting-chapter-three-v1:playtest:reinforcement';
  const state = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const ledger = () => page.evaluate(() => JSON.parse(localStorage.getItem('wzy:personality:v1:playtest:reinforcement:jieting')));
  const submit = async text => { await page.locator('#player-expression').fill(text); await page.locator('[data-action=speak]').click(); await page.locator('.dialogue-advance').waitFor(); };
  return { page, context, control, state, ledger, submit };
}

try {
  const f = await fixture(); f.control.firstFollowup = true; f.control.holdFirstPersonality = true;
  const first = '宁肯多等一晚，也先核清记录。正面和侧路都缺人，请将军先安排守路。';
  const second = '等告急后才下山列阵，会耽误赶路的工夫。';
  await f.submit(first);
  assert.equal((await f.state()).personality.checkpoint.events[0].status, 'pending');
  await f.page.locator('.dialogue-advance').click();
  await f.page.locator('#player-expression').waitFor();
  await f.submit(second);
  await f.page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).personality.checkpoint.events.some(e => e.status === 'ready'), 'jieting-chapter-three-v1:playtest:reinforcement');
  assert.equal(f.control.personality.at(-1).input, `${first}\n${second}`);
  assert.equal(f.control.personality.at(-1).origin, 'self-authored');
  assert.match(f.control.personality.at(-1).context.dialogueOrder, /以后句为准/);
  if (f.control.held) await f.control.held();
  let s = await f.state();
  assert.equal(s.personality.checkpoint.events.length, 1);
  assert.equal(s.personality.checkpoint.events[0].text, `${first}\n${second}`);
  assert.deepEqual(s.personality.checkpoint.events[0].vector, [-2, null, null, null]);
  assert.equal(s.judgments.length, 2);
  assert.equal(Object.values(s.checkpoints).some(checkpoint => 'personality' in checkpoint), false);
  await f.page.locator('[data-action=save]').click(); await f.page.locator('[data-store-slot="1"]').click(); await f.page.locator('[data-action=close-modal]').click();
  await f.page.locator('.dialogue-advance').click();
  await f.page.locator('[data-action=save]').click(); await f.page.locator('[data-load-slot="1"]').click();
  s = await f.state(); assert.equal(s.node, 'JT-OPEN-R1'); assert.equal(s.judgments.length, 2);
  assert.equal(Object.values(s.checkpoints).some(checkpoint => 'personality' in checkpoint), false);
  assert.equal(s.personality.checkpoint.events.length, 1);
  assert.equal(await f.page.evaluate(() => localStorage.getItem('wzy:personality:v1')), null);
  assert.equal(await f.page.evaluate(() => localStorage.getItem('jieting-chapter-three-v1')), null);
  reports.push('Background evaluation does not block followup; combined own speech replaces its pending predecessor; manual save/load has no recursive personality checkpoint; playtest is isolated.');
  await f.context.close();

  const g = await fixture(); g.control.execute = true;
  await g.submit('马谡，你是废物。');
  for (let i = 0; i < 12 && (await g.state()).ending !== 'execution'; i++) await g.page.locator('.dialogue-advance').click();
  assert.equal((await g.state()).ending, 'execution');
  let profile = await g.ledger(); assert.equal(profile.deaths.length, 1); assert.equal(profile.chapters.jieting.status, 'finished');
  await g.page.locator('[data-action=retry]').click(); await g.page.locator('#player-expression').waitFor();
  profile = await g.ledger(); assert.equal(profile.deaths.length, 1); assert.equal(profile.chapters.jieting.status, 'playing');
  assert.equal(profile.chapters.jieting.events.length, 0); assert.equal((await g.state()).judgments.length, 0);
  await g.page.locator('[data-action=pause]').click(); await g.page.locator('[data-action=pause-restart]').click();
  // Pause-menu restart confirmation invokes the chapter's existing restart callback.
  const confirm = g.page.locator('[data-action=pause-restart-confirm]');
  if (await confirm.count()) await confirm.click(); else await g.page.locator('[data-action=restart-confirm]').click();
  await g.page.locator('[data-node="JT-002"]').waitFor();
  profile = await g.ledger(); assert.equal(profile.chapters.jieting.events.length, 0); assert.equal(profile.deaths.length, 1);
  reports.push('Actual execution completes and archives once; retry prunes abandoned speech from the current result while keeping death history; restarting clears this chapter.');
  await g.context.close();
  assert.deepEqual(errors, []);
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ passed: true, mockedApi: true, results: reports, ...diagnostics, buildAtEnd: buildInfo() }, null, 2));
  console.log(JSON.stringify({ passed: true, mockedApi: true, results: reports }, null, 2));
} catch (error) {
  const pages = [];
  for (const context of browser.contexts()) for (const page of context.pages()) {
    const number = pages.length + 1, prefix = resolve(output, `failure-page-${number}`);
    try {
      writeFileSync(prefix + '.html', await page.content());
      await page.screenshot({ path: prefix + '.png', fullPage: true, timeout: 5000 });
      pages.push({ url: page.url(), html: prefix + '.html', screenshot: prefix + '.png', state: await page.evaluate(() => {
        const root = document.querySelector('#game-root'), input = document.querySelector('#player-expression');
        const box = root?.getBoundingClientRect();
        return { readyState: document.readyState, node: root?.getAttribute('data-node'), body: document.body.innerText,
          rootBox: box ? { width: box.width, height: box.height } : null,
          rootStyle: root ? { display: getComputedStyle(root).display, visibility: getComputedStyle(root).visibility } : null,
          inputPresent: !!input, runtimePreference: localStorage.getItem('wuzhang-runtime-mode-v1') };
      }) });
    } catch (captureError) { pages.push({ url: page.url(), captureError: captureError.message }); }
  }
  writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ passed: false, error: error.stack, ...diagnostics, buildAtEnd: buildInfo(), pages }, null, 2));
  throw error;
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
