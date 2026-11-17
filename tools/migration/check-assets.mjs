import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { checkSubtitles } from '../video/subtitles.mjs';
import { validateMedia } from '../video/media.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const build = resolve(root, process.env.GAME_BUILD || 'GameStarter/web-demo/.build');
const errors = []; let checks = 0;
const subtitleAudit = checkSubtitles();
const subtitleCatalog = JSON.parse(readFileSync(resolve(root, 'video/subtitles/catalog.json')));
assert.deepEqual(readdirSync(resolve(build, 'video/subtitles')).filter(name => name.endsWith('.vtt')).sort(),
  subtitleAudit.subtitlePaths.map(url => url.split('/').at(-1)).sort(), 'Published subtitles must match the active film list');
for (const entry of subtitleCatalog.entries) {
  const path = resolve(build, '.' + entry.subtitles);
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), entry.subtitleSha256, `Built subtitle hash: ${entry.subtitles}`);
}
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
  const pathname = decodeURIComponent(url.split(/[?#]/)[0]);
  exactFile(resolve(build, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname)));
}
const sourceVisuals = JSON.parse(readFileSync(resolve(root,'GameStarter/web-demo/visual-assets.json')));
for (const type of ['characters','scenes','cinematics','ui']) for (const file of Object.values(sourceVisuals[type])) exactFile(resolve(root,'GameStarter/web-demo',sourceVisuals.sourceRoot,file));
// Named expression aliases belong to one person; independent people may not share art.
const personForArt = new Map();
for (const [person, expressions] of Object.entries(sourceVisuals.characterExpressions ?? {})) {
  personForArt.set(person, person);
  for (const id of Object.values(expressions)) personForArt.set(id, person);
}
const characterHashes = new Map();
for (const [id, file] of Object.entries(sourceVisuals.characters)) {
  const person = personForArt.get(id) ?? id;
  const path = resolve(root,'GameStarter/web-demo',sourceVisuals.sourceRoot,file);
  if (!existsSync(path)) continue;
  const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
  const previous = characterHashes.get(hash);
  assert.ok(!previous || previous.person === person, `Independent characters share a portrait: ${previous?.id} / ${id}`);
  characterHashes.set(hash, { id, person });
}
const manifest = JSON.parse(readFileSync(resolve(root,'GameStarter/web-demo/public/video/media-manifest.json')));
validateMedia(JSON.parse(readFileSync(resolve(root,'GameStarter/web-demo/public/cinematics.json'))), manifest, resolve(root,'GameStarter/web-demo'));
assert.deepEqual(readdirSync(resolve(build, 'video/current')).filter(name => name.endsWith('.mp4')).sort(),
  manifest.clips.map(clip => clip.url.split('/').at(-1)).sort(), 'Published videos must match the active film list exactly');
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
