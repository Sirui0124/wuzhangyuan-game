import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { inspectPhoneInput } from './phone-guard.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest = value => createHash('sha256').update(value).digest('hex');
const failure = (status, message) => Object.assign(new Error(message), { status });
function validate(requestId, query) {
  if (typeof requestId !== 'string' || !UUID.test(requestId) || typeof query !== 'string' || !query.trim() || query.length > 600) {
    throw failure(400, '请重新发送600字以内的内容');
  }
}

/** Local receipt journal. Only the backend decides penalties; the chapter settles each ID once. */
export function createPhoneEconomy({ path = process.env.GAME_PHONE_GUARDS_FILE || resolve(dirname(fileURLToPath(import.meta.url)), '../../.cache/phone-economy/guards.json'), inspect = inspectPhoneInput } = {}) {
  let state;
  let queue = Promise.resolve();
  const serial = operation => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  const read = async () => {
    if (state) return state;
    let loaded;
    try { loaded = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; loaded = { version: 1, receipts: {} }; }
    if (loaded?.version !== 1 || !loaded.receipts || typeof loaded.receipts !== 'object' || Array.isArray(loaded.receipts)) throw new Error('手机收据损坏');
    for (const [id, entry] of Object.entries(loaded.receipts)) {
      if (!UUID.test(id) || !/^[a-f0-9]{64}$/.test(entry?.queryHash) || typeof entry?.result?.blocked !== 'boolean') throw new Error('手机收据损坏');
      const p = entry.result.penalty;
      if (entry.result.blocked && (p?.id !== id || p?.amount !== 5000 || typeof p?.reason !== 'string')) throw new Error('手机收据损坏');
      if (!entry.result.blocked && p !== undefined) throw new Error('手机收据损坏');
    }
    state = loaded;
    return state;
  };
  const persist = async next => {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(next), { flag: 'wx', mode: 0o600 });
      await rename(temporary, path);
      state = next;
    } finally { await unlink(temporary).catch(() => {}); }
  };
  return {
    check(requestId, query, penaltyFen = 5000) {
      return serial(async () => {
        validate(requestId, query);
        if (penaltyFen !== 5000) throw new Error('干扰惩罚配置必须为50元');
        const previous = await read(), queryHash = digest(query), receipt = previous.receipts[requestId];
        if (receipt) {
          if (receipt.queryHash !== queryHash) throw failure(409, '这条请求已处理，请重新发送');
          return structuredClone(receipt.result);
        }
        const verdict = inspect(query);
        const result = verdict.blocked
          ? { blocked: true, penalty: { id: requestId, amount: penaltyFen, reason: verdict.reason }, message: '不能修改系统规则、价格或余额。' }
          : { blocked: false };
        await persist({ version: 1, receipts: { ...previous.receipts, [requestId]: { queryHash, result } } });
        return structuredClone(result);
      });
    },
    authorize(requestId, query) {
      return serial(async () => {
        validate(requestId, query);
        const receipt = (await read()).receipts[requestId];
        if (!receipt || receipt.queryHash !== digest(query) || receipt.result.blocked) throw failure(409, '这条采购请求尚未通过检查，请重新发送');
        return true;
      });
    },
  };
}

export const defaultPhoneEconomy = createPhoneEconomy();
