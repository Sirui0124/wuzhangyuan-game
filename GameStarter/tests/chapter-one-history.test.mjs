import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHistoryVariantCases } from './history-variant-fixtures.mjs';

test('history retains the displayed A-42 branch across new/legacy saves and rewind', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const build = process.env.GAME_TEST_BUILD ?? resolve(root, 'GameStarter/web-demo/.build');
  const result = await runHistoryVariantCases(build);
  assert.equal(result.passed, true);
  assert.deepEqual(result.cases.map(item => item.branch), ['a', 'b']);
});
