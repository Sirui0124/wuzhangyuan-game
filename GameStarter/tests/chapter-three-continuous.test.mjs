import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-three/',import.meta.url);
const {createJietingPlaytest,JietingSession}=await import(new URL('session.js',base));
const {parseJietingJudgment,jietingCriteria}=await import(new URL('open-dialogue.js',base));
const {generateOpeningQuestion,fallbackOpeningQuestion}=await import(new URL('opening-question.js',base));
const {troopWords,reinforcementGrant}=await import(new URL('persuasion.js',base));
const story=JSON.parse(readFileSync(new URL('../../content/chapters/jieting/chapter-three.story.json',import.meta.url)));
const words='两处都要守，下山还得列阵，等交战再调兵怕是来不及。请另派一队补侧路，正面的兵不撤，进退仍听将军号令。';
const fixture=()=>createJietingPlaytest(story,'reinforcement',{aiEnabled:true,phoneAllowed:false});
function raw(s,amount){
    const input=s.state.draft,criteria=Object.fromEntries(jietingCriteria.map(k=>[k,{value:false,quote:'',evidenceIds:[],reason:''}]));
    for(const k of ['gapEstablished','reinforcementUse','concernAnswered'])criteria[k]={value:true,quote:input,evidenceIds:['JT-C04','JT-C08'],reason:'两处岗位与行进列阵时间支持提前增援'};
    return {version:1,valid:true,factsReliable:true,factualIssues:[],criteria,argument:{topic:'road',quote:input,clueIds:['JT-C04','JT-C08']},reasoning:{linked:true,quote:input,evidenceIds:['JT-C04','JT-C08'],conclusion:'须提前补守侧路'},reinforcementAssessment:{supportedTroops:amount,quote:input,reason:'按本次用兵缺口和安排的完整度评估'},maintain:{value:false,quote:''},deploymentTasks:[{task:'road',quote:input}],acknowledgment:'早些补上侧路，我这里也好留兵等战机。这个办法可以商量。',followup:{needed:false,question:''},offense:{direct:false,target:'none',kind:'none',context:'asserted',quote:'',reason:'正常进言'},};
}
const parse=(s,r)=>parseJietingJudgment(JSON.stringify(r),{context:s.getEvaluationContext(),input:s.state.draft,clueIds:[],confirmed:true});
function until(s,predicate){for(let i=0;i<150&&!predicate();i++)assert.ok(s.advance(),s.current.id);assert.ok(predicate());}
test('continuous assessments preserve nonstandard integer amounts through order, arrival, second improvement and restore',()=>{
    const s=fixture();s.state.draft=words;const j=parse(s,raw(s,2600));assert.equal(j.outcome,'small');assert.ok(s.submit(j));s.advance();
    until(s,()=>s.current.effects?.some(e=>e.type==='round-order'));assert.match(s.current.text,/两千六百/);assert.equal(s.below,5000);s.advance();
    until(s,()=>s.current.id==='JT-151');s.advance();assert.equal(s.below,7600);new JietingSession(story,s.snapshot(),{aiEnabled:true});
    until(s,()=>s.current.id==='JT-OPEN-R2');s.state.draft='前次先到的队伍继续守路，两处仍得补足，另派一队便不用从正面抽人。';const second=parse(s,raw(s,4000));assert.ok(s.submit(second));s.advance();
    assert.equal(s.state.roundResults[2].troops,1400);until(s,()=>s.current.effects?.some(e=>e.type==='round-order'));assert.match(s.current.text,/一千四百/);
    s.advance();until(s,()=>s.current.id==='JT-R2-ARRIVAL');s.advance();assert.equal(s.below,9000);const restored=new JietingSession(story,s.snapshot(),{aiEnabled:true});assert.equal(restored.below,9000);
    const bad=s.snapshot();bad.roundResults[2].troops=4000;assert.throws(()=>new JietingSession(story,bad),/人数/);
});
test('the full integer range is accepted, invalid values retry, partial concern caps at 3000, final target caps exact shortfall',()=>{
    for(const n of [0,1,500,2300,3800,4999,5000]){const s=fixture();s.state.draft=words;assert.equal(parse(s,raw(s,n)).reinforcementAssessment.supportedTroops,n);}
    for(const n of [-1,5001,Infinity,2.5]){const s=fixture();s.state.draft=words;assert.throws(()=>parse(s,raw(s,n)),/保留/);}
    const s=fixture();s.state.draft=words;const r=raw(s,4800);r.criteria.concernAnswered={value:false,quote:'',evidenceIds:[],reason:''};assert.equal(parse(s,r).reinforcementAssessment.supportedTroops,3000);
    assert.equal(reinforcementGrant({factsReliable:true,gapEstablished:true,reinforcementUse:true,concernAnswered:true},{topic:'road',quote:words,clueIds:[]},[],19583,false,3800).troops,417);
    assert.equal(troopWords(3800),'三千八百');assert.equal(troopWords(1400),'一千四百');assert.equal(troopWords(1010),'一千零一十');assert.equal(troopWords(12),'十二');
});
test('AI questions are read-only, grounded, stored once, and cannot overwrite a draft or accept a stale result',async()=>{
    const s=fixture(),c=s.getEvaluationContext(),before=s.snapshot();
    const q=await generateOpeningQuestion(c,new AbortController().signal,{respond:async()=>({text:JSON.stringify({question:'侧路要添人，可以商量。只是魏军还没动，何必现在就派？',clueIds:['JT-C04','JT-C05']}),responseId:'mock-question'})});
    assert.deepEqual(s.state,before);assert.ok(s.confirmOpeningQuestion(q));assert.equal(s.current.text,q.question);assert.equal(s.below,5000);assert.deepEqual(s.state.clueIds,before.clueIds);
    const restored=new JietingSession(story,s.snapshot(),{aiEnabled:true});assert.equal(restored.current.text,q.question);
    const late=fixture(),copy={...q,...{nodeId:late.current.id,contextKey:late.getEvaluationContext().contextKey}};late.state.draft='已经准备说话';assert.equal(late.confirmOpeningQuestion(copy),false);
    for(const question of [{question:'我再拨五千给王平，好么？',clueIds:['JT-C04']},{question:'坡脚已经布置好了么？',clueIds:['JT-C12']}])await assert.rejects(generateOpeningQuestion(c,new AbortController().signal,{respond:async()=>({text:JSON.stringify(question),responseId:'bad-question'})}));
    for(const round of [1,2,3,4,5])assert.match(fallbackOpeningQuestion(round,5000,{}),/？/);
});

test('five guided rounds award variable troop amounts and stop exactly at the target',()=>{
    const s=fixture(),amounts=[3800,2400,4100,3200,5000],topics=['road','water','reception','mandate','initiative'],clues=[['JT-C04','JT-C08'],['JT-C03','JT-C04'],['JT-C08','JT-C12'],['JT-C01','JT-C04'],['JT-C02','JT-C06']];
    let actual=5000;
    for(let i=0;i<5;i++){
        assert.equal(s.current.id,`JT-OPEN-R${i+1}`);
        const c=s.getEvaluationContext();assert.ok(s.confirmOpeningQuestion({nodeId:c.nodeId,contextKey:c.contextKey,question:`第${i+1}回仍有哪一处需要补人？`,clueIds:[]}));
        s.state.draft=`第${i+1}回，${words}`;const r=raw(s,amounts[i]);r.argument.topic=topics[i];r.argument.clueIds=clues[i];r.reasoning.evidenceIds=clues[i];
        for(const k of ['gapEstablished','reinforcementUse','concernAnswered'])r.criteria[k].evidenceIds=clues[i];
        r.deploymentTasks=[{task:i===1?'water':i===2?'reception':'road',quote:s.state.draft}];
        const j=parse(s,r);assert.ok(s.submit(j));s.advance();
        const grant=Math.min(amounts[i],20000-actual);assert.equal(s.state.roundResults[i+1].troops,grant);
        until(s,()=>s.current.effects?.some(e=>e.type==='round-arrival'));assert.equal(s.below,actual);s.advance();actual+=grant;assert.equal(s.below,actual);
        new JietingSession(story,s.snapshot(),{aiEnabled:true});
        if(i<4)until(s,()=>s.current.id===`JT-OPEN-R${i+2}`);
    }
    assert.equal(s.below,20000);assert.equal(s.above,5000);assert.equal(Object.keys(s.state.guidedQuestions).length,5);
});
test('identical argument earns no additional troops even if the model increases support, and reload preserves that',()=>{
    const s=fixture();s.state.draft=words;assert.ok(s.submit(parse(s,raw(s,2600))));s.advance();until(s,()=>s.current.id==='JT-OPEN-R2');
    s.state.draft=words;assert.ok(s.submit(parse(s,raw(s,5000))));s.advance();assert.equal(s.state.roundResults[2].troops,0);
    new JietingSession(story,s.snapshot(),{aiEnabled:true});
});
