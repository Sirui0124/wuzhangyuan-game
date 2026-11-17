import test from 'node:test';
import assert from 'node:assert/strict';
import { indexStoryGraph } from '../web-demo/.build/GameStarter/web-demo/src/session/story-graph.js';

test('shared graph accepts both chapter route shapes, loops and preserved historical nodes', () => {
  const nodes = [{id:'start',routes:['choice',{next:'end'}]}, {id:'choice',options:[{id:'again',next:'start'},{id:'finish',next:'end'}]}, {id:'end',retry:'choice'}, {id:'historical'}];
  assert.equal(indexStoryGraph(nodes, 'start', '测试').get('historical'), nodes[3]);
});
test('graph rejects missing destinations, duplicate options, missing entry and invalid retry', () => {
  for (const nodes of [[{id:'start',next:''}], [{id:'start',next:'gone'}], [{id:'start',routes:[{next:'gone'}]}],
    [{id:'start',retry:'gone'}], [{id:'start'},{id:'start'}], [{id:'start',options:[{id:'x',next:'start'},{id:'x',next:'start'}]}]]) {
    assert.throws(() => indexStoryGraph(nodes, 'start', '测试'));
  }
  assert.throws(() => indexStoryGraph([{id:'other'}], 'start', '测试'), /缺少入口/);
});
