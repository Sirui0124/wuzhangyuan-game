import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Publish the same rescue client into the game; the independent preview keeps its own saves. */
export function publishRescue(destination) {
  const home = dirname(fileURLToPath(import.meta.url));
  const build = spawnSync(process.execPath, [resolve(home, 'build.mjs')], { stdio: 'inherit', windowsHide: true });
  if (build.status !== 0) throw new Error('夷陵营救构建失败');
  const target = resolve(destination, 'yiling-rescue'); mkdirSync(target, { recursive: true });
  cpSync(resolve(home, 'public'), target, { recursive: true });
  for (const file of ['app.js', 'result-handoff.js', 'selection-view.js']) cpSync(resolve(home, '.build', file), resolve(target, file));
  cpSync(resolve(home, '../../source-art/visuals/runtime/scenes/yiling/yiling_reception_camp-v1.png'), resolve(target, 'background.png'));
  cpSync(resolve(target, 'art/yiling-retreat-map-v1.png'), resolve(target, 'art/retreat-map.png'));
  mkdirSync(resolve(target, 'portraits'), { recursive: true });
  for (const id of ['liu', 'clerk', 'attendant', 'boat']) cpSync(resolve(target, `art/portraits/${id}-v1.png`), resolve(target, `portraits/${id}.png`));
  for (const file of ['index.html', 'app.js', 'style.css', 'chapter-ui.css']) {
    let text = readFileSync(resolve(target, file), 'utf8');
    for (const path of ['/style.css', '/chapter-ui.css', '/app.js', '/background.png', '/art/retreat-map.png', '/portraits/']) text = text.replaceAll(path, '/yiling-rescue' + path);
    text = text.replaceAll('/shared/dialogue-ink.css', '/dialogue-ink.css').replaceAll('/shared/thought-final.css', '/thought-final.css');
    if (file === 'app.js') text = text.replaceAll('/api/', '/api/yiling-rescue/');
    if (file === 'index.html') text = text.replace('｜独立试玩', '');
    writeFileSync(resolve(target, file), text);
  }
}
