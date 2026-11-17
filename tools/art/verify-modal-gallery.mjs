import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// Run after all ten runtime captures and build-modal-gallery.mjs are complete.
// Verifies the offline review only; it does not operate or approve the game.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = resolve(root, 'docs/art/review-20261022/modal-suite');
const gallery = resolve(root, 'source-art/visuals/review/20261022/modal-suite/index.html');
const pages = ['settings', 'saves', 'history', 'thought'];
const themes = ['dark', 'light'];
const expected = themes.flatMap(theme => [...pages, 'tablet'].map(page => `${theme}-${page}.png`));
const missing = [gallery, ...expected.map(name => resolve(output, name))].filter(path => !existsSync(path));
assert.deepEqual(missing, [], `Finish gallery generation and all ten screenshots before verification:\n${missing.join('\n')}`);

const report = {
  passed: false,
  checkedAt: new Date().toISOString(),
  scope: '离线比较图册；不代表正式游戏替换或用户审批',
  approval: '待用户review',
  fileProtocol: true,
  browser: 'Installed Chrome via Playwright',
  desktopViewport: { width: 2000, height: 1120 },
  tabletViewport: { width: 900, height: 1100 },
  sources: expected.map(name => ({ name, sha256: createHash('sha256').update(readFileSync(resolve(output, name))).digest('hex') })),
  desktopPages: [],
  tabletPages: [],
  tabletImages: [],
  viewerChecks: [],
  captures: [],
  errors: [],
  consoleErrors: [],
  remoteRequests: [],
};
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: report.desktopViewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('request', request => { if (/^https?:/i.test(request.url())) report.remoteRequests.push(request.url()); });
  await page.goto(pathToFileURL(gallery).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('[role="tab"]').count(), 4, 'Expected exactly four page tabs');
  assert.equal(await page.locator('.theme-card').count(), 2, 'Expected dark and light comparison columns');

  const assertImages = async selector => {
    await page.waitForFunction(selector => {
      const images = [...document.querySelectorAll(selector)];
      return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
    }, selector);
    return page.locator(selector).evaluateAll(async images => {
      await Promise.all(images.map(image => image.decode()));
      return images.map(image => ({ source: decodeURI(image.src), width: image.naturalWidth, height: image.naturalHeight }));
    });
  };
  const select = async id => {
    await page.locator(`[data-page="${id}"]`).click();
    assert.equal(await page.locator(`[data-page="${id}"]`).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('[role="tab"][aria-selected="true"]').count(), 1);
    assert.equal(await page.locator('#comparison').getAttribute('aria-labelledby'), `tab-${id}`);
    const images = await assertImages('.theme-card img');
    assert.equal(images.length, 2);
    for (const theme of themes) {
      const card = page.locator(`.theme-card[data-theme="${theme}"]`);
      assert.ok(images.some(image => image.source.endsWith(`/${theme}-${id}.png`)), `Wrong screenshot for ${theme}/${id}`);
      assert.equal(await card.locator('.image-frame').isEnabled(), true);
      assert.equal(await card.locator('.image-frame.pending').count(), 0);
      const link = new URL(await card.locator('[data-preview]').getAttribute('href'));
      assert.equal(link.origin, 'http://127.0.0.1:8812');
      assert.equal(link.pathname, '/modal-suite.html');
      assert.equal(link.searchParams.get('theme'), theme);
      assert.equal(link.searchParams.get('page'), id);
    }
    return images;
  };
  const overflow = async () => page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  const checkOverflow = async () => {
    const size = await overflow();
    assert.ok(size.document <= size.viewport && size.body <= size.viewport, `Horizontal overflow: ${JSON.stringify(size)}`);
    return size;
  };
  const checkColumns = async () => {
    const boxes = await page.locator('.theme-card').evaluateAll(cards => cards.map(card => {
      const rect = card.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, width: rect.width };
    }));
    assert.equal(boxes.length, 2);
    assert.ok(Math.abs(boxes[0].top - boxes[1].top) <= 1, 'Theme columns must align horizontally');
    assert.ok(boxes[0].right < boxes[1].left, 'Theme columns must not overlap');
    assert.ok(boxes[0].left >= 0 && boxes[1].right <= report.desktopViewport.width, 'Both theme columns must be in frame');
    const imageBoxes = await page.locator('.theme-card .image-frame').evaluateAll(frames => frames.map(frame => {
      const rect = frame.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom };
    }));
    assert.ok(imageBoxes.every(box => box.top >= 0 && box.bottom <= report.desktopViewport.height), 'Both complete comparison images must fit in the first viewport');
    return boxes;
  };
  const checkViewer = async (frame, theme, shot, closeWithButton = false) => {
    await frame.click();
    assert.equal(await page.locator('#viewer').evaluate(dialog => dialog.open), true);
    const [image] = await assertImages('#viewer-image');
    assert.ok(image.source.endsWith(`/${theme}-${shot}.png`));
    if (closeWithButton) await page.locator('#close-viewer').click();
    else await page.keyboard.press('Escape');
    assert.equal(await page.locator('#viewer').evaluate(dialog => dialog.open), false);
    report.viewerChecks.push({ theme, shot, opened: true, imageLoaded: true, closedBy: closeWithButton ? 'button' : 'Escape' });
  };
  const capture = async name => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: resolve(output, name), type: 'jpeg', quality: 93, fullPage: true });
    report.captures.push(name);
  };

  for (const id of pages) {
    const images = await select(id);
    await page.evaluate(() => window.scrollTo(0, 0));
    const columns = await checkColumns();
    const size = await checkOverflow();
    for (const theme of themes) await checkViewer(page.locator(`.theme-card[data-theme="${theme}"] .image-frame`), theme, id);
    report.desktopPages.push({ page: id, images, columns, overflow: size });
    await capture(`overview-${id}.jpg`);
  }

  // Verify real tab keyboard behavior, then restore the main comparison state.
  await page.locator('[data-page="settings"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-page="saves"]').getAttribute('aria-selected'), 'true');
  await page.keyboard.press('End');
  assert.equal(await page.locator('[data-page="thought"]').getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Home');
  assert.equal(await page.locator('[data-page="settings"]').getAttribute('aria-selected'), 'true');
  report.keyboardTabs = true;

  await page.locator('.tablet-section summary').click();
  report.tabletImages = await assertImages('.tablet-card img');
  assert.equal(report.tabletImages.length, 2);
  for (const theme of themes) await checkViewer(page.locator(`.tablet-card [data-open="${theme}"]`), theme, 'tablet', true);
  await page.locator('.tablet-section summary').click();
  await select('saves');
  await page.evaluate(() => window.scrollTo(0, 0));
  await checkColumns();
  await capture('overview.jpg');
  report.overviewPage = 'saves';

  await page.setViewportSize(report.tabletViewport);
  for (const id of pages) {
    const images = await select(id);
    report.tabletPages.push({ page: id, imagesLoaded: images.length, overflow: await checkOverflow() });
  }
  await page.locator('.tablet-section summary').click();
  await assertImages('.tablet-card img');
  report.tabletExpandedOverflow = await checkOverflow();
  await checkViewer(page.locator('.tablet-card [data-open="dark"]'), 'dark', 'tablet');
  assert.deepEqual(report.errors, [], 'Gallery script errors');
  assert.deepEqual(report.consoleErrors, [], 'Gallery resource or console errors');
  assert.deepEqual(report.remoteRequests, [], 'Offline gallery must not make network requests');
  report.noBrokenImages = true;
  report.tabletNoHorizontalOverflow = true;
  report.passed = true;
} catch (error) {
  report.failure = error.stack || String(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  writeFileSync(resolve(output, 'gallery-checks.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ passed: report.passed, report: relative(root, resolve(output, 'gallery-checks.json')).replaceAll('\\', '/'), captures: report.captures, failure: report.failure }));
}
