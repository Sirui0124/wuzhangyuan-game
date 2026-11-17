import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const build=resolve(process.env.GAME_BUILD||'GameStarter/web-demo/.build');
const {JingzhouSession,dimensions}=await import(pathToFileURL(resolve(build,'GameStarter/web-demo/src/chapters/chapter-five/session.js')));
const {jingzhouView}=await import(pathToFileURL(resolve(build,'GameStarter/web-demo/src/chapters/chapter-five/view.js')));
const story=JSON.parse(readFileSync('content/chapters/jingzhou/chapter-five.reports.json','utf8'));
const fresh=(seed=42)=>{const s=new JingzhouSession(story,seed);s.apply({type:'begin'});return s;};
const judge=(s,id,v)=>s.apply({type:'judge',id,verdict:v});
const ask=(s,id,d)=>s.apply({type:'ask',id,dimension:d});
function resolveAll(s,fn=r=>r.truth?'true':'false'){while(s.current){const id=s.current;assert.equal(judge(s,id,fn(s.report(id))),true);}}

test('six reports, 30 responses, balanced facts and false reports with only one or two configured clue dimensions',()=>{
 assert.equal(story.reports.length,6);assert.equal(story.reports.filter(r=>r.truth).length,3);
 for(const r of story.reports){assert.equal(Object.keys(r.answers).length,5);assert.ok(r.truth?r.flawDimensions.length===0:r.flawDimensions.length>=1&&r.flawDimensions.length<=2);}
 assert.deepEqual(new JingzhouSession(story,42).order,new JingzhouSession(story,42).order);
 assert.ok(new Set(Array.from({length:10},(_,n)=>new JingzhouSession(story,n).order.join(','))).size>1);
});
test('asking cannot exceed three, interview a future soldier, or change a final verdict',()=>{
 const s=fresh(),id=s.current,next=s.order[1];
 assert.equal(ask(s,next,'time'),false);assert.equal(judge(s,next,'true'),false);
 assert.equal(ask(s,id,'invalid'),false);
 for(const d of dimensions.slice(0,3))assert.equal(ask(s,id,d.id),true);
 assert.equal(ask(s,id,'evidence'),false);assert.equal(judge(s,id,'false'),true);
 assert.equal(judge(s,id,'true'),false);assert.equal(ask(s,id,'evidence'),false);
 assert.equal(s.entry(id).asked.length,3);
});
test('custom questions share the fixed budget and survive restore without changing authored answers',()=>{
 const s=fresh(),id=s.current;
 assert.equal(s.apply({type:'ask',id,dimension:'time',question:'你是天亮前去的，还是天亮以后？'}),true);
 assert.equal(s.apply({type:'ask',id,dimension:'source',question:'   '}),false);
 assert.equal(s.apply({type:'ask',id,dimension:'source',question:'问'.repeat(301)}),false);
 assert.equal(s.apply({type:'ask',id,dimension:'time',question:'再确认一下，是天亮以后吗？'}),true);assert.equal(ask(s,id,'source'),true);assert.equal(ask(s,id,'sequence'),false);
 const restored=new JingzhouSession(story,s.seed,s.snapshot());assert.equal(restored.entry(id).turns[0].question,'你是天亮前去的，还是天亮以后？');assert.equal(restored.entry(id).asked.length,3);
 assert.ok(jingzhouView(restored,{active:id,notice:'',background:''}).includes('我 · 你是天亮前去的，还是天亮以后？'));
});
test('only two pending soldiers; resolve one without losing the current interview and preserve question budgets',()=>{
 const s=fresh(),a=s.current;ask(s,a,'time');judge(s,a,'pending');
 const b=s.current;judge(s,b,'pending');const c=s.current;
 assert.equal(judge(s,c,'pending'),false);assert.equal(s.current,c);
 assert.equal(ask(s,a,'source'),true);assert.equal(ask(s,a,'evidence'),true);assert.equal(ask(s,a,'consistency'),false);
 assert.equal(judge(s,a,'true'),true);assert.equal(s.current,c);assert.equal(judge(s,c,'pending'),true);
 assert.deepEqual(s.pending,[b,c]);assert.equal(s.entry(a).asked.length,3);
});
test('pending decisions must be resolved before selection; candidates only, exactly three, no repeated finish',()=>{
 const s=fresh();judge(s,s.current,'pending');resolveAll(s,()=> 'true');
 assert.equal(s.phase,'resolve');assert.equal(s.apply({type:'select',id:s.candidates[0]}),false);
 judge(s,s.pending[0],'false');assert.equal(s.phase,'selection');
 assert.equal(s.apply({type:'select',id:s.order[0]}),false);
 assert.equal(s.apply({type:'finish'}),false);
 for(const id of s.candidates.slice(0,3))assert.equal(s.apply({type:'select',id}),true);
 assert.equal(s.apply({type:'select',id:s.candidates[3]}),false);
 assert.equal(s.apply({type:'finish'}),true);const snap=s.snapshot();
 assert.equal(s.apply({type:'finish'}),false);assert.deepEqual(s.snapshot(),snap);
});
test('all seven accuracy scores determine stable outcomes without selecting people or drawing random odds',()=>{
 for(let score=0;score<=6;score++)for(const seed of [0,42,12345]){
  const s=fresh(seed);let i=0;resolveAll(s,r=>(i++<score?r.truth:!r.truth)?'true':'false');
  assert.equal(s.apply({type:'settle'}),true);assert.equal(s.result.judged,score);
  assert.equal(s.result.outcome,score>=5?'return':score>=3?'costly':'lost');
  assert.equal(s.result.survived,score>=3);assert.equal(s.apply({type:'settle'}),false);
 }
 const pending=fresh();judge(pending,pending.current,'pending');resolveAll(pending);
 assert.equal(pending.apply({type:'settle'}),false);
});
test('story pages and the reply restore exactly; score cannot change during the aftermath',()=>{
 const s=new JingzhouSession(story,42);
 for(let i=0;i<4;i++)assert.equal(s.apply({type:'narrate',stage:'intro'}),true);
 assert.equal(s.apply({type:'narrate',stage:'intro'}),false);s.apply({type:'begin'});
 resolveAll(s);s.apply({type:'settle'});
 assert.equal(s.apply({type:'reply',reply:'stay'}),false);
 assert.equal(s.apply({type:'narrate',stage:'aftermath'}),true);
 assert.equal(s.apply({type:'narrate',stage:'aftermath'}),false);
 assert.equal(s.apply({type:'reply',reply:'people'}),true);
 const restored=new JingzhouSession(story,42,s.snapshot());
 assert.equal(restored.introPage,4);assert.equal(restored.aftermathPage,2);assert.equal(restored.reply,'people');
 for(let i=0;i<3;i++)assert.equal(restored.apply({type:'narrate',stage:'aftermath'}),true);
 assert.equal(restored.apply({type:'narrate',stage:'aftermath'}),false);assert.equal(restored.result.judged,6);
});
test('restoration replays counts, final judgments, order and the same outcome; rejects corrupt or incompatible logs',()=>{
 const s=fresh();ask(s,s.current,'time');resolveAll(s,()=> 'true');for(const id of s.candidates.slice(0,3))s.apply({type:'select',id});s.apply({type:'finish'});
 const saved=s.snapshot(),restored=new JingzhouSession(story,saved.seed,saved);assert.deepEqual(restored.snapshot(),saved);assert.deepEqual(restored.result,s.result);assert.deepEqual(restored.order,s.order);
 for(const broken of [{...saved,contentVersion:'old'},{...saved,chapterId:'yiling'},{...saved,actions:[{type:'ask',id:'chen',dimension:'time'}]},{...saved,actions:[...saved.actions,{type:'begin'}]}])assert.throws(()=>new JingzhouSession(story,saved.seed,broken));
 const copy=s.entry(s.order[0]);copy.asked.push('evidence');assert.notDeepEqual(copy,s.entry(s.order[0]));
});
test('unasked testimony never leaks; settlement exposes only the total score rather than answers or motives',()=>{
 const s=fresh();const id=s.current,r=s.report(id);
 const html=jingzhouView(s,{active:id,notice:'',background:''});
 assert.ok(html.includes(r.opening));for(const d of dimensions)assert.equal(html.includes(r.answers[d.id]),false);
 for(const report of story.reports){assert.equal(html.includes(report.motive),false);assert.equal(html.includes(report.explanation),false);}
 ask(s,id,'time');const askedHtml=jingzhouView(s,{active:id,notice:'',background:''});assert.ok(askedHtml.includes(r.answers.time));assert.ok(askedHtml.includes(`我 · ${r.questions.time}`));
 resolveAll(s);for(const candidate of s.candidates)s.apply({type:'select',id:candidate});s.apply({type:'finish'});
 const end=jingzhouView(s,{active:'',notice:'',background:''});assert.ok(end.includes('判断正确 6 条'));for(const report of story.reports){assert.equal(end.includes(report.motive),false);assert.equal(end.includes(report.explanation),false);}assert.equal(end.includes('%'),false);
});
