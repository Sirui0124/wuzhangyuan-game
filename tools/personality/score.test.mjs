import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coordinates, matchCharacters, validateOpenFixture } from './score.mjs';
const config = JSON.parse(readFileSync(new URL('../../docs/design/personality/characters-and-model.json', import.meta.url)));
const event = (id, vector, weight = 2) => ({ decisionId: id, vector, weight });

test('initial midpoint is unobserved and cannot unlock a fabricated balanced personality', () => {
  const p = coordinates({}, config.model);
  assert.deepEqual(p.map(x => x.value), [50, 50, 50, 50]);
  assert.equal(matchCharacters(p, config.characters).length, 0);
});
test('two chapters have enough numeric range to approach edge profiles', () => {
  const chapters = { wuzhang: [event('a', [2,-2,2,-2]), event('b',[2,-2,2,-2])], grain: [event('c',[2,-2,2,-2]),event('d',[2,-2,2,-2])] };
  const p=coordinates(chapters,config.model);
  assert.ok(p[0].value>90); assert.ok(p[1].value<10);
  assert.ok(coordinates(chapters,{...config.model,neutralPrior:1})[0].value<90);
});
test('a long chapter cannot outweigh equally supported contradictory chapter', () => {
  const p=coordinates({one:Array.from({length:100},(_,i)=>event('a'+i,[2,null,null,null])),two:[event('b',[-2,null,null,null]),event('c',[-2,null,null,null])]},config.model);
  assert.equal(p[0].value,50); assert.equal(p[1].observed,false);
});
test('latest response replaces same decision, tutorial never scores',()=>{
  const p=coordinates({wuzhang:[{...event('tutorial',[2,2,2,2]),tutorial:true},event('same',[2,null,null,null]),event('same',[-2,null,null,null])]},config.model);
  assert.ok(p[0].value<50); assert.equal(p[0].observations,1); assert.equal(p[1].observed,false);
});
test('unsupported quote is rejected; absent and explicit balanced evidence differ',()=>{
  assert.throws(()=>validateOpenFixture({id:'x',text:'先核清楚。',values:[-1,null,null,null],quotes:['马上行动',null,null,null]}));
  validateOpenFixture({id:'x',text:'一边核查，一边先报已知的情况。',values:[0,null,null,null],quotes:['一边核查，一边先报已知的情况。',null,null,null]});
  assert.equal(coordinates({one:[event('x',[0,null,null,null])]},config.model)[0].observed,true);
});
test('36 fixed profiles are unique and missing dimensions do not enter matching',()=>{
  assert.equal(config.characters.length,36);
  assert.equal(new Set(config.characters.map(p=>p.coordinates.join(','))).size,36);
  const p=[{observed:true,value:25},...Array.from({length:3},()=>({observed:false,value:50}))];
  assert.equal(matchCharacters(p,[{id:'a',name:'a',coordinates:[25,0,0,0]},{id:'b',name:'b',coordinates:[30,50,50,50]}])[0].id,'a');
});

test('confirmed final action replaces its earlier O2 intention without losing independent timing and speech evidence',()=>{
  const open=event('CH2.open.O2',[1,-1,2,2]);
  const before=coordinates({grain:[open]},config.model);
  const after=coordinates({grain:[open,event('CH2.final-action',[null,null,-2,-2])]},config.model);
  assert.equal(before[0].value,after[0].value);
  assert.equal(before[1].value,after[1].value);
  assert.ok(before[2].value>50&&after[2].value<50);
  assert.equal(after[2].observations,1);
  assert.equal(after[3].observations,1);
});
