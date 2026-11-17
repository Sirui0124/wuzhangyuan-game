import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dialogueFixtures } from '../ai/dialogue-fixtures.mjs';

/** Reach the actual acquisition windows without granting the target item. */
export async function prepareItemPlaytests(buildRoot) {
  const f = await dialogueFixtures(buildRoot);
  const cup = await f.thoughts();
  cup.closeNotes();
  if (!cup.move('camp_gate') || !cup.canPickUpCup()) throw new Error('Cup checkpoint unavailable');
  const gift = await f.thoughts();
  gift.think(); gift.continueThought(); gift.placeThought('C06');gift.placeThought('C07'); gift.think();
  if (!gift.followPlan()) throw new Error('Jiang gift checkpoint unavailable');
  while (gift.snapshot().lineIndex < gift.currentSection().rows.length - 1) gift.nextLine();
  const directory = resolve(buildRoot, 'playtest');
  mkdirSync(directory, { recursive: true });
  for (const [name, session] of [['item-headscarf', gift], ['item-cup', cup]]) {
    writeFileSync(resolve(directory, `${name}.json`), session.serialize());
  }
}
