// Uses the configured local model only when explicitly run with --live. Never reads player saves.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dialogueFixtures } from './dialogue-fixtures.mjs';
if (!process.argv.includes('--live')) throw Error('Pass --live to test the configured real model');
const root = resolve(process.argv[2] || 'GameStarter/web-demo/.build');
const output = resolve('outputs/expression-refactor-20261023');
mkdirSync(output, { recursive: true });
const health = await (await fetch('http://127.0.0.1:8787/health')).json();
if (!health.configured) throw Error('Local model is not configured');
const { expressionAgents } = await import(pathToFileURL(resolve(root, 'GameStarter/web-demo/src/expression-agent.js')));
const { GameApi } = await import(pathToFileURL(resolve(root, 'GameStarter/assets/scripts/GameApi.js')));
const fixtures = await dialogueFixtures(root), api = new GameApi(), calls = [];
const agent = expressionAgents({ respond: async (request, ...args) => {
  const response = await api.respond(request, ...args);
  calls.push({ request, response: response.text });
  return response;
} });
const cases = [
  { id: 'screenshot-first', ids: ['T01', 'T03'], stage: 'first', words: '', branch: 'b' },
  { id: 'screenshot-consent', ids: ['C06', 'C08', 'C01'], stage: 'authorized', words: '' },
  { id: 'historical-plan-with-consent', ids: ['C06', 'C07', 'R02', 'C08'], stage: 'authorized', words: '' },
  { id: 'consent-not-selected', ids: ['C06', 'C07', 'R02'], stage: 'authorized', words: '' },
  { id: 'preserve-player-intent', ids: ['T01', 'T03'], stage: 'first', words: '我去报，你别闯。' },
  { id: 'preserve-sourced-detail', ids: ['C03'], stage: 'authorized', words: '将军，今夜号角响过，敌军却没退。' },
  { id: 'prior-run-memory', ids: ['C05', 'C06'], stage: 'authorized', words: '' },
  { id: 'reject-invented-fact', ids: ['T01', 'T03'], stage: 'first', words: '姜维已经答应了，丞相也准您入帐。', blocked: true },
];
const results = [];
for (const item of cases) {
  const input = await fixtures.polishInput(item.stage, item.ids, item.words, item.branch);
  const offset = calls.length, started = Date.now();
  try {
    const result = await agent.generate(input, new AbortController().signal);
    results.push({ id: item.id, status: 'generated', expected: item.blocked ? 'blocked' : 'generated', input, result });
  } catch (error) {
    results.push({ id: item.id, status: error.name === 'ExpressionSafetyError' ? 'blocked' : 'error',
      expected: item.blocked ? 'blocked' : 'generated', input, error: error.message });
  }
  Object.assign(results.at(-1), { ms: Date.now() - started, calls: calls.slice(offset) });
  const { input: ignored, calls: ignoredCalls, ...summary } = results.at(-1);
  console.log(JSON.stringify(summary));
  writeFileSync(resolve(output, 'live-model.json'), JSON.stringify({ model: health.model, results }, null, 2));
}
if (results.some(item => item.status !== item.expected)) process.exitCode = 1;
