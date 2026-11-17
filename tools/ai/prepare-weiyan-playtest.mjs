import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dialogueFixtures } from './dialogue-fixtures.mjs';

/** Build-only, factual checkpoints. Runtime still uses the configured real AI. */
export async function prepareWeiyanPlaytest(buildRoot) {
  const fixtures = await dialogueFixtures(buildRoot);
  const artDirectory = resolve(buildRoot, 'art-review');
  mkdirSync(artDirectory, { recursive: true });
  writeFileSync(resolve(artDirectory, 'thought-playtest.json'), (await fixtures.thoughts()).serialize());
  const directory = resolve(buildRoot, 'playtest');
  mkdirSync(directory, { recursive: true });
  for (const [name, session] of [
    ['weiyan-first', fixtures.first()],
    ['weiyan-second', await fixtures.authorized()],
  ]) writeFileSync(resolve(directory, `${name}.json`), session.serialize());
}
