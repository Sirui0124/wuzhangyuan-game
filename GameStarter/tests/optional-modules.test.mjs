import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { characters } from '../web-demo/.build/GameStarter/web-demo/src/characters/catalog.js';
import { characterEntrances, encounteredCharacters } from '../web-demo/.build/GameStarter/web-demo/src/characters/encounters.js';
import { createEvaluationModule } from '../web-demo/.build/GameStarter/web-demo/src/modules/evaluation.js';
import { gameModules } from '../web-demo/.build/GameStarter/web-demo/src/modules/config.js';
import { aiEnabled, phoneEnabled } from '../web-demo/.build/GameStarter/web-demo/src/runtime-mode.js';
const json = file => JSON.parse(readFileSync(new URL(file, import.meta.url)));
const progress = (chapter, entered = [], completed = []) => ({ chapter, entered, completed, visible: true });
test('every entrance points to an existing live node and an illustrated profile', () => {
    const script = json('../../content/chapters/wuzhang/chapter-one.script.json');
    const flow = json('../../content/chapters/wuzhang/chapter-one.flow.json');
    const grain = [json('../../content/chapters/grain/chapter-two.films.json'), json('../../content/chapters/grain/chapter-two.playable.json')];
    const jieting = json('../../content/chapters/jieting/chapter-three.story.json');
    const nodes = { wuzhang: new Set([...script.rows.map(r => r.id), ...flow.cinematics.map(c => 'cinematic:' + c.id)]), grain: new Set(grain.flatMap(s => s.nodes.map(n => n.id))), jieting: new Set(jieting.nodes.map(n => n.id)) };
    const art = json('../web-demo/visual-assets.json').characters;
    for (const entry of characterEntrances) {
        assert.ok(nodes[entry.chapter].has(entry.node), entry.node);
        for (const id of entry.people) { assert.ok(characters.some(c => c.id === id), id); assert.ok(art[id], id); }
    }
    assert.equal(new Set(characters.map(c => c.id)).size, characters.length);
    assert.ok(characters.every(c => characterEntrances.some(e => e.people.includes(c.id))));
});
test('no introduction before appearance; mentioning someone or entering recognition film is insufficient', () => {
    assert.deepEqual(encounteredCharacters(progress('grain', ['V01'])), []);
    assert.deepEqual(encounteredCharacters(progress('grain', ['V02'], ['V01'])), []);
    assert.deepEqual(encounteredCharacters(progress('grain', ['CH2-LY02-002'], ['V01', 'V02'])), ['gouan']);
    assert.ok(!encounteredCharacters(progress('grain', ['V09'], ['V01', 'V02', 'V05'])).includes('liyan'));
    assert.ok(encounteredCharacters(progress('grain', ['V25-01'], ['V24'])).includes('liyan'));
});
test('parallel order, branch omissions, old saves and repeat encounters project only actual progress', () => {
    assert.deepEqual(encounteredCharacters(progress('wuzhang', ['D07'])), ['relay']);
    const value = progress('wuzhang', ['D01'], ['D07', 'A-42']);
    const before = JSON.stringify(value);
    assert.deepEqual(encounteredCharacters(value).sort(), ['guard', 'relay']);
    assert.equal(JSON.stringify(value), before);
    assert.deepEqual(encounteredCharacters(progress('wuzhang')), []);
    assert.ok(!encounteredCharacters(progress('grain', ['V41E'], ['V02', 'V05'])).includes('old-woman'));
});
test('AI disabled uses injected local provider; remote failure never silently falls back', async () => {
    let enabled = false, calls = 0;
    const module = createEvaluationModule({ enabled: () => enabled, online: async () => { calls++; throw Error('remote failed'); }, offline: async x => x + 1 });
    assert.equal(await module.evaluate(2, new AbortController().signal), 3); assert.equal(calls, 0);
    enabled = true; await assert.rejects(module.evaluate(2, new AbortController().signal), /remote failed/); assert.equal(calls, 1);
    module.dispose(); await assert.rejects(module.evaluate(2, new AbortController().signal), { name: 'AbortError' });
});
test('unloading rejects even a provider that ignores cancellation', async () => {
    let finish;
    const module = createEvaluationModule({ enabled: () => true, online: () => new Promise(resolve => { finish = resolve; }) });
    const result = module.evaluate({}, new AbortController().signal);
    module.dispose(); finish('stale');
    await assert.rejects(result, { name: 'AbortError' });
});
test('deployment switches enforce module boundaries independently of stored mode', () => {
    try { gameModules.phone = false; assert.equal(phoneEnabled('ai-phone'), false); assert.equal(aiEnabled('ai'), true);
        gameModules.aiEvaluation = false; assert.equal(aiEnabled('ai-phone'), false); assert.equal(phoneEnabled('ai-phone'), false);
    } finally { gameModules.phone = true; gameModules.aiEvaluation = true; }
});
