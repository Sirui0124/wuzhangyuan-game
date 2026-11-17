import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { LocalBuilds } from './builds.mjs';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { root, workspace, identity } from './config.mjs';

async function fixture(t, build) {
  const cache = await mkdtemp(resolve(tmpdir(), 'wuzhang-local-中文 '));
  t.after(async () => {
    const actual = await realpath(cache), parent = await realpath(tmpdir());
    assert.ok(actual.startsWith(parent + sep));
    assert.ok(actual.split(sep).at(-1).startsWith('wuzhang-local-中文 '));
    await rm(actual, { recursive: true, force: true });
  });
  const builds = new LocalBuilds(cache, build);
  await builds.init();
  return builds;
}
async function output(target, text) {
  await mkdir(resolve(target, 'story'), { recursive: true });
  await writeFile(resolve(target, 'index.html'), text);
  await writeFile(resolve(target, 'story/session-manifest.json'), JSON.stringify({ contentVersion: text }));
}

test('failed rebuild preserves the playable root and persists it across restart', async t => {
  let fail = false;
  const builds = await fixture(t, async target => {
    await output(target, fail ? 'partial' : 'playable');
    if (fail) throw new Error('compile failure');
  });
  await builds.request();
  const first = builds.current;
  fail = true; await builds.request();
  assert.equal(builds.phase, 'error'); assert.equal(builds.current, first);
  assert.equal(await readFile(resolve(builds.path(first.id), 'index.html'), 'utf8'), 'playable');
  const restart = new LocalBuilds(builds.cache, () => {}); await restart.init();
  assert.deepEqual(restart.current, first);
  assert.equal((await readdir(resolve(builds.cache, 'builds'))).length, 1);
});

test('edits during build are coalesced and only the completed final revision is promoted', async t => {
  let count = 0, release, started;
  const entered = new Promise(resolve => { started = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  const builds = await fixture(t, async target => {
    count++;
    if (count === 1) { started(); await barrier; }
    await output(target, `revision-${count}`);
  });
  const run = builds.request(); await entered;
  builds.request(); builds.request(); release();
  await run;
  assert.equal(count, 2); assert.equal(builds.current.contentVersion, 'revision-2');
  assert.equal((await readdir(resolve(builds.cache, 'builds'))).length, 1);
});

test('successful updates keep only current and previous build; cleanup rejects traversal', async t => {
  let count = 0;
  const builds = await fixture(t, target => output(target, String(++count)));
  await builds.request(); await builds.request(); await builds.request();
  assert.equal((await readdir(resolve(builds.cache, 'builds'))).length, 2);
  assert.equal(builds.current.contentVersion, '3');
  await assert.rejects(builds.remove('../source'), /Invalid local build identifier/);
});

test('the same HTTP address switches builds and continues serving after a failed build', async t => {
  let text = 'first';
  const builds = await fixture(t, target => {
    if (text === 'bad') throw new Error('bad');
    return output(target, text);
  });
  await builds.request();
  const server = createStaticServer({ root: () => builds.path(builds.current.id) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal(await (await fetch(url)).text(), 'first');
  text = 'second'; await builds.request();
  const response = await fetch(url);
  assert.equal(await response.text(), 'second'); assert.equal(response.headers.get('cache-control'), 'no-store');
  text = 'bad'; await builds.request();
  assert.equal(await (await fetch(url)).text(), 'second');
});

test('launcher rejects another workspace on the chosen port without stopping it', async t => {
  const server = createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ identity, workspace: 'another-project' })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const port = server.address().port;
  await assert.rejects(promisify(execFile)(process.execPath, [resolve(root, 'tools/local-game/launch.mjs'), '--no-open'], {
    cwd: tmpdir(), env: { ...process.env, DEMO_PORT: String(port) }, windowsHide: true,
  }), error => { assert.match(error.stderr, /其他项目/); return true; });
  assert.equal((await fetch(`http://127.0.0.1:${port}`)).status, 200);
});

test('launcher reuses a matching service from a working directory outside the Chinese project path', async t => {
  const server = createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ identity, workspace })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const port = server.address().port;
  const result = await promisify(execFile)(process.execPath, [resolve(root, 'tools/local-game/launch.mjs'), '--no-open'], {
    cwd: tmpdir(), env: { ...process.env, DEMO_PORT: String(port) }, windowsHide: true,
  });
  assert.match(result.stdout, /重复启动会复用/);
});
