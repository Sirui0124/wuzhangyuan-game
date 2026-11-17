const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');

// This runs after electron-builder copies resources and before it creates NSIS.
// A prepackaged build invokes the same guard explicitly, because afterPack is
// skipped by electron-builder when an existing application tree is supplied.
module.exports = async function verifyPayload({ stage, applicationRoot, report }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(stage, 'payload-manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Payload manifest is empty or invalid');
  const root = path.resolve(applicationRoot);
  const expected = new Set();
  const mismatches = [];
  for (const file of manifest.files) {
    const destination = file.destination.replaceAll('\\', '/');
    const absolute = path.resolve(root, destination);
    if (!destination.startsWith('resources/game/') || !absolute.startsWith(root + path.sep) || expected.has(destination)) throw new Error(`Unsafe or duplicate manifest destination: ${destination}`);
    expected.add(destination);
    if (!fs.existsSync(absolute)) { mismatches.push({ path: destination, reason: 'missing' }); continue; }
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) { mismatches.push({ path: destination, reason: 'not-a-regular-file' }); continue; }
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(absolute)) hash.update(chunk);
    if (stat.size !== file.bytes || hash.digest('hex') !== file.sha256) mismatches.push({ path: destination, reason: 'size-or-sha256-mismatch' });
  }
  const extras = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      const relative = path.relative(root, absolute).replaceAll('\\', '/');
      if (item.isSymbolicLink()) extras.push(relative + ' (link)');
      else if (item.isDirectory()) walk(absolute);
      else if (!expected.has(relative)) extras.push(relative);
    }
  }
  walk(path.join(root, 'resources/game'));
  let dependencyResolution;
  try {
    const resolved = createRequire(path.join(root, 'resources/game/GameStarter/server/server.mjs')).resolve('ws');
    dependencyResolution = { module: 'ws', path: resolved, bundled: resolved.startsWith(path.join(root, 'resources/game/node_modules/ws') + path.sep) };
  } catch (error) { dependencyResolution = { module: 'ws', bundled: false, error: error.code }; }
  const result = { checkedAt: new Date().toISOString(), passed: !mismatches.length && !extras.length && dependencyResolution.bundled,
    applicationRoot: root, expectedFiles: expected.size, checkedFiles: expected.size, mismatches, extraFiles: extras, dependencyResolution };
  if (report) fs.writeFileSync(report, JSON.stringify(result, null, 2) + '\n');
  if (!result.passed) throw new Error(`Payload verification failed; installer creation refused: ${mismatches.length} missing/changed files, ${extras.length} extras, bundled ws=${dependencyResolution.bundled}`);
  console.log(`Payload guard passed: ${expected.size} files match manifest; ws resolves inside the packaged application.`);
  return result;
};
