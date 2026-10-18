import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateStory } from './validate-story.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = resolve(process.argv[2] || join(root,'content/chapters/wuzhang/chapter.json'));
try {
  const text = readFileSync(source,'utf8'), chapter = JSON.parse(text); validateStory(chapter);
  if (!/^[a-zA-Z0-9_-]+$/.test(chapter.id)) throw new Error('Unsafe chapter directory ID');
  const destination = process.argv[3] ? resolve(process.argv[3]) : join(root,'GameStarter/assets/resources/story');
  const dir = join(destination,chapter.id); mkdirSync(dir,{recursive:true});
  writeFileSync(join(dir,'chapter.json'), text.endsWith('\n') ? text : text+'\n');
  const version = createHash('sha256').update(text).digest('hex');
  writeFileSync(join(dir,'manifest.json'),JSON.stringify({schemaVersion:1,chapterId:chapter.id,contentVersion:version},null,2)+'\n');
  console.log(`Packed ${chapter.id}, version ${version}; existing .meta files preserved.`);
} catch(e) { console.error(e.message); process.exitCode=1; }
