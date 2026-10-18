import { runTsc } from '../scripts/run-tsc.mjs';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = dirname(fileURLToPath(import.meta.url));
const destination = resolve(process.argv[2] || resolve(root, '.build'));
rmSync(destination, { recursive: true, force: true });
runTsc(['-p', resolve(root, 'tsconfig.json'), '--outDir', destination], { stdio: 'inherit' });
function patch(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) patch(path);
    else if (entry.name.endsWith('.js')) writeFileSync(path, readFileSync(path, 'utf8').replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_, a, b, c) => `${a}${b.endsWith('.js') ? b : b + '.js'}${c}`));
  }
}
patch(destination);
cpSync(resolve(root, 'public'), destination, { recursive: true });
// Runtime media is selected explicitly; pending edits and rejected sources stay outside builds.
const cinematicMedia = JSON.parse(readFileSync(resolve(root, 'public/video/media-manifest.json'), 'utf8'));
const cinematicConfig = JSON.parse(readFileSync(resolve(root, 'public/cinematics.json'), 'utf8'));
const configuredVideoUrls = new Set(Object.values(cinematicConfig).flat().map(clip => clip.src));
const mediaUrls = new Set(cinematicMedia.clips.map(clip => clip.url));
for (const url of configuredVideoUrls) if (!mediaUrls.has(url)) throw new Error(`Missing cinematic media: ${url}`);
for (const clip of cinematicMedia.clips) {
  if (!configuredVideoUrls.has(clip.url)) throw new Error(`Unused cinematic media: ${clip.url}`);
  const mediaRoot = resolve(root, '../../video/current');
  const original = resolve(root, clip.source);
  if (!original.startsWith(mediaRoot + sep) || !/^\/video\/current\/[^/]+\.mp4$/.test(clip.url)) throw new Error(`Invalid cinematic media path: ${clip.url}`);
  const target = resolve(destination, '.' + clip.url);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(original, target);
}
const source = readFileSync(resolve(root, '../../content/chapters/wuzhang/chapter.json'));
mkdirSync(resolve(destination, 'story'), { recursive: true });
writeFileSync(resolve(destination, 'story/chapter.json'), source);
cpSync(resolve(root, '../../content/chapters/wuzhang/endings.json'), resolve(destination, 'story/endings.json'));
writeFileSync(resolve(destination, 'story/manifest.json'), JSON.stringify({ contentVersion: createHash('sha256').update(source).digest('hex') }));
const visuals = JSON.parse(readFileSync(resolve(root, 'visual-assets.json'), 'utf8'));
const visualManifest = { version: visuals.version, characters: {}, scenes: {}, cinematics: {}, ui: {}, fallbackCharacters: visuals.fallbackCharacters, missing: [] };
mkdirSync(resolve(destination, 'media'), { recursive: true });
for (const kind of ['characters', 'scenes', 'cinematics', 'ui']) {
  for (const [id, relative] of Object.entries(visuals[kind] ?? {})) {
    const original = resolve(root, visuals.sourceRoot, relative);
    if (!existsSync(original)) { visualManifest.missing.push(`${kind}/${id}`); continue; }
    const extension = relative.endsWith('.svg') ? 'svg' : 'png';
    const filename = `${kind}-${id}.${extension}`;
    cpSync(original, resolve(destination, 'media', filename));
    visualManifest[kind][id] = `/media/${filename}`;
  }
}
writeFileSync(resolve(destination, 'media/manifest.json'), JSON.stringify(visualManifest, null, 2));
console.log(`HTML 试玩已编译，采用 ${visuals.version} 资产。待补素材：${visualManifest.missing.join('、') || '无'}。`);
