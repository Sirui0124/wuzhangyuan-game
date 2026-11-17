import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { coordinates, matchCharacters, validateOpenFixture } from './score.mjs';
import { GrainSession } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
import { parseJudgment } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/open-dialogue.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=path=>JSON.parse(readFileSync(resolve(root,path),'utf8').replace(/^\uFEFF/,''));
const config=read('docs/design/personality/characters-and-model.json');
const design=read('docs/design/personality/chapter-one-two-scoring.json');
const fixtureSource='docs/design/personality/open-answer-fixtures.json';
const allFixtures=read(fixtureSource).fixtures;
allFixtures.forEach(validateOpenFixture);
const includeSupplemental=process.argv.includes('--include-supplemental');
const fixtures=allFixtures.filter(f=>includeSupplemental||f.coverageTier!=='supplemental-conditional-intent');
const story=read('content/chapters/grain/chapter-two.films.json');
const rubric=read('content/chapters/grain/chapter-two.films-rubric.json');
const sourceOptions=new Map(story.nodes.flatMap(n=>(n.options??[]).map(o=>[o.id,{...o,node:n.id}])));
const optionDesign=new Map(design.choices.flatMap(n=>n.options.map(o=>[o.id,{...o,chapter:n.chapter,node:n.nodeId}])));
for(const [id,option] of sourceOptions){if(optionDesign.get(id)?.text!==option.text)throw new Error('Unmapped or changed actual option: '+id);}
for(const source of design.sources){
  const hash=createHash('sha256').update(readFileSync(resolve(root,source.path))).digest('hex');
  if(hash!==source.sha256)throw new Error('Source changed; review mapping before rerun: '+source.path);
}
const byScene=scene=>fixtures.filter(f=>f.scene===scene);
const openEvent=(f,mask=[])=>({decisionId:f.scene==='R2'?'CH1.open.authorized':'CH2.open.'+f.scene,vector:f.values.map((v,i)=>mask.includes(i)?null:v),weight:2,sourceId:f.id});
const choiceEvent=id=>{
  const p=optionDesign.get(id)?.personality;
  return p?.weight ? {decisionId:p.slot??id,vector:p.directions,weight:p.weight,sourceId:id}:null;
};
const append=(events,id)=>{const event=choiceEvent(id);if(event)events.push(event);};
const finalOption=(action,quality)=>action==='A'?(quality?'UI-E1-FILE-confirm':'UI-E2-FILE-confirm'):action==='B'?'UI-CASE-confirm':'UI-RELEASE-confirm';
const addStory=(scores,delta)=>scores.map((v,i)=>Math.min(10,Math.max(0,v+(delta?.[i]??0))));
function resultingScores(choices,o1,o2){
  let s=[2,0,1];
  for(const id of choices.slice(0,3))s=addStory(s,sourceOptions.get(id).delta);
  s=addStory(s,o1.storyScores);
  for(const id of choices.slice(3))s=addStory(s,sourceOptions.get(id).delta);
  if(o2)s=addStory(s,o2.storyScores);
  return s;
}
function summary(events){
  const latest=[...new Map(events.map(e=>[e.decisionId,e])).values()];
  return [0,1,2,3].map(i=>{
    const relevant=latest.filter(e=>e.vector[i]!==null);
    const w=relevant.reduce((s,e)=>s+e.weight,0);
    const r=Math.min(1,w/config.model.fullChapterEvidenceWeight);
    return [w? r*relevant.reduce((s,e)=>s+e.weight*e.vector[i]/2,0)/w:0,r,relevant.length];
  });
}
const first=[];
for(const f of byScene('R2').filter(f=>f.r2Pass))for(const tent of [null,'tent:side:leave','tent:footsteps:leave']){
  const events=[openEvent(f)];if(tent)append(events,tent);
  first.push({r2:f.id,tent,events,summary:summary(events)});
}

// All reachable main-route ordinary choices; N2-B continues after the confession.
const plans=[];
for(const intro of ['CH2-LY02-003','CH2-LY02-004'])
for(const bedside of ['CH2-LY02-QA','CH2-LY02-QB','CH2-LY02-QC'])
for(const n1 of ['N1-A','N1-B'])
for(const n2 of ['N2-A','N2-B','N2-C'])
for(const n3 of ['N3-A','N3-B','N3-C'])
for(const n4 of ['N4-A','N4-B','N4-C'])plans.push([intro,bedside,n1,n2,n3,n4]);
const chapterTwo=new Map();let rawRoutes=0;
function keep(route){
  rawRoutes++;
  const s=summary(route.events);
  const key=JSON.stringify(s)+':'+route.ending;
  if(!chapterTwo.has(key))chapterTwo.set(key,{...route,summary:s});
}
for(const choices of plans)for(const o1 of byScene('O1'))for(const o2 of byScene('O2')){
  const [trust,rigor,responsibility]=resultingScores(choices,o1,o2);
  const quality=rigor>=5,cooperation=trust>=4&&responsibility>=4;
  for(const action of ['A','B','C'])for(const fallback of action==='A'&&!cooperation?['B','C']:[null]){
    const finalAction=fallback??action;
    const ending=finalAction==='A'?(quality?'E1':'E2'):finalAction==='B'?(quality?'E3':'E4-late'):'E5';
    const confirmed=finalOption(finalAction,quality);
    const events=[];
    for(const id of choices)append(events,id);
    if(choices[3]==='N2-B')append(events,'early-continue');
    events.push(openEvent(o1),openEvent(o2,[2,3]));
    append(events,confirmed);
    keep({choices,o1:o1.id,o2:o2.id,action,fallback,confirmed,ending,events,storyScores:[trust,rigor,responsibility]});
  }
}
for(const choices of plans.filter(p=>p[3]==='N2-B'&&p[4]==='N3-A'&&p[5]==='N4-A'))for(const o1 of byScene('O1')){
  const selected=choices.slice(0,4),events=[];
  for(const id of selected)append(events,id);
  events.push(openEvent(o1));append(events,'UI-EARLY-FILE-confirm');
  keep({choices:selected,o1:o1.id,o2:null,action:'early',fallback:null,confirmed:'UI-EARLY-FILE-confirm',ending:'E4-early',events,storyScores:resultingScores(selected,o1,null)});
}

const witnesses=new Map();let candidatePairs=0,fullFourAxisPairs=0;
for(const one of first)for(const two of chapterTwo.values()){
  candidatePairs++;
  const profile=[0,1,2,3].map(i=>{
    const r=one.summary[i][1]+two.summary[i][1];
    return {value:r?50+50*(one.summary[i][0]+two.summary[i][0])/(config.model.neutralPrior+r):50,observed:r>0};
  });
  if(!profile.every(p=>p.observed))continue;
  fullFourAxisPairs++;
  let best=null,runner=null;
  for(const c of config.characters){
    const distance=Math.sqrt(c.coordinates.reduce((s,v,i)=>s+(v-profile[i].value)**2,0));
    const item={id:c.id,name:c.name,distance};
    if(!best||distance<best.distance){runner=best;best=item;}else if(!runner||distance<runner.distance)runner=item;
  }
  const margin=runner.distance-best.distance;
  // Exact ties are not independent character coverage. Prefer a larger demonstrated margin.
  if(margin<=1e-7)continue;
  if(!witnesses.has(best.id)||margin>witnesses.get(best.id).margin)witnesses.set(best.id,{
    character:best.name,characterId:best.id,coordinates:profile.map(p=>p.value),distance:best.distance,runnerUp:runner.name,margin,
    chapterOne:{r2:one.r2,tent:one.tent},chapterTwo:{...two,summary:undefined,events:undefined},
    inputs:{R2:fixtures.find(f=>f.id===one.r2).text,O1:fixtures.find(f=>f.id===two.o1).text,O2:two.o2?fixtures.find(f=>f.id===two.o2).text:null},
  });
}

function replayWitness(w){
  const one=first.find(x=>x.r2===w.chapterOne.r2&&x.tent===w.chapterOne.tent);
  const two=[...chapterTwo.values()].find(x=>JSON.stringify(x.choices)===JSON.stringify(w.chapterTwo.choices)&&x.o1===w.chapterTwo.o1&&x.o2===w.chapterTwo.o2&&x.action===w.chapterTwo.action&&x.fallback===w.chapterTwo.fallback&&x.ending===w.chapterTwo.ending);
  const checked=coordinates({wuzhang:one.events,grain:two.events},config.model);
  if(checked.some((p,i)=>Math.abs(p.value-w.coordinates[i])>1e-9)||matchCharacters(checked,config.characters)[0].id!==w.characterId)throw new Error('Coverage/calculator divergence '+w.character);
  const s=new GrainSession(story,undefined,rubric,false),trace=[];
  const wanted=new Map(w.chapterTwo.choices.map(id=>[sourceOptions.get(id).node,id]));
  wanted.set('UI-N5','N5-'+w.chapterTwo.action);
  wanted.set('UI-EARLY',w.chapterTwo.action==='early'?'early-stop':'early-continue');
  wanted.set('UI-FALLBACK',w.chapterTwo.fallback==='C'?'fallback-release':'fallback-case');
  for(let guard=0;guard<200&&s.current.kind!=='finish';guard++){
    const n=s.current;trace.push(n.id);
    if(n.kind==='open'){
      const f=fixtures.find(f=>f.id===(n.round==='O1'?w.chapterTwo.o1:w.chapterTwo.o2));
      if(!f)throw new Error('Unexpected open question '+n.id);
      const scores=Object.fromEntries(['trust','rigor','responsibility'].map((key,i)=>[key,{delta:f.storyScores[i],quote:f.storyScores[i]?f.text:'',reason:'人工预期评分用于设计回放，未调用真实模型'}]));
      if(!s.submit(parseJudgment(JSON.stringify({valid:true,scores}),f.text,s.currentRubric)))throw new Error('Cannot submit '+n.id);
    }
    const option=n.kind==='choice'?(wanted.get(n.id)??n.options.find(o=>o.id.endsWith('-confirm'))?.id??n.options[0].id):undefined;
    if(!s.advance(option))throw new Error('Cannot advance '+n.id);
  }
  if(s.current.ending!==w.chapterTwo.ending)throw new Error('Ending mismatch '+w.character+' '+s.current.ending+' '+w.chapterTwo.ending);
  if(w.chapterTwo.ending==='E4-early'&&trace.includes('CH2-O2-INPUT'))throw new Error('Early ending borrowed future evidence');
  return {runtimeSessionReplay:true,ending:s.current.ending,trace,storyScores:s.scores,liveAI:false};
}
for(const w of witnesses.values())w.replay=replayWitness(w);
const out={
  version:config.version,status:'design-reachability-with-human-annotated-open-answers',
  sourceHashes:Object.fromEntries(['content/chapters/grain/chapter-two.films.json','content/chapters/grain/chapter-two.films-rubric.json',fixtureSource,'docs/design/personality/characters-and-model.json','docs/design/personality/chapter-one-two-scoring.json','tools/personality/score.mjs','tools/personality/coverage.mjs','GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js','GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/open-dialogue.js'].map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex')])),
  scope:'第一章已通过第二轮魏延交涉，随后走到第二章实际结局；死亡历史、教学和重试废弃分不计入。',
  qualifications:['第一章R2通过与开放题人格/关卡分为人工预期，未调用真实AI。','第二章每位人物的见证路径已调用当前GrainSession实际推进，非四维任意笛卡尔积。','普通题全量枚举；开放题只覆盖当前具名的自然语言样例，覆盖率不是玩家概率或测量效度。','当前无AI固定发言池没有被伪装成同等覆盖；本次覆盖针对开放表达设计。'],
  coverageTier:includeSupplemental?'including-supplemental-conditional-intent':'current-scene-intent',
  fixtureCount:fixtures.length,ordinaryMainPlans:plans.length,rawChapterTwoRoutes:rawRoutes,distinctChapterTwoStates:chapterTwo.size,candidatePairs,fullFourAxisPairs,
  target:config.model.coverageTarget,total:config.characters.length,reached:witnesses.size,missing:config.characters.filter(c=>!witnesses.has(c.id)).map(c=>c.name),
  witnesses:[...witnesses.values()].sort((a,b)=>a.characterId.localeCompare(b.characterId)),
};
mkdirSync(resolve(root,'outputs/personality-design-20261026'),{recursive:true});
writeFileSync(resolve(root,'outputs/personality-design-20261026/'+(includeSupplemental?'coverage-supplemental.json':'coverage.json')),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({fixtures:fixtures.length,rawRoutes,distinctStates:chapterTwo.size,candidatePairs,reached:out.reached,total:out.total,target:out.target,missing:out.missing,runtimeReplays:out.witnesses.length},null,2));
if(out.reached<out.target)process.exitCode=2;
