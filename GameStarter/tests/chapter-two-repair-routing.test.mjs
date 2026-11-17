import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GrainSession} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import {parseJudgment} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/open-dialogue.js';
const story=JSON.parse(readFileSync(new URL('../../content/chapters/grain/chapter-two.films.json',import.meta.url)));
const rubric=JSON.parse(readFileSync(new URL('../../content/chapters/grain/chapter-two.films-rubric.json',import.meta.url)));
function atDecision(){
 const s=new GrainSession(story,undefined,rubric,false);
 for(let i=0;i<180&&s.current.id!=='UI-N5';i++){
  if(s.current.kind==='open'){
   const input='我陪你如实交代，再按军中程序送报，不保证免罪。';
   s.submit(parseJudgment(JSON.stringify({valid:true,scores:Object.fromEntries(['trust','rigor','responsibility'].map(k=>[k,{delta:2,quote:input,reason:'受控边界测试'}]))}),input,s.currentRubric));
  }
  assert.ok(s.advance(s.current.options?.[0]?.id));
 }
 assert.equal(s.current.id,'UI-N5');return s;
}
test('cooperation boundary is independent from rigor and material quantity',()=>{
 for(const [trust,responsibility,expected] of [[4,4,'V32A'],[3,4,'V32R'],[4,3,'V32R']]){
  const s=atDecision();Object.defineProperty(s,'scores',{get:()=>({trust,responsibility,rigor:20})});
  assert.ok(s.advance('N5-A'));assert.equal(s.current.id,expected);
  assert.equal(s.state.routeSnapshot.cooperation,expected==='V32A');
 }
});
test('quality is checked only after cooperation and actual declaration',()=>{
 for(const [rigor,missing,expected] of [[4,false,'UI-E2-FILE'],[5,false,'UI-SEND'],[5,true,'UI-E2-FILE']]){
  const s=atDecision();Object.defineProperty(s,'scores',{get:()=>({trust:4,responsibility:4,rigor})});
  if(missing)s.state.visited=s.state.visited.filter(id=>!story.nodes.find(n=>n.id===id)?.clues?.some(c=>c.id==='LY-M01'));
  assert.equal(s.clues.some(c=>c.id==='LY-M01'),!missing);
  assert.ok(s.advance('N5-A'));assert.equal(s.current.id,'V32A');
  assert.ok(s.advance());assert.equal(s.current.id,'UI-DECLARATION');
  assert.ok(s.advance());assert.equal(s.current.id,expected);
 }
});
test('refusal retains both formal handover and release with explicit confirmation',()=>{
 for(const option of ['fallback-case','fallback-release']){
  const s=atDecision();Object.defineProperty(s,'scores',{get:()=>({trust:3,responsibility:4,rigor:5})});
  s.advance('N5-A');assert.equal(s.current.id,'V32R');s.advance();assert.equal(s.current.id,'UI-FALLBACK');
  s.advance(option);assert.equal(s.current.id,option==='fallback-case'?'UI-CASE':'UI-RELEASE');
  assert.equal(s.current.kind,'choice');assert.ok(!s.state.end);
 }
});
test('reference selection origin survives reload without clearing old compatible saves',()=>{
 const s=atDecision();const clue=s.clues[0].id;
 s.state.selected=[clue];s.state.selectedAt='CH2-LY03-018';
 const restored=new GrainSession(story,structuredClone(s.state),rubric,false);
 assert.deepEqual(restored.state.selected,[clue]);assert.equal(restored.state.selectedAt,'CH2-LY03-018');
 const old=structuredClone(s.state);delete old.selectedAt;
 const restoredOld=new GrainSession(story,old,rubric,false);
 assert.deepEqual(restoredOld.state.selected,[clue]);assert.equal(restoredOld.state.selectedAt,undefined);
});
