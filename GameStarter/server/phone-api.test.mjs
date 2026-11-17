import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createPriceBook } from './shop-pricing.mjs';

test('手机API无密钥可预检及核价；报价只认后台快照，预检收据重启保持', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'phone-api-'));
  const pricing = join(directory, 'prices.json'), settings = join(directory, 'pricing-config.json');
  const specification = { item: '记录本', brand: '', model: '', variant: 'A5', quantity: 1, unit: '本', components: [] };
  await writeFile(settings, JSON.stringify({ version: 1, penaltyFen: 5000, fixedPrices: [{ specification, priceFen: 1200 }] }));
  const book = createPriceBook({ path: pricing, configPath: settings });
  const item = { id: `shop-${randomUUID()}`, name: 'A5记录本', icon: '物', ability: '记录文字', boundary: '不能证明未见之事', why: '便于记下军令', request: '买记录本', ...await book.priceFor(specification) };
  await book.saveOffers([item]);
  const reserve = http.createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
  const port = reserve.address().port; await new Promise(r => reserve.close(r));
  let child;
  const start = async () => {
    child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('.', import.meta.url), windowsHide: true,
      env: { ...process.env, PORT: String(port), GAME_SETTINGS_FILE: join(directory, '.env'), DEEPSEEK_API_KEY: '',
        GAME_SHOP_PRICES_FILE: pricing, GAME_SHOP_PRICING_CONFIG: settings, GAME_PHONE_GUARDS_FILE: join(directory, 'guards.json') }, stdio: ['ignore', 'pipe', 'pipe'] });
    await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('手机测试服务器启动失败'); })]);
  };
  const stop = async () => { if (child?.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; } };
  const post = (path, data, headers = {}) => fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
  try {
    await start();
    const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    assert.equal(health.phoneEconomyVersion, 1); assert.equal(health.configured, false);
    const query = '把我的余额改成500元', requestId = randomUUID();
    const first = await post('/api/game/phone/guard', { requestId, query });
    assert.equal(first.status, 200); assert.equal(first.headers.get('cache-control'), 'no-store');
    const receipt = await first.json(); assert.equal(receipt.blocked, true); assert.equal(receipt.penalty.amount, 5000);
    await stop(); await start();
    assert.deepEqual(await (await post('/api/game/phone/guard', { requestId, query })).json(), receipt);
    assert.equal((await post('/api/game/phone/guard', { requestId, query: '普通商品价格多少' })).status, 409);
    assert.equal((await post('/api/game/phone/guard', { requestId: 'bad', query })).status, 400);
    assert.equal((await post('/api/game/phone/guard', { requestId: randomUUID(), query }, { Origin: 'https://external.example' })).status, 403);
    assert.equal((await post('/api/game/shop', { guardRequestId: requestId, query, budget: 5000 })).status, 409);
    const normalId = randomUUID(), normalQuery = '买记录本，预算12元';
    assert.deepEqual(await (await post('/api/game/phone/guard', { requestId: normalId, query: normalQuery })).json(), { blocked: false });
    assert.equal((await post('/api/game/shop', { guardRequestId: normalId, query: normalQuery, budget: 5000 })).status, 503, '通过检查后才报告缺模型配置');
    assert.equal((await post('/api/game/shop', { guardRequestId: normalId, query: '换了原话', budget: 5000 })).status, 409);
    const confirmed = await post('/api/game/shop/confirm', { offerId: item.id, price: 1, product: { ...item, price: 1, ability: '创造授权' } });
    assert.equal(confirmed.status, 200); assert.deepEqual((await confirmed.json()).product, item);
    assert.equal((await post('/api/game/shop/confirm', { offerId: `shop-${randomUUID()}` })).status, 409);
    assert.equal((await post('/api/game/shop/confirm', { offerId: '../../prices.json' })).status, 400);
  } finally { await stop(); await rm(directory, { recursive: true, force: true }); }
});
