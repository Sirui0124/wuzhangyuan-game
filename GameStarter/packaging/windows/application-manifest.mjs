import { readdirSync, lstatSync, readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const project = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(project, '../../..');
const output = resolve(workspace, process.argv[2] || 'outputs/windows-release-20261027-1630');
const applicationRoot = resolve(output, 'win-unpacked');
const slash = value => value.replaceAll('\\', '/');
const digest = value => createHash('sha256').update(value).digest('hex');

function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
        const path = resolve(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`Unexpected link in installed application tree: ${path}`);
        return entry.isDirectory() ? walk(path) : [path];
    });
}
async function hashFile(path) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return hash.digest('hex');
}

const files = [];
for (const path of walk(applicationRoot)) {
    files.push({ installPath: slash(relative(applicationRoot, path)), bytes: lstatSync(path).size, sha256: await hashFile(path) });
}
const manifest = { schemaVersion: 1, createdAt: new Date().toISOString(), platform: 'win32-x64', source: slash(applicationRoot),
    scope: 'Entire packaged application tree; excludes the setup installer and validation evidence outside win-unpacked.',
    totals: { files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }, files };
writeFileSync(resolve(output, 'application-files.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(resolve(output, 'application-files.txt'), files.map(file => `${file.installPath}\t${file.bytes}\t${file.sha256}`).join('\n') + '\n');

const payload = JSON.parse(readFileSync(resolve(output, 'payload-manifest.json'), 'utf8'));
const actual = new Map(files.map(file => [file.installPath, file]));
const payloadPaths = new Set(payload.files.map(file => file.destination));
const mismatches = [];
for (const expected of payload.files) {
    const entry = actual.get(expected.destination);
    if (!entry || entry.bytes !== expected.bytes || entry.sha256 !== expected.sha256) mismatches.push({ installPath: expected.destination, kind: !entry ? 'missing' : 'size-or-hash-mismatch' });
}
const extraPayloadFiles = files.filter(file => file.installPath.startsWith('resources/game/') && !payloadPaths.has(file.installPath)).map(file => file.installPath);
const forbiddenNames = files.filter(file => /(^|\/)\.(?:env(?:\.|$)|git(?:\/|$)|cache(?:\/|$))|(?:^|\/)[^/]*credentials[^/]*|\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(file.installPath)).map(file => file.installPath);

const archive = resolve(applicationRoot, 'resources/app.asar');
const wrapperAllowlist = new Set(['main.cjs', 'backend-child.cjs', 'package.json']);
const archiveFiles = [], archiveUnexpected = [], wrapperSourceMismatches = [];
for (const item of asar.listPackage(archive)) {
    const name = slash(item).replace(/^\/+/, '');
    const info = asar.statFile(archive, name, false);
    if (info.files) continue;
    if (info.link) { archiveUnexpected.push(name + ' (link)'); continue; }
    const content = asar.extractFile(archive, name);
    archiveFiles.push({ path: name, bytes: content.length, sha256: digest(content) });
    if (!wrapperAllowlist.has(name)) archiveUnexpected.push(name);
    if (['main.cjs', 'backend-child.cjs'].includes(name) && digest(readFileSync(resolve(project, name))) !== digest(content)) wrapperSourceMismatches.push(name);
}
for (const name of wrapperAllowlist) if (!archiveFiles.some(file => file.path === name)) archiveUnexpected.push(name + ' (missing)');
const packagedMetadata = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
const metadataKeys = Object.keys(packagedMetadata);
const unexpectedMetadata = metadataKeys.filter(key => !['name', 'version', 'private', 'description', 'author', 'license', 'main', 'dependencies', 'devDependencies', 'scripts', 'build'].includes(key));
const requiredRuntime = ['Wuzhangyuan.exe', 'LICENSE.electron.txt', 'LICENSES.chromium.html', 'resources/app.asar', 'ffmpeg.dll', 'icudtl.dat', 'resources.pak', 'snapshot_blob.bin', 'v8_context_snapshot.bin'];
const missingRuntime = requiredRuntime.filter(path => !actual.has(path));
const passed = ![mismatches, extraPayloadFiles, forbiddenNames, archiveUnexpected, wrapperSourceMismatches, unexpectedMetadata, missingRuntime].some(list => list.length);
const check = { schemaVersion: 1, checkedAt: new Date().toISOString(), passed, readOnlyApplicationTree: true,
    applicationTotals: manifest.totals, payload: { expectedFiles: payload.files.length, checkedFiles: payload.files.length, mismatches, extraFiles: extraPayloadFiles },
    archive: { path: 'resources/app.asar', allowedFiles: [...wrapperAllowlist], files: archiveFiles, unexpected: archiveUnexpected, wrapperSourceMismatches, metadataKeys, unexpectedMetadata },
    runtime: { requiredFiles: requiredRuntime, missing: missingRuntime }, forbiddenNames };
writeFileSync(resolve(output, 'application-manifest-check.json'), JSON.stringify(check, null, 2) + '\n');
console.log(JSON.stringify({ passed, applicationTotals: manifest.totals, payloadFiles: payload.files.length, asarFiles: archiveFiles.map(file => file.path), mismatches, extraPayloadFiles, forbiddenNames, archiveUnexpected, wrapperSourceMismatches, unexpectedMetadata, missingRuntime }, null, 2));
if (!passed) process.exitCode = 1;
