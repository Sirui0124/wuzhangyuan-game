import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-three/',import.meta.url);
const {createJietingPlaytest,JietingSession}=await import(new URL('session.js',base));
const {parseJietingJudgment,jietingCriteria}=await import(new URL('open-dialogue.js',base));
const {safeJietingReply}=await import(new URL('ai-response.js',base));
const {deploymentProgress}=await import(new URL('deployment-view.js',base));
const story=JSON.parse(readFileSync(new URL('../../content/chapters/jieting/chapter-three.story.json',import.meta.url)));
const words='正面和侧路都要守，下山以后又得列阵，等交上手再赶恐怕来不及。请先另派一队守侧路，原来的队伍不动。';
function fixture(input=words){const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:true});s.state.draft=input;return s;}
const request=s=>({context:s.getEvaluationContext(),input:s.state.draft,clueIds:[...s.state.selected],confirmed:true});
function raw(s,linked=true){
    const input=s.state.draft,criteria=Object.fromEntries(jietingCriteria.map(k=>[k,{value:false,quote:'',evidenceIds:[],reason:''}]));
    for(const k of ['gapEstablished','reinforcementUse','concernAnswered'])criteria[k]={value:true,quote:input,evidenceIds:['JT-C04','JT-C08'],reason:'当前守备与调兵耗时共同支持提前补侧路'};
    return {reinforcementAssessment:{supportedTroops:linked?5000:0,quote:linked?input:'',reason:'受控论证人数'},version:1,valid:true,factsReliable:true,factualIssues:[],criteria,argument:{topic:'road',quote:input,clueIds:['JT-C04','JT-C08']},reasoning:{linked,quote:linked?input:'',evidenceIds:linked?['JT-C04','JT-C08']:[],conclusion:linked?'须提前补侧路，不能等告急才调兵':''},maintain:{value:false,quote:''},deploymentTasks:[{task:'road',quote:input}],acknowledgment:linked?'等交上手才赶来，是怕误了工夫。提前补侧路这个办法，我同意。':'这回只说要人，还没有说到眼前的难处。',followup:{needed:false,question:''},offense:{direct:false,target:'none',kind:'none',context:'asserted',quote:'',reason:'正常进言'},};
}
const parse=(s,r=raw(s))=>parseJietingJudgment(JSON.stringify(r),request(s));
test('weak bare requests get one in-world followup, then zero troops without technical failure',()=>{
    const s=fixture('王将军要兵，请将军再添一队。');const before=s.scores;
    let j=parse(s,raw(s,false));assert.equal(j.status,'followup');assert.equal(j.outcome,'none');assert.ok(s.submit(j));assert.equal(deploymentProgress(s).proposed,0);s.advance();
    assert.equal(s.below,5000);assert.deepEqual(s.scores,before);assert.equal(deploymentProgress(s).remaining,5);
    s.state.draft='下面危险，再派人就好。';j=parse(s,raw(s,false));assert.equal(j.status,'final');assert.equal(j.outcome,'none');assert.ok(s.submit(j));s.advance();
    assert.equal(s.state.roundResults[1].troops,0);assert.equal(deploymentProgress(s).remaining,4);assert.doesNotMatch(safeJietingReply(j),/先前已有安排/);
});
test('a multi-clue conclusion is neither a grant nor a new clue until actual order and arrival',()=>{
    const s=fixture(),before=s.snapshot(),j=parse(s);assert.equal(j.outcome,'great');assert.ok(s.submit(j));assert.equal(s.below,5000);assert.deepEqual(s.state.clueIds,before.clueIds);
    assert.equal(deploymentProgress(s).proposed,5000);s.advance();for(let i=0;i<50&&s.current.id!=='JT-151';i++)assert.ok(s.advance());assert.equal(s.below,5000);s.advance();assert.equal(s.below,10000);
    new JietingSession(story,s.snapshot(),{aiEnabled:true});
});
test('two card IDs without a causal explanation remain insufficient, and invented quotes/unknown sources fail',()=>{
    const s=fixture();const r=raw(s,false);r.reasoning.evidenceIds=['JT-C04','JT-C08'];assert.equal(parse(s,r).outcome,'none');
    const one=raw(s);one.reasoning.evidenceIds=['JT-C04'];assert.equal(parse(s,one).outcome,'none');
    for(const mutate of [r=>r.reasoning.evidenceIds=['JT-C04','JT-C12'],r=>r.reasoning.quote='虚构的推断原话',r=>r.reasoning.evidenceIds=['JT-C04','JT-C04']]){const r=raw(s);mutate(r);assert.throws(()=>parse(s,r),/保留/);}
    const forged=parse(s);delete forged.reasoning;assert.equal(s.submit(forged),false);
});
test('same-round inference survives a short followup without forcing the player to repeat it',()=>{
    const s=fixture(),r=raw(s);r.criteria.concernAnswered={value:false,quote:'',evidenceIds:[],reason:''};r.followup={needed:true,question:'这队人下去以后，原来守路的人动不动？'};
    const first=parse(s,r);assert.equal(first.status,'followup');s.submit(first);s.advance();
    s.state.draft='原来守路的人不动，这队是另派的。';const next=raw(s);next.reasoning={linked:true,quote:words,evidenceIds:['JT-C04','JT-C08'],conclusion:'仍按先前有依据的判断提前补侧路'};
    const final=parse(s,next);assert.equal(final.outcome,'great');assert.ok(s.submit(final));
});
test('already accepted legacy pending replies retain their grant without replaying or clearing the save',()=>{
    const s=fixture(),j=parse(s);s.submit(j);const saved=s.snapshot();delete saved.pendingJudgment.reasoning;for(const j of saved.judgments)delete j.reasoning;
    const restored=new JietingSession(story,saved,{aiEnabled:true});assert.equal(deploymentProgress(restored).proposed,5000);restored.advance();assert.equal(restored.state.roundResults[1].troops,5000);assert.equal(restored.below,5000);
});
