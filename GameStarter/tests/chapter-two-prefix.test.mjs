import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GrainSession } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import { parseJudgment } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/open-dialogue.js';
const story = JSON.parse(readFileSync(new URL('../../content/chapters/grain/chapter-two.playable.json', import.meta.url)));
const rubric = JSON.parse(readFileSync(new URL('../../content/chapters/grain/chapter-two.rubric.json', import.meta.url)));
const input = '你先留下，我去核记录，查明白再如实报。';
function judgment(values) { return parseJudgment(JSON.stringify({valid:true,scores:Object.fromEntries(['trust','rigor','responsibility'].map((key,i)=>[key,{delta:values[i],quote:input,reason:'测试分项依据'}]))}),input,rubric); }
function reach(s,id) { for(let i=0;i<100 && s.current.id!==id;i++) { assert.equal(s.advance(s.current.options?.[0]?.id),true); } assert.equal(s.current.id,id); }

test('opening rescue immediately leads into the existing inquiry film before reflection and recognition',()=>{
    const s=new GrainSession(story);assert.equal(s.current.clip,'LI01');s.advance();
    assert.equal(s.current.clip,'LI02A');assert.equal(s.clues.length,0);
    s.advance();assert.equal(s.current.id,'CH2-LY01-002');
    reach(s,'CH2-LY01-011');assert.equal(s.current.clip,'LI02B');
});
test('both ordinary options converge without evidence, submit or confirmation',()=>{
    for(const id of ['CH2-LY02-003','CH2-LY02-004']) {
        const s=new GrainSession(story); reach(s,'CH2-LY02-002');
        assert.equal(s.advance(),false); assert.equal(s.advance('invalid'),false);
        assert.equal(s.advance(id),true); assert.equal(s.current.id,'CH2-LY02-005');
        assert.deepEqual(s.state.chosen,[id]);
    }
});
test('record is acquired after reading, action waits, fixed speech creates no confession',()=>{
    const s=new GrainSession(story); reach(s,'CH2-LY02-014');
    assert.ok(!s.clues.some(c=>c.id==='LY-X06')); s.advance();
    assert.ok(s.clues.some(c=>c.id==='LY-X06')); s.advance();
    assert.equal(s.current.kind,'action'); assert.equal(s.current.text,'去找苟安');
    const restored=new GrainSession(story,JSON.parse(JSON.stringify(s.state)));
    assert.equal(restored.current.id,s.current.id);
    restored.advance(); assert.equal(restored.current.id,'CH2-LY02-016');
    reach(restored,'CH2-LY03-018');
    assert.ok(!restored.clues.some(c=>c.id==='LY-C01'));
    assert.ok(restored.state.visited.includes('CH2-LY02-018A'));
    assert.ok(!restored.state.visited.some(id=>/G01|S01|FB-001|G02/.test(id)));
    assert.equal(restored.advance(),false);
});
test('old and malformed saves are rejected without replacing their progress; fresh games still start normally',()=>{
    for(const save of [{version:'old',node:story.nodes[5].id,visited:[],chosen:[]},{version:story.version,node:'missing',visited:[],chosen:[]}])
        assert.throws(()=>new GrainSession(story,save),/不兼容/);
    assert.equal(new GrainSession(story).current.id,story.start);
    assert.ok(story.nodes.every(n=>!n.id.startsWith('CH2-LY04')));
});

test('first open conversation blocks until judged; retry replaces delta and restores reasons',()=>{
    const s=new GrainSession(story,undefined,rubric); reach(s,'CH2-LY03-018');
    assert.equal(s.advance(),false); assert.deepEqual(s.scores,{trust:2,rigor:0,responsibility:1});
    assert.ok(s.clues.some(c=>c.id==='LY-C02'));
    s.submit(judgment([2,2,2])); assert.deepEqual(s.scores,{trust:4,rigor:2,responsibility:3});
    s.submit(judgment([2,2,2])); assert.deepEqual(s.scores,{trust:4,rigor:2,responsibility:3});
    s.submit(judgment([-2,-2,-2])); assert.deepEqual(s.scores,{trust:0,rigor:0,responsibility:0});
    s.submit(judgment([1,1,1])); assert.deepEqual(s.scores,{trust:3,rigor:1,responsibility:2});
    const restored=new GrainSession(story,JSON.parse(JSON.stringify(s.state)),rubric);
    assert.deepEqual(restored.scores,s.scores); assert.equal(restored.state.judgments[s.current.id].input,input);
    restored.advance(); assert.equal(restored.current.id,'CH2-PREFIX-END');
    const corrupt=JSON.parse(JSON.stringify(restored.state)); corrupt.judgments={};
    assert.equal(new GrainSession(story,corrupt,rubric).current.id,'CH2-LY03-018');
});

test('malformed, ungrounded, out-of-range and irrelevant judgments never commit',()=>{
    assert.throws(()=>parseJudgment('no json',input,rubric));
    assert.throws(()=>parseJudgment('{"valid":false}',input,rubric));
    assert.throws(()=>judgment([3,0,0]));
    assert.throws(()=>judgment([0.5,0,0]));
    const bad=judgment([1,1,1]); bad.scores.trust.quote='不存在的原话';
    assert.throws(()=>parseJudgment(JSON.stringify({valid:true,scores:bad.scores}),input,rubric));
});

test('first-half clue titles and displayed source quotes exactly follow latest editing sheet',()=>{
    const workbook=JSON.parse(readFileSync(new URL('./fixtures/chapter-two-editing-sheet-20261023.json',import.meta.url)));
    const rows=workbook.sheets[0].data.slice(0,53), byId=new Map(rows.filter(r=>r[6]).map(r=>[r[6],r]));
    assert.deepEqual(story.nodes.flatMap(n=>n.clues??[]).map(c=>c.title),rows.filter(r=>r[4]).map(r=>r[4]));
    for(const n of story.nodes)for(const clue of n.clues??[]){
        assert.equal(clue.title,byId.get(n.id)[4]);
        assert.ok(clue.sources.length);
        for(const fragment of clue.sources)assert.equal(fragment.text,byId.get(fragment.node)[3]);
    }
    assert.equal(story.nodes.find(n=>n.id==='CH2-LY02-009A').text,rows[18][3]);
});
