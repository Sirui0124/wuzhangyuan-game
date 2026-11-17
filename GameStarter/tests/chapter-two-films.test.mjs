import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GrainSession} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import {parseJudgment} from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/open-dialogue.js';
const story=JSON.parse(readFileSync(new URL('../../content/chapters/grain/chapter-two.films.json',import.meta.url)));
const rubric=JSON.parse(readFileSync(new URL('../../content/chapters/grain/chapter-two.films-rubric.json',import.meta.url)));
function judge(s,good=true){const input='你先停手，我陪你把实情和各人责任如实报上去，但不保证免责。';return parseJudgment(JSON.stringify({valid:true,scores:Object.fromEntries(['trust','rigor','responsibility'].map((k,i)=>[k,{delta:good?2:i===1?0:2,quote:input,reason:'测试分项'}]))}),input,s.currentRubric);}
function run({good=true,action='A',early=false,refusal=false}={}){
 const s=new GrainSession(story,undefined,rubric,false),trace=[];
 for(let i=0;i<180&&s.current.kind!=='finish';i++){
  const n=s.current;trace.push(n.id);
  if(n.kind==='open')s.submit(judge(s,good&&!refusal));
  let o;
  if(n.kind==='choice'){
   const pick=n.id==='UI-N1'?(good?'N1-A':'N1-B'):n.id==='UI-N2'?(early?'N2-B':good?'N2-A':'N2-C'):n.id==='UI-N3'?(good?'N3-B':'N3-A'):n.id==='UI-N4'?'N4-B':n.id==='UI-N5'?'N5-'+action:n.id==='UI-EARLY'?'early-stop':n.id==='UI-FALLBACK'?'fallback-case':n.options[0].id;
   o=pick;
  }
  assert.equal(s.advance(o),true,n.id);
  if(n.id==='CH2-LY03-002')assert.ok(s.clues.some(c=>c.id==='LY-C02'));
 }
 assert.equal(s.current.kind,'finish');return {s,trace};
}
test('all five endings and early/late E4 require their actual film events',()=>{
 for(const [opts,ending,required] of [[{},'E1',['V32A','V33','V34','V35','V36','V37','V42-E1']],[{good:false},'E2',['V32A','V38']],[{action:'B'},'E3',['V39','V40','V42-E3']],[{good:false,action:'B'},'E4-late',['V39','V41L']],[{early:true},'E4-early',['V16B','V41E']],[{action:'C'},'E5',['V43']]]){
  const {s,trace}=run(opts);assert.equal(s.current.ending,ending);for(const id of required)assert.ok(trace.includes(id),id);
  if(ending==='E4-early'){assert.ok(!trace.includes('V21b'));assert.ok(!s.clues.some(c=>c.id==='LY-C12'));}
  if(ending!=='E1')assert.ok(!trace.includes('V37'));
  const restored=new GrainSession(story,JSON.parse(JSON.stringify(s.state)),rubric,false);assert.equal(restored.current.id,s.current.id);assert.deepEqual(restored.scores,s.scores);
 }
});
test('film completion does not grant unread letters or account pages',()=>{
 const s=new GrainSession(story,undefined,rubric,false);
 for(let i=0;i<100 && s.current.id!=='CH2-LY04-D01';i++){if(s.current.kind==='open')s.submit(judge(s));s.advance(s.current.options?.[0]?.id);}
 assert.equal(s.current.id,'CH2-LY04-D01');assert.ok(!s.clues.some(c=>c.id==='LY-M01'));s.advance();assert.ok(s.clues.some(c=>c.id==='LY-M01'));assert.ok(!s.clues.some(c=>c.id==='LY-M02'));
});
test('cancelled formal action keeps the locked score/material snapshot without concluding',()=>{
 const s=new GrainSession(story,undefined,rubric,false);
 for(let i=0;i<150&&s.current.id!=='UI-N5';i++){if(s.current.kind==='open')s.submit(judge(s));s.advance(s.current.options?.[0]?.id);}
 assert.equal(s.current.id,'UI-N5');s.advance('N5-B');const snap=structuredClone(s.state.routeSnapshot);s.advance('UI-CASE-cancel');assert.equal(s.current.id,'UI-N5');assert.ok(!s.state.visited.includes('V39'));s.advance('N5-C');assert.deepEqual(s.state.routeSnapshot,snap);s.advance('UI-RELEASE-cancel');assert.equal(s.current.id,'UI-N5');assert.ok(!s.state.visited.includes('V43'));
});
test('film and still mappings are complete; ordinary choices stay ordinary',()=>{
 const config=JSON.parse(readFileSync(new URL('../web-demo/public/cinematics.json',import.meta.url)));const ids=new Set(config.chapterTwo.map(c=>c.id));
 for(const n of story.nodes)if(n.kind==='video')assert.ok(ids.has(n.clip),n.clip);
 assert.equal(story.nodes.filter(n=>n.placeholder).length,1);
 assert.equal(story.nodes.find(n=>n.id==='CH2-LY09-P02').kind,'video');
 assert.equal(story.nodes.filter(n=>n.kind==='open').length,2);
 for(const id of ['UI-N1','UI-N2','UI-N3','UI-N4','UI-N5'])assert.equal(story.nodes.find(n=>n.id===id).kind,'choice');
});

test('first bedside choices score once, survive reload, and do not reveal the unread date',()=>{
 for(const [option,expected] of [['A',{trust:2,rigor:1,responsibility:1}],['B',{trust:3,rigor:0,responsibility:1}],['C',{trust:1,rigor:0,responsibility:1}]]){
  let s=new GrainSession(story,undefined,rubric,false);
  while(s.current.id!=='UI-BEDSIDE')assert.equal(s.advance(s.current.options?.[0]?.id),true);
  assert.equal(s.current.kind,'choice');assert.equal(s.advance('invented-option'),false);
  assert.equal(s.clues.some(c=>c.id==='LY-X06'),false);
  assert.equal(s.advance('CH2-LY02-Q'+option),true);
  assert.deepEqual(s.scores,expected);
  assert.equal(s.advance('CH2-LY02-Q'+option),false);
  s=new GrainSession(story,structuredClone(s.state),rubric,false);
  assert.deepEqual(s.scores,expected);
  assert.equal(s.current.id,'V04'+option);
  assert.equal(s.advance(),true);assert.equal(s.current.id,'V04-END');
  assert.equal(s.advance(),true);assert.equal(s.current.id,'V05');
  assert.equal(s.clues.some(c=>c.id==='LY-X06'),false);
  assert.equal(s.advance(),true);assert.equal(s.current.id,'CH2-LY02-014');
  assert.equal(s.clues.some(c=>c.id==='LY-X06'),false);
  assert.equal(s.advance(),true);assert.equal(s.clues.some(c=>c.id==='LY-X06'),true);
  assert.deepEqual(s.scores,expected);
 }
});

test('old saves beyond the first visit receive no retrospective bedside score',()=>{
 const s=new GrainSession(story,undefined,rubric,false);
 s.state.node='V05';s.state.visited=['V01','V02','CH2-LY02-002','V03A','V04'];s.state.chosen=['CH2-LY02-003'];
 const restored=new GrainSession(story,structuredClone(s.state),rubric,false);
 assert.equal(restored.current.id,'V05');assert.deepEqual(restored.scores,{trust:2,rigor:0,responsibility:1});
});
