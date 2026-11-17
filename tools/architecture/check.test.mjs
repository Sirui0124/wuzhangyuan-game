import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { analyzeDependencies, imports, subtitleStyleErrors } from './check.mjs';

test('later chapters cannot replace the shared chapter-one subtitle presentation', () => {
  for (const file of ['grain-films.css', 'chapter-three.css', 'nested/scene.css', 'chapter-three.html']) {
    assert.equal(subtitleStyleErrors(`GameStarter/web-demo/public/${file}`, '.cinema-frame video::cue { font:24px sans-serif }').length, 1);
  }
  assert.equal(subtitleStyleErrors('GameStarter/web-demo/src/chapters/three/view.ts', 'const css = `video::cue { font-size:24px }`;').length, 1);
  assert.equal(subtitleStyleErrors('GameStarter/web-demo/public/subtitles.css', 'video::cue { color:#fff }').length, 0);
  assert.equal(subtitleStyleErrors('GameStarter/web-demo/public/chapter-three.css', '/* Reuse ::cue from the shared file. */ .document { font-size:24px }').length, 0);
});

const directory = resolve('/architecture-fixture/GameStarter/web-demo/src');
const inspect = sources => analyzeDependencies(new Map(Object.entries(sources)
  .map(([path, text]) => [resolve(directory, path), text]))).errors;

test('direct chapter imports are rejected with their dependency route', () => {
  const errors = inspect({
    'chapters/one/session.ts': "import { run } from '../two/session'; run();",
    'chapters/two/session.ts': 'export const run = () => {};',
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /chapters\/one\/session\.ts → .*chapters\/two\/session\.ts: 章节/);
});

test('arbitrary facades cannot conceal another chapter, including type-only routes', () => {
  for (const typeOnly of [false, true]) {
    const first = typeOnly ? "import type { State } from '../../bridge';" : "import { State } from '../../bridge';";
    const bridge = typeOnly ? "export { type State } from './another-bridge';" : "export { State } from './another-bridge';";
    const errors = inspect({
      'chapters/one/session.ts': first,
      'bridge.ts': bridge,
      'another-bridge.ts': "export { State } from './chapters/two/state';",
      'chapters/two/state.ts': 'export class State {}',
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /bridge\.ts → .*another-bridge\.ts → .*chapters\/two\/state\.ts: 章节/);
  }
});

test('shared contracts and legacy code cannot reach chapter implementations through facades', () => {
  for (const [owner, message] of [['session/shared.ts', /共享会话/], ['legacy/app.ts', /旧版不得/]]) {
    const errors = inspect({
      [owner]: "import type { State } from '../bridge';",
      'bridge.ts': "export type { State } from './bridge-two';",
      'bridge-two.ts': "export type { State } from './chapters/one/state';",
      'chapters/one/state.ts': 'export type State = { phase: string };',
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0], message);
  }
});

test('the legacy entry exception does not let current code import legacy through it', () => {
  const errors = inspect({
    'game/main.ts': "import '../app';",
    'app.ts': "import './legacy/app';",
    'legacy/app.ts': 'export {};',
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /game\/main\.ts → .*app\.ts → .*legacy\/app\.ts: 当前代码/);
});

test('same-chapter facades and shared dependencies remain legal', () => {
  assert.deepEqual(inspect({
    'chapters/one/session.ts': "import { value } from '../../bridge'; import type { State } from '../../session/shared';",
    'bridge.ts': "export { value } from './chapters/one/model';",
    'chapters/one/model.ts': 'export const value = 1;',
    'session/shared.ts': 'export type State = { chapterId: string };',
  }), []);
});

test('named type re-exports never create runtime cycles', () => {
  assert.deepEqual(imports('types.ts', "export { type State } from './model';"), [
    { specifier: './model', typeOnly: true },
  ]);
  assert.deepEqual(inspect({
    'types.ts': "export { type State } from './model';",
    'model.ts': "import { type State as Previous } from './types'; export type State = { previous?: Previous };",
  }), []);
});

test('a mixed type/value re-export still participates in runtime cycles', () => {
  const errors = inspect({
    'bridge.ts': "export { type State, value } from './model';",
    'model.ts': "import { value as previous } from './bridge'; export const value = previous; export type State = {};",
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /运行时循环依赖/);
});

test('fixed template dynamic imports are inspected and can reveal a runtime cycle', () => {
  assert.deepEqual(imports('entry.ts', 'const load = () => import(`./model`);'), [
    { specifier: './model', typeOnly: false },
  ]);
  const errors = inspect({
    'entry.ts': 'export const load = () => import(`./model`);',
    'model.ts': "import { load } from './entry'; export { load };",
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /运行时循环依赖: .*entry\.ts → .*model\.ts → .*entry\.ts/);
});

test('cycles terminate boundary traversal and are reported independently', () => {
  const errors = inspect({
    'one.ts': "export * from './two';",
    'two.ts': "export * from './three';",
    'three.ts': "export * from './one';",
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /运行时循环依赖/);
});

test('import type expressions also carry chapter ownership without runtime edges', () => {
  const errors = inspect({
    'session/shared.ts': "export type State = import('../bridge').State;",
    'bridge.ts': "export type State = import('./chapters/one/state').State;",
    'chapters/one/state.ts': 'export type State = { phase: string };',
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /共享会话契约不得/);
  assert.equal(errors.some(error => error.includes('运行时循环')), false);
});
