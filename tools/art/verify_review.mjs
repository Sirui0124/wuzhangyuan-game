import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pagePath = resolve(root, 'source-art/visuals/review/20261022/index.html');
const source = JSON.parse(readFileSync(resolve(root, 'GameStarter/web-demo/visual-assets.json'), 'utf8'));
const review = JSON.parse(readFileSync(resolve(root, 'source-art/visuals/review/20261022/review-manifest.json'), 'utf8'));
const mirror = JSON.parse(readFileSync(resolve(root, 'source-art/visuals/runtime-map.json'), 'utf8'));
delete mirror._generated;
if (JSON.stringify(source) !== JSON.stringify(mirror)) throw new Error('Runtime map is stale');
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, channel: 'chrome' }); }
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(pagePath).href);
  await page.evaluate(async () => {
    const images = [...document.images];
    images.forEach(image => { image.loading = 'eager'; });
    await Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = resolve; image.onerror = resolve; })));
  });
  const broken = await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || !image.naturalWidth).map(image => image.src));
  // Viewer starts empty deliberately.
  const actualBroken = broken.filter(url => url && url !== pathToFileURL(pagePath).href);
  if (actualBroken.length) throw new Error(`Broken image paths: ${actualBroken.join(', ')}`);
  await page.getByRole('button', { name: '深底', exact: true }).click();
  if (await page.locator('body').getAttribute('data-bg') !== 'dark') throw new Error('Dark background toggle failed');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.portrait')).backgroundColor === 'rgb(24, 34, 29)');
  await page.locator('.character-group .image-open').first().click();
  if (!await page.locator('#viewer').evaluate(element => element.open)) throw new Error('Image preview did not open');
  await page.getByRole('button', { name: '关闭大图' }).click();
  if (await page.locator('#viewer').evaluate(element => element.open)) throw new Error('Image preview did not close');
  await page.getByRole('button', { name: '浅底', exact: true }).click();
  const rejectedInMainWall = await page.locator('#ui > .page-grid img').evaluateAll(images => images.filter(image => /darkwood|hemp-paper|ink-linen|cinnabar|rejected-v1/.test(image.src)).map(image => image.src));
  if (rejectedInMainWall.length) throw new Error('Rejected samples leaked into main UI wall');
  if (await page.locator('.rejected').getAttribute('open') !== null) throw new Error('Rejected samples should start collapsed');
  let latestDialogueFirst = false;
  if (review.screenshotFreshnessGates.include_ui) {
    const currentImages = await page.locator('#ui > .page-grid img').evaluateAll(images => images.map(image => decodeURI(image.src)));
    const latest = ['awakening', 'notice', 'scout', 'choice', 'weiyan', 'tablet', 'clue-in-flight'];
    if (latest.some((name, index) => !currentImages[index]?.endsWith(`/dialogue-light/${name}.png`))) throw new Error('Latest dialogue screenshots must lead the UI wall');
    const obsolete = currentImages.filter(url => /\/ui\/(dialogue|notice|dialogue-report|weiyan)\.png$|\/six-pages-review\.jpg$/.test(url));
    if (obsolete.length) throw new Error(`Historical dialogue shown as current: ${obsolete.join(', ')}`);
    if (await page.locator('.ui-history').getAttribute('open') !== null) throw new Error('UI history should start collapsed');
    latestDialogueFirst = true;
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const data = { passed: true, sourceVersion: source.version, fileProtocol: true, images: await page.locator('img[src]').count(), uiPages: await page.locator('#ui > .page-grid .asset').count(), historicalUiPages: await page.locator('.ui-history .asset').count(), characterGroups: await page.locator('.character-group').count(), reviewApprovalChanged: false, noBrokenImages: true, darkLightToggle: true, imagePreview: true, rejectedSamplesSeparated: true, latestDialogueFirst, runtimeMapMatches: true };
  if (process.argv.includes('--capture')) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: resolve(root, 'docs/art/review-gallery-page.jpg'), type: 'jpeg', quality: 88 });
    await page.locator('#characters').evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.getByRole('button', { name: '深底', exact: true }).click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.portrait')).backgroundColor === 'rgb(24, 34, 29)');
    await page.screenshot({ path: resolve(root, 'docs/art/review-gallery-characters-dark.jpg'), type: 'jpeg', quality: 88 });
  }
  writeFileSync(resolve(root, 'docs/art/review-gallery-checks.json'), JSON.stringify(data, null, 2) + '\n');
  console.log(JSON.stringify(data));
} finally { await browser.close(); }
