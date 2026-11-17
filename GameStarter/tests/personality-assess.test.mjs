import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Compile just these two production modules in memory; no game boot or real player storage.
const asModule = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const evaluation = asModule(transpile(await readFile(new URL('../web-demo/src/modules/evaluation.ts', import.meta.url), 'utf8')));
const source = transpile(await readFile(new URL('../web-demo/src/personality/assess.ts', import.meta.url), 'utf8'));
const { createPersonalityAssessor } = await import(asModule(source.replace("'../modules/evaluation'", JSON.stringify(evaluation))));
const request = { chapterId: 'grain', nodeId: 'CH2-LY03-018', input: '即使多等一晚，我也先核清记录。', origin: 'self-authored' };
const result = (extra = {}) => ({ vector: [-2, null, null, null], quotes: ['即使多等一晚，我也先核清记录', null, null, null],
  reasons: ['明确接受等待成本', '没有证据', '没有证据', '没有证据'], excluded: false,
  sceneId: request.nodeId, slot: 'CH2.open.O1', rubricVersion: 'test-only', ...extra });
const response = raw => new Response(JSON.stringify(raw), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('客户端向独立代理提交原话和来源，返回四轴引文，不调用 NPC 接口', async () => {
  let sent;
  const assessor = createPersonalityAssessor({ baseUrl: 'http://localhost:9999/', fetch: async (url, options) => {
    sent = { url, options }; return response(result());
  } });
  assert.deepEqual((await assessor.assess(request)).vector, [-2, null, null, null]);
  assert.equal(sent.url, 'http://localhost:9999/api/game/personality');
  assert.deepEqual(JSON.parse(sent.options.body), request);
  assert.equal(sent.options.cache, 'no-store');
  assessor.dispose();
});

test('客户端拒绝错误原句、错场景及未知来源的 B 分，失败不回落关键词值', async () => {
  for (const raw of [result({ quotes: ['我很谨慎', null, null, null] }), result({ sceneId: 'CH2-O2-INPUT' }),
    result({ vector: [null, 2, null, null], quotes: [null, request.input, null, null] })]) {
    const assessor = createPersonalityAssessor({ fetch: async () => response(raw) });
    await assert.rejects(assessor.assess({ ...request, origin: 'unknown' }));
    assessor.dispose();
  }
  const disabled = createPersonalityAssessor({ enabled: () => false, fetch: async () => { throw new Error('不应请求'); } });
  await assert.rejects(disabled.assess(request), /未启用/);
});

test('教学直接排除，取消/卸载后即使 transport 迟到成功也不返回分数', async () => {
  let complete, sent = 0;
  const assessor = createPersonalityAssessor({ fetch: async () => { sent++; return new Promise(resolve => { complete = resolve; }); } });
  assert.equal((await assessor.assess({ ...request, chapterId: 'wuzhang', nodeId: 'R1-LANG' })).excluded, true);
  assert.equal(sent, 0);
  const pending = assessor.assess(request);
  assessor.cancel(); complete(response(result()));
  await assert.rejects(pending, { name: 'AbortError' });
  assessor.dispose();
  await assert.rejects(assessor.assess(request), { name: 'AbortError' });
});

test('超时向 transport 传递取消，外部信号取消也不接受返回', async () => {
  const assessor = createPersonalityAssessor({ timeoutMs: 5, fetch: async (_url, options) => {
    // Keeping this timer alive also lets AbortSignal.timeout run in a Node test process.
    await new Promise(resolve => setTimeout(resolve, 15));
    options.signal.throwIfAborted(); return response(result());
  } });
  await assert.rejects(assessor.assess(request), { name: 'TimeoutError' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(assessor.assess(request, controller.signal), { name: 'AbortError' });
  assessor.dispose();
});
