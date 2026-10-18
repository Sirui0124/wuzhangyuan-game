import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const build = resolve(root, 'GameStarter/web-demo/.build');
const errors = []; let checks = 0;
function exactFile(path) {
  const rel = relative(root, path);
  if (rel.startsWith('..') || !existsSync(path)) { errors.push(`Missing/outside: ${rel}`); return; }
  let current = root;
  for (const part of rel.split(sep)) {
    if (!readdirSync(current).includes(part)) { errors.push(`Case mismatch: ${rel}`); return; }
    current = resolve(current, part);
  }
  if (!statSync(current).isFile()) errors.push(`Not a file: ${rel}`);
  checks++;
}
function urlFile(url) {
  if (!url || /^(?:https?:|data:|#)/.test(url)) return;
  exactFile(resolve(build, '.' + decodeURIComponent(url.split(/[?#]/)[0])));
}
const sourceVisuals = JSON.parse(readFileSync(resolve(root,'GameStarter/web-demo/visual-assets.json')));
for (const type of ['characters','scenes','cinematics','ui']) for (const file of Object.values(sourceVisuals[type])) exactFile(resolve(root,'GameStarter/web-demo',sourceVisuals.sourceRoot,file));
const manifest = JSON.parse(readFileSync(resolve(root,'GameStarter/web-demo/public/video/media-manifest.json')));
for (const clip of manifest.clips) {
  const source = resolve(root,'GameStarter/web-demo',clip.source);
  exactFile(source); urlFile(clip.url);
  assert.equal(createHash('sha256').update(readFileSync(source)).digest('hex'), clip.sha256, `Source hash: ${clip.url}`);
  assert.equal(createHash('sha256').update(readFileSync(resolve(build,'.'+clip.url))).digest('hex'), clip.sha256, `Built hash: ${clip.url}`);
}
const visuals = JSON.parse(readFileSync(resolve(build,'media/manifest.json')));
assert.deepEqual(visuals.missing, []);
for (const type of ['characters','scenes','cinematics','ui']) for (const url of Object.values(visuals[type])) urlFile(url);
const audio = JSON.parse(readFileSync(resolve(build,'audio/manifest.json')));
function checkSrc(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const [key,value] of Object.entries(obj)) if (key === 'src' && typeof value === 'string') urlFile(value); else checkSrc(value);
}
checkSrc(audio);
for (const url of Object.values(audio.sfx)) urlFile(url);
function walk(dir) {
  for (const item of readdirSync(dir,{withFileTypes:true})) {
    const file = resolve(dir,item.name);
    if (item.isDirectory()) walk(file);
    else if (item.name.endsWith('.css')) {
      for (const m of readFileSync(file,'utf8').matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) {
        const url = m[1]; if (/^(https?:|data:|#)/.test(url)) continue;
        if (url.startsWith('/')) urlFile(url); else exactFile(resolve(dirname(file),decodeURIComponent(url)));
      }
    } else if (item.name.endsWith('.html')) {
      for (const m of readFileSync(file,'utf8').matchAll(/(?:src|href)=["'](\/[^"']+)["']/g)) urlFile(m[1]);
    } else if (item.name.endsWith('.js')) {
      for (const m of readFileSync(file,'utf8').matchAll(/(?:from\s*|import\s*\()['"](\.[^'"]+)['"]/g)) exactFile(resolve(dirname(file),m[1]));
    }
  }
}
walk(build);
if (errors.length) throw new Error(errors.join('\n'));
console.log(JSON.stringify({passed:true,exactCaseFileChecks:checks,cinematicHashes:manifest.clips.length}));
