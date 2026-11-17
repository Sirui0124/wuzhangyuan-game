import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Explicit opt-in live check. The child reads the existing provider config normally;
// this script never reads, requests, prints, or changes credentials/settings.
const reserve = http.createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('.', import.meta.url), windowsHide: true,
  env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'ignore'] });
const base = `http://127.0.0.1:${port}`;
const conditional = '你若要我藏下真实过错，我不会答应。就算你因此怨我，我也会把全部材料照实送上，不能为你一个人压住军情。';
const cases = [
  { id: 'required-facts-only', request: { chapterId: 'wuzhang', nodeId: 'P2-01', round: 2,
    input: '姜维已经亲口答应在帐外接报。与前几夜不同，今夜敌军跟着我军调动换向，可能是在试探虚实。我现在带您到帐外当面交报，不进丞相帐。',
    origin: 'self-authored' }, expected: [null, null, null, null] },
  { id: 'conditional-negated-concealment', request: { chapterId: 'grain', nodeId: 'CH2-LY03-018', input: conditional, origin: 'self-authored' }, expected: [null, -2, -2, -2] },
  { id: 'adopted-generated-speech', request: { chapterId: 'grain', nodeId: 'CH2-LY03-018', input: conditional, origin: 'assistant-generated' }, expected: [null, null, -2, -2] },
];
const report = { liveAI: true, isolatedProxy: true, playerRecordsAccessed: false, providerChanged: false,
  startedAt: new Date().toISOString(), model: null, configured: false, cases: [] };
try {
  await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('隔离测试代理未能启动'); })]);
  const health = await (await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) })).json();
  report.configured = health.configured === true; report.model = typeof health.model === 'string' ? health.model : null;
  if (!report.configured) throw new Error('当前模型未配置，未发送真实请求');
  for (const item of cases) {
    const began = Date.now();
    try {
      const response = await fetch(`${base}/api/game/personality`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.request), signal: AbortSignal.timeout(55000) });
      const result = await response.json();
      const record = { id: item.id, status: response.status, durationMs: Date.now() - began,
        expected: item.expected, vector: result.vector ?? null, quotes: result.quotes ?? null,
        matchesExpected: response.ok && JSON.stringify(result.vector) === JSON.stringify(item.expected),
        ...(response.ok ? { evidence: result.evidence?.map(({ axis, eventStage, sourceType }) => ({ axis, eventStage, sourceType })) }
          : { error: typeof result.error === 'string' ? result.error : '请求失败' }) };
      report.cases.push(record); console.log(JSON.stringify(record));
    } catch (error) {
      const record = { id: item.id, durationMs: Date.now() - began, matchesExpected: false, error: error.name ?? 'Error' };
      report.cases.push(record); console.log(JSON.stringify(record));
    }
  }
} catch (error) {
  report.error = error.message;
} finally {
  if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
  const directory = resolve('outputs/personality-integration-20261027'); await mkdir(directory, { recursive: true });
  const file = resolve(directory, 'live-semantic.json'); await writeFile(file, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ file, liveCases: report.cases.length, matched: report.cases.filter(item => item.matchesExpected).length, error: report.error ?? null }));
  if (report.error || report.cases.some(item => !item.matchesExpected)) process.exitCode = 1;
}
