import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
const server = createStaticServer();
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await page.addInitScript(() => {
    window.musicSources = []; window.musicAtVideoStart = [];
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this), record = { source, ctx: this, started: false, stopAt: Infinity };
      window.musicSources.push(record);
      const start = source.start.bind(source), stop = source.stop.bind(source);
      source.start = (...args) => { record.started = true; return start(...args); };
      source.stop = (...args) => { record.stopAt = args[0] ?? this.currentTime; return stop(...args); };
      return source;
    };
    window.activeMusic = () => musicSources.filter(r => r.source.loop && r.started && r.stopAt > r.ctx.currentTime).length;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { if (this instanceof HTMLVideoElement) musicAtVideoStart.push(activeMusic()); return play.call(this); };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => activeMusic() > 0);
  await page.locator('[data-action=new]').click();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > .1);
  assert.equal(await page.evaluate(() => activeMusic()), 0);
  assert.deepEqual(await page.evaluate(() => musicAtVideoStart), [0]);
  // A second user gesture must not unlock/restart the old menu loop.
  await page.locator('[data-cinema-rate="1.5"]').click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => activeMusic()), 0);
  await page.reload();
  await page.waitForFunction(() => activeMusic() > 0);
  await page.locator('[data-action=continue]').click();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > .1);
  assert.equal(await page.evaluate(() => activeMusic()), 0);
  assert.ok((await page.evaluate(() => musicAtVideoStart)).every(n => n === 0));
  console.log('PASS: 菜单音乐正常播放；新游戏、读档均在视频 play 前停止音乐，后续点击不重启菜单音乐。');

  // Exercise an outgoing crossfade and a pending decoded buffer on the real audio class.
  await page.evaluate(async () => {
    const { GameAudio } = await import('/GameStarter/web-demo/src/audio.js');
    window.testAudio = new GameAudio();
    await testAudio.context.resume();
    testAudio.unlocked = true;
    const buffer = testAudio.context.createBuffer(1, 48000, 48000);
    testAudio.manifest = { sfx: {}, music: { home: { src: 'home' }, round1: { src: 'round1' } } };
    testAudio.buffer = async () => buffer;
    testAudio.setMusic('home'); await Promise.resolve();
    testAudio.setMusic('round1'); await Promise.resolve();
    window.crossfadeCount = testAudio.musicVoices.size;
    testAudio.setMusicPaused(true);
  });
  assert.equal(await page.evaluate(() => window.crossfadeCount), 2);
  assert.equal(await page.evaluate(() => activeMusic()), 0);
  await page.evaluate(async () => {
    testAudio.buffer = () => new Promise(ok => { window.finishDecode = ok; });
    testAudio.setMusicPaused(false);
    testAudio.setMusicPaused(true);
    finishDecode(testAudio.context.createBuffer(1, 48000, 48000));
    await Promise.resolve();
  });
  assert.equal(await page.evaluate(() => activeMusic()), 0);
  assert.equal(await page.evaluate(() => testAudio.musicVoices.size), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: 交叉淡出中的旧音乐同时停止；进入视频后才完成的音乐解码不能重新启动音轨。');
} finally { await browser.close(); server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
