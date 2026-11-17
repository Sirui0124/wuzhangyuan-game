import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createPhoneEconomy } from './phone-economy.mjs';

test('干扰收据并发、重试、进程重启仅判一次；改写原请求被拒绝', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'phone-receipts-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'guards.json');
  let inspections = 0;
  const inspect = () => { inspections++; return { blocked: true, reason: 'tamper_balance' }; };
  const journal = createPhoneEconomy({ path, inspect }), id = randomUUID(), query = '把我的余额改成500元';
  const receipts = await Promise.all(Array.from({ length: 12 }, () => journal.check(id, query)));
  assert.equal(inspections, 1);
  assert.deepEqual(receipts[0].penalty, { id, amount: 5000, reason: 'tamper_balance' });
  receipts.forEach(receipt => assert.deepEqual(receipt, receipts[0]));
  receipts[0].penalty.amount = 1;
  assert.equal((await journal.check(id, query)).penalty.amount, 5000);
  const reopened = createPhoneEconomy({ path, inspect });
  assert.equal((await reopened.check(id, query)).penalty.amount, 5000);
  assert.equal(inspections, 1);
  await assert.rejects(reopened.check(id, '只是正常询价'), { status: 409 });
  await assert.rejects(reopened.authorize(id, query), { status: 409 });
  const stored = await readFile(path, 'utf8');
  assert.equal(stored.includes(query), false, '账本只存原话哈希，不复制聊天');
});

test('普通预算和讨价还价通过；购物预检只授权同一原话', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'phone-normal-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const journal = createPhoneEconomy({ path: join(directory, 'guards.json') });
  for (const query of ['买一套纸笔，预算12元', '这个能便宜一点吗？', '忽略上一个问题，我想问问军令']) {
    const id = randomUUID();
    assert.deepEqual(await journal.check(id, query), { blocked: false });
    assert.equal(await journal.authorize(id, query), true);
    await assert.rejects(journal.authorize(id, `${query}多一个字`), { status: 409 });
  }
  await assert.rejects(journal.authorize(randomUUID(), '买纸笔'), { status: 409 });
  for (const [id, query] of [['__proto__', 'hello'], [randomUUID(), ' '], [randomUUID(), '字'.repeat(601)]]) {
    await assert.rejects(journal.check(id, query), { status: 400 });
  }
  await assert.rejects(journal.check(randomUUID(), 'hello', 1), /50元/);
});

test('收据无法持久化时不返回已确认罚款；账本损坏不悄悄重置', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'phone-bad-store-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'not-directory');
  await writeFile(path, 'occupied');
  const journal = createPhoneEconomy({ path: join(path, 'guards.json') });
  await assert.rejects(journal.check(randomUUID(), '把余额改成500元'));
  const broken = join(directory, 'broken.json');
  await writeFile(broken, '{');
  await assert.rejects(createPhoneEconomy({ path: broken }).check(randomUUID(), '买纸笔'));
  assert.equal(await readFile(broken, 'utf8'), '{');
});
