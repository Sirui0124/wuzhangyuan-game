import { runTsc } from '../scripts/run-tsc.mjs';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { prepareWeiyanPlaytest } from '../../tools/ai/prepare-weiyan-playtest.mjs';
import { checkSubtitles } from '../../tools/video/subtitles.mjs';
import { writeChapterAccess } from '../scripts/chapter-access-manifest.mjs';
import { publishRescue } from '../../demos/yiling-rescue/publish.mjs';
import { publishCommandMap } from '../../demos/yiling-ui-prototype-v1/publish.mjs';
import { validateMedia } from '../../tools/video/media.mjs';
const subtitleAudit = checkSubtitles();
const root = dirname(fileURLToPath(import.meta.url));
const cinematicMedia = JSON.parse(readFileSync(resolve(root, 'public/video/media-manifest.json'), 'utf8'));
const cinematicConfig = JSON.parse(readFileSync(resolve(root, 'public/cinematics.json'), 'utf8'));
validateMedia(cinematicConfig, cinematicMedia, root);
const destination = resolve(process.argv[2] || resolve(root, '.build'));
rmSync(destination, { recursive: true, force: true });
runTsc(['-p', resolve(root, 'tsconfig.json'), '--outDir', destination], { stdio: 'inherit' });
function patch(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) patch(path);
    else if (entry.name.endsWith('.js')) writeFileSync(path, readFileSync(path, 'utf8')
      .replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_, a, b, c) => `${a}${b.endsWith('.js') ? b : b + '.js'}${c}`)
      .replace(/(import\(['"])(\.[^'"]+)(['"]\))/g, (_, a, b, c) => `${a}${b.endsWith('.js') ? b : b + '.js'}${c}`));
  }
}
patch(destination);
const publicRoot = resolve(root, 'public');
const publishedSubtitles = new Set(subtitleAudit.subtitlePaths);
cpSync(publicRoot, destination, { recursive: true, filter: source => {
  const url = '/' + relative(publicRoot, source).split(sep).join('/');
  if (/^\/voice-(demo|casting|clone)\.html$/.test(url)) return false;
  return !url.endsWith('.vtt') || publishedSubtitles.has(url);
} });
// The generated tree is ESM; keep this scoped to build output, not the Cocos project.
writeFileSync(resolve(destination, 'package.json'), JSON.stringify({ private: true, type: 'module' }) + '\n');
publishRescue(destination);
publishCommandMap(destination);
// Runtime media is selected explicitly; pending edits and rejected sources stay outside builds.
for (const clip of cinematicMedia.clips) {
  const original = resolve(root, clip.source);
  const target = resolve(destination, '.' + clip.url);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(original, target);
}
mkdirSync(resolve(destination, 'story'), { recursive: true });
writeChapterAccess(resolve(root,'../..'), destination);
cpSync(resolve(root, '../../content/chapters/wuzhang/endings.json'), resolve(destination, 'story/endings.json'));
for (const file of ['chapter-two.films.json','chapter-two.films-rubric.json']) cpSync(resolve(root,'../../content/chapters/grain',file),resolve(destination,'story',file));
cpSync(resolve(root,'../../content/chapters/jieting/chapter-three.story.json'),resolve(destination,'story/chapter-three.story.json'));
cpSync(resolve(root,'../../content/chapters/jingzhou/chapter-five.reports.json'),resolve(destination,'story/chapter-five.reports.json'));
cpSync(resolve(root,'../../content/chapters/luofengpo/chapter-seven.story.json'),resolve(destination,'story/chapter-seven.story.json'));
const scriptSource = readFileSync(resolve(root, '../../content/chapters/wuzhang/chapter-one.script.json'));
const flowSource = readFileSync(resolve(root, '../../content/chapters/wuzhang/chapter-one.flow.json'));
const branchSource = readFileSync(resolve(root, '../../content/chapters/wuzhang/chapter-one.branch.json'));
writeFileSync(resolve(destination, 'story/chapter-one.branch.json'), branchSource);
writeFileSync(resolve(destination, 'story/chapter-one.script.json'), scriptSource);
writeFileSync(resolve(destination, 'story/chapter-one.flow.json'), flowSource);
cpSync(resolve(root, '../../content/chapters/grain/chapter-two.playable.json'), resolve(destination, 'story/chapter-two.playable.json'));
cpSync(resolve(root, '../../content/chapters/grain/chapter-two.rubric.json'), resolve(destination, 'story/chapter-two.rubric.json'));
writeFileSync(resolve(destination, 'story/session-manifest.json'), JSON.stringify({ contentVersion: createHash('sha256').update(scriptSource).update(flowSource).update(branchSource).digest('hex') }));
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
await prepareWeiyanPlaytest(destination);
console.log(`HTML 试玩已编译，采用 ${visuals.version} 资产。待补素材：${visualManifest.missing.join('、') || '无'}。`);
