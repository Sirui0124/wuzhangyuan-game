import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { validateVector, validateOpenFixture } from './score.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=path=>JSON.parse(readFileSync(resolve(root,path),'utf8').replace(/^\uFEFF/,''));
const first=read('docs/design/personality/chapter-one-two-scoring.json');
const third=read('docs/design/personality/chapter-three-scoring.json');
const rubric=read('docs/design/personality/open-answer-rubric.json');
const answers=read('docs/design/personality/open-answer-fixtures.json');
const config=read('docs/design/personality/characters-and-model.json');
for(const file of [first,third,rubric])for(const source of file.sources){
  assert.equal(createHash('sha256').update(readFileSync(resolve(root,source.path))).digest('hex'),source.sha256,'Source changed: '+source.path);
}
for(const c of config.characters){
  assert.equal(c.coordinates.length,4);
  assert.ok(c.coordinates.every(n=>Number.isFinite(n)&&n>=0&&n<=100));
}
assert.equal(config.characters.length,36);
assert.equal(new Set(config.characters.map(c=>c.coordinates.join(','))).size,36);
const all=[...first.choices,...third.choices];
for(const choice of all)for(const option of choice.options){
  const p=option.personality;validateVector(p.directions);
  assert.ok([0,1,2].includes(p.weight));
  assert.equal(p.weight===0,p.directions.every(v=>v===null),'Unobserved/weight mismatch '+option.id);
  if(p.axisEvidence)for(let i=0;i<4;i++)if(p.directions[i]!==null){
    const q=p.axisEvidence['ABCD'[i]]?.quote;
    assert.ok(q&&option.text.includes(q),'Nonliteral option evidence: '+option.id);
  }
}
for(const [chapter,file] of [['grain','content/chapters/grain/chapter-two.films.json'],['jieting','content/chapters/jieting/chapter-three.story.json']]){
  const story=read(file);
  const choices=all.filter(c=>c.chapter===chapter);
  const actual=story.nodes.filter(n=>n.options?.length);
  assert.equal(choices.length,actual.length);
  for(const node of actual){
    const mapped=choices.find(c=>c.nodeId===node.id);assert.ok(mapped,node.id);
    assert.equal(mapped.options.length,node.options.length);
    for(const option of node.options){
      const match=mapped.options.find(o=>o.id===option.id);assert.ok(match,option.id);
      assert.equal(match.text,option.text);assert.equal(match.next,option.next);
    }
  }
}
answers.fixtures.forEach(validateOpenFixture);
rubric.examples.forEach(e=>validateOpenFixture({...e,values:e.expectedValues}));
const opens=[...first.openQuestions,...third.openQuestions];
assert.equal(rubric.scenes.length,opens.length);
for(const node of opens)assert.ok(rubric.scenes.some(s=>s.sceneId===node.nodeId),'Missing open rubric '+node.nodeId);
const result={status:'passed',characters:config.characters.length,choiceNodes:all.length,options:all.reduce((s,n)=>s+n.options.length,0),openNodes:opens.length,calibrationExamples:rubric.examples.length,coverageFixtures:answers.fixtures.length,liveAI:false,runtimeIntegrated:false};
writeFileSync(resolve(root,'outputs/personality-design-20261026/config-validation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
