import { mkdirSync, openSync, closeSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { root, cache, origin, port, workspace, identity, health } from './config.mjs';

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('请安装 Node.js 22 或更新版本。');
  let status = await health().catch(() => null);
  if (status && (status.identity !== identity || status.workspace !== workspace)) throw new Error(`${origin} 已被其他项目使用。请先关闭对应项目，存档地址不会自动更改。`);
  if (process.argv.includes('--stop')) {
    if (!status) { console.log('本地游戏服务未运行。'); return; }
    const control = JSON.parse(readFileSync(resolve(cache, 'control.json'), 'utf8'));
    if (control.workspace !== workspace || control.port !== port) throw new Error('本地服务标识不匹配。');
    const response = await fetch(`${origin}/__local/stop`, { method: 'POST', headers: { 'X-Local-Token': control.token }, signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error('服务未接受停止请求，请检查本地日志。');
    for (let tries = 0; tries < 60; tries++) {
      await delay(250);
      if (!await health().catch(() => null)) { console.log('本地游戏服务已关闭，存档保留。'); return; }
    }
    throw new Error('已发送停止请求；服务仍在结束当前操作，请稍后检查。');
  }
  // Fail clearly without an install or global PATH modification.
  try { readFileSync(resolve(root, 'node_modules/typescript/bin/tsc')); }
  catch { throw new Error('请先在工作区根目录运行 npm.cmd ci，再双击启动。'); }
  if (!status) {
    const available = await new Promise(accept => {
      const probe = createServer(); probe.once('error', () => accept(false));
      probe.listen(port, '127.0.0.1', () => probe.close(() => accept(true)));
    });
    if (!available) {
      // A second double-click can arrive while the first process is still binding its server.
      for (let tries = 0; tries < 12; tries++) {
        await delay(250);
        status = await health().catch(() => null);
        if (status?.identity === identity && status.workspace === workspace) break;
      }
      if (status?.identity !== identity || status.workspace !== workspace) throw new Error(`${origin} 的端口被占用，且不是此项目的启动服务。请先关闭旧的试玩服务；不会结束不明进程。`);
    }
    if (!status) {
    mkdirSync(cache, { recursive: true });
    const log = openSync(resolve(cache, 'launcher.log'), 'a');
    const child = spawn(process.execPath, [resolve(root, 'tools/local-game/server.mjs')], {
      cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log],
    });
    let startError;
    child.on('error', error => { startError = error; });
    child.unref(); closeSync(log);
    for (let tries = 0; tries < 40; tries++) {
      if (startError) throw startError;
      status = await health().catch(() => null);
      if (status) break;
      await delay(250);
    }
    if (!status || status.identity !== identity || status.workspace !== workspace) throw new Error('启动未完成，详情见 .cache/local-game/launcher.log。');
    }
  }
  console.log(`本地入口：${origin}/local/\n完整游戏：${origin}/\n重复启动会复用同一服务。`);
  if (process.argv.includes('--no-open')) return;
  const url = `${origin}/local/`;
  const command = process.platform === 'win32' ? 'powershell.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['-NoProfile', '-NonInteractive', '-Command', 'Start-Process -FilePath $env:WUZHANG_OPEN_URL'] : [url];
  await new Promise((accept, reject) => {
    const browser = spawn(command, args, { windowsHide: true, env: { ...process.env, WUZHANG_OPEN_URL: url }, stdio: 'ignore' });
    browser.on('error', reject); browser.on('exit', code => code === 0 ? accept() : reject(new Error(`请在浏览器打开 ${url}`)));
  });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
