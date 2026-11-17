import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dialogueFixtures } from '../../tools/ai/dialogue-fixtures.mjs';
import { JietingSession, createJietingPlaytest } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-three/session.js';
const story = JSON.parse(readFileSync('content/chapters/jieting/chapter-three.story.json','utf8'));
test('normal old saves discard retired extension fields without granting or losing narrative progress', async () => {
    const f = await dialogueFixtures(resolve('GameStarter/web-demo/.build'));
    const one = f.first(); one.restore(one.serialize());
    const before = one.snapshot(), old = structuredClone(before);
    old.supplies = { purchases: ['flashlight'] }; old.phone = { messages: [] }; old.speechExtra = true;
    old.story.history.push({ text:'请先听我说完。',feedback:'说。',accepted:false,attachedItems:['flashlight'] });
    one.restore(JSON.stringify(old));
    assert.equal(Object.hasOwn(one.snapshot(),'supplies'),false);
    assert.equal(Object.hasOwn(one.snapshot(),'phone'),false);
    assert.equal(Object.hasOwn(one.snapshot().story.history.at(-1),'attachedItems'),false);
    assert.deepEqual(one.snapshot().story.collected,before.story.collected);
    assert.deepEqual(one.snapshot().story.flags,before.story.flags);
    const three = createJietingPlaytest(story,'reinforcement',{aiEnabled:true}), saved=three.snapshot();
    saved.supplies={purchases:['flashlight']};saved.phone={messages:[]};
    for(const checkpoint of Object.values(saved.checkpoints))checkpoint.supplies={purchases:['flashlight']};
    const restored=new JietingSession(story,saved,{aiEnabled:true}).snapshot();
    assert.equal(Object.hasOwn(restored,'supplies'),false);
    assert.equal(Object.hasOwn(restored,'phone'),false);
    assert.ok(Object.values(restored.checkpoints).every(c=>!Object.hasOwn(c,'supplies')));
    assert.deepEqual(restored.scores,three.scores);assert.deepEqual(restored.clueIds,saved.clueIds);
});
test('current story graphs and ending catalog contain only narrative routes',()=>{
    for(const path of ['jieting/chapter-three.story.json','luofengpo/chapter-seven.story.json']) {
        const data=readFileSync('content/chapters/'+path,'utf8');
        assert.doesNotMatch(data,/手机|出售|购物|木虎|era-arrest|radio-relay|light-signal|item-plan/);
    }
    const clips=JSON.parse(readFileSync('GameStarter/web-demo/public/cinematics.json','utf8'));
    assert.ok(clips.chapterEndings.every(c=>!['radio-relay','light-signal','item-plan'].includes(c.ending)));
});
