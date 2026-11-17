import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base=new URL('../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-three/',import.meta.url);
const { JietingSession, createJietingPlaytest }=await import(new URL('session.js',base));
const { reinforcementGrant, argumentSupported }=await import(new URL('persuasion.js',base));
const { parseJietingJudgment, jietingCriteria }=await import(new URL('open-dialogue.js',base));
const { jietingPolishInput }=await import(new URL('polish.js',base));
const story=JSON.parse(readFileSync(new URL('../../content/chapters/jieting/chapter-three.story.json',import.meta.url)));
const picks=[{great:'JT-O132',small:'JT-O131',none:'JT-O133'},{great:'JT-O167',small:'JT-O166',none:'JT-O168'},{great:'JT-O198',small:'JT-O197',none:'JT-O199'},{great:'r4-great',small:'r4-small',none:'r4-none'},{great:'r5-great',small:'r5-small',none:'r5-none'}];
const follow={'JT-R1-FOLLOW':'JT-O137','JT-R2-FOLLOW':'JT-O172','JT-R3-FOLLOW':'JT-O203'};
function walk(s, sequence, target='JT-223') {
    for(let i=0;i<300&&s.current.id!==target;i++){
        const match=/^JT-R([1-5])-FIXED$/.exec(s.current.id);
        const pick=match?picks[+match[1]-1][sequence[+match[1]-1]]:follow[s.current.id];
        assert.ok(s.advance(s.current.kind==='choice'?pick:undefined),s.current.id);
    }
    assert.equal(s.current.id,target);
}
test('all 243 five-attempt allocations preserve troops, stop at 20000 and round-trip saves',()=>{
    const first=createJietingPlaytest(story,'reinforcement',{aiEnabled:false}).snapshot();
    for(let mask=0;mask<243;mask++){
        let n=mask;const seq=Array.from({length:5},()=>{const v=['none','small','great'][n%3];n=Math.floor(n/3);return v;});
        const s=new JietingSession(story,first,{aiEnabled:false});walk(s,seq);
        assert.equal(s.below,Math.min(20000,5000+seq.reduce((sum,v)=>sum+(v==='great'?5000:v==='small'?3000:0),0)),seq.join());
        assert.equal(s.above+s.below,25000);assert.ok(s.above>=5000);
        new JietingSession(story,s.snapshot(),{aiEnabled:false});
        s.advance();if(s.below<10000)assert.equal(s.current.id,'JT-225');
    }
});
test('five smaller successes suffice; extra attempts do not farm trust or rigor',()=>{
    const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:false});walk(s,['small','small','small','small','small'],'JT-R4-FIXED');
    const scores=s.scores;walk(s,['small','small','small','small','small']);
    assert.equal(s.below,20000);assert.equal(s.state.roundResults[5].troops,3000);assert.deepEqual(s.scores,scores);
});
const criteria={factsReliable:true,gapEstablished:true,reinforcementUse:true,concernAnswered:true};
const argument={topic:'water',quote:'另派兵护着往返水路的人，原有守路的人不撤。',clueIds:['JT-C03']};
const record=(troops,outcome='great')=>({round:1,troops,outcome,source:'ai',tasks:['water'],argument:{...argument,quote:'先派些人护水。'},ordered:true,arrived:true,reported:true,usedItemIds:[]});
test('repeat arguments cannot farm troops; improving a 3000 plan adds only 2000 and final cap can add 1000',()=>{
    assert.equal(reinforcementGrant(criteria,argument,[record(5000)],10000).troops,0);
    assert.equal(reinforcementGrant(criteria,argument,[record(3000,'small')],8000).troops,2000);
    assert.equal(reinforcementGrant({...criteria,concernAnswered:false},argument,[record(3000,'small')],8000).troops,0);
    assert.equal(reinforcementGrant(criteria,{...argument,quote:'先派些人护水。'},[record(3000,'small')],8000).troops,0);
    assert.equal(reinforcementGrant(criteria,argument,[],19000).troops,1000);
    assert.equal(argumentSupported(argument,[],[argument.quote]),false);
    assert.equal(argumentSupported({...argument,topic:'mandate'},['JT-C03'],[argument.quote]),false);
});
test('AI can cite owned but unselected facts; repeated successful topic is locally downgraded',()=>{
    const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:true});s.state.draft=argument.quote;
    const context=s.getEvaluationContext(),req={confirmed:true,context,input:s.state.draft,clueIds:[]};
    const checks=Object.fromEntries(jietingCriteria.map(k=>[k,{value:false,quote:'',evidenceIds:[],reason:''}]));
    for(const k of ['gapEstablished','reinforcementUse','concernAnswered'])checks[k]={value:true,quote:req.input,evidenceIds:['JT-C03'],reason:'护水与守路需要不同队伍'};
    const raw={version:1,valid:true,factsReliable:true,factualIssues:[],criteria:checks,argument,reasoning:{linked:true,quote:req.input,evidenceIds:['JT-C03','JT-C04'],conclusion:'守路和护水不能依靠同一队人'},maintain:{value:false,quote:''},deploymentTasks:[{task:'water',quote:req.input}],acknowledgment:'原来的守路人不动，另外的人护住往返的水路，这个安排可以商量。',followup:{needed:false,question:''},offense:{direct:false,target:'none',kind:'none',context:'asserted',quote:'',reason:'正常进言'},};
    raw.reinforcementAssessment={supportedTroops:5000,quote:req.input,reason:'受控完整论证'};
    const j=parseJietingJudgment(JSON.stringify(raw),req);assert.equal(j.outcome,'great');assert.ok(s.submit(j));assert.equal(s.below,5000);
    const duplicate=structuredClone(req);duplicate.context.round=4;duplicate.context.below=10000;duplicate.context.above=15000;duplicate.context.roundResults=[record(5000)];
    const out=parseJietingJudgment(JSON.stringify(raw),duplicate);assert.equal(out.outcome,'none');
    assert.equal(s.state.roundResults[1],undefined,'mere generation did not issue an order');
    const forged=structuredClone(raw);forged.argument.clueIds=['JT-C12'];assert.throws(()=>parseJietingJudgment(JSON.stringify(forged),req),/保留/);
});
test('fourth and fifth AI entries preserve legal progress, mode switching, per-scene polish and save restore',()=>{
    for(const round of [4,5]){
        const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:false});walk(s,['none','none','none','none','none'],`JT-R${round}-FIXED`);
        s.setMode({aiEnabled:true});assert.equal(s.current.id,`JT-OPEN-R${round}`);assert.equal(s.getEvaluationContext().round,round);
        assert.match(jietingPolishInput(s).direction,new RegExp(`reinforcement-${round}-v1`));
        const restore=new JietingSession(story,s.snapshot(),{aiEnabled:true});assert.equal(restore.current.id,s.current.id);
        restore.setMode({aiEnabled:false});assert.equal(restore.current.id,`JT-R${round}-FIXED`);
    }
});

test('previous-version lawful progress keeps arrived troops and a pending response without granting twice',()=>{
    const original=createJietingPlaytest(story,'reinforcement',{aiEnabled:false});walk(original,['great','none','none','none','none'],'JT-R2-FIXED');
    const old=original.snapshot();old.version='jieting-20261026-1a640d464f8a';delete old.roundResults[1].argument;
    const restored=new JietingSession(story,old,{aiEnabled:false});assert.equal(restored.below,10000);assert.equal(restored.state.version,story.version);
    assert.equal(new JietingSession(story,restored.snapshot(),{aiEnabled:false}).below,10000);
    const forged=restored.snapshot();forged.roundResults[1].troops=10000;assert.throws(()=>new JietingSession(story,forged),/人数/);
});
