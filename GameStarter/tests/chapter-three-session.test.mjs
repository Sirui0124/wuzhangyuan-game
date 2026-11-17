import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const base = process.env.JIETING_BUILD ? pathToFileURL(resolve(process.env.JIETING_BUILD, 'GameStarter/web-demo/src/chapters/chapter-three/session.js')) : new URL('../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-three/session.js', import.meta.url);
const { JietingSession, createJietingPlaytest } = await import(base);
const { guardAssessment, lureEligible, rearReceptionEligible, earlyWithdrawalEligible } = await import(new URL('rules.js', base));
const { jietingPolishInput } = await import(new URL('polish.js', base));
const story = JSON.parse(readFileSync(new URL('../../content/chapters/jieting/chapter-three.story.json', import.meta.url)));
const defaults = { 'JT-Q1':'JT-O018', 'JT-Q2':'JT-O031', 'JT-Q3':'JT-O093', 'JT-Q4':'JT-O111', 'JT-R1-FIXED':'JT-O132', 'JT-R2-FIXED':'JT-O167', 'JT-R3-FIXED':'JT-O198', 'JT-ROUTE-CHOICE':'JT-O228', 'JT-WITHDRAW-FIXED':'JT-O232', 'JT-WITHDRAW-REPLY':'withdraw-facts', 'JT-LAST-TASK':'JT-O251', 'JT-GUARD-CONFIRM':'guard-go', 'JT-LURE-METHOD':'JT-O278', 'JT-LURE-CONFIRM':'JT-O305', 'JT-LURE-SIGNAL':'lure-wait-signal', 'JT-RETREAT-CHOICE':'JT-O372' };
Object.assign(defaults, {'JT-R4-FIXED':'r4-none','JT-R5-FIXED':'r5-none'});
function reach(s, target, changes = {}) {
    for (let n=0;n<600 && s.current.id!==target;n++) {
        assert.notEqual(s.current.kind, 'ending', `ended ${s.current.id} before ${target}`);
        const pick = changes[s.current.id] ?? defaults[s.current.id] ?? (s.current.id==='JT-VISIT-REMAINING' ? s.options[0]?.id : undefined);
        assert.equal(s.advance(s.current.kind==='choice'?pick:undefined),true, `stuck ${s.current.id} target ${target}`);
    }
    assert.equal(s.current.id,target);
}
function finish(s, changes = {}) { for(let i=0;i<600 && s.current.kind!=='ending';i++) { const pick=changes[s.current.id]??defaults[s.current.id]??(s.current.id==='JT-VISIT-REMAINING'?s.options[0]?.id:undefined); assert.equal(s.advance(s.current.kind==='choice'?pick:undefined),true,`stuck ${s.current.id}`); } return s.state.ending; }
function judgment(s, outcome='great', more={}) {
    s.state.draft = '正面和侧路都要守，山上的水还要运。先派兵，别等出事才下山列阵。';
    const c=s.getEvaluationContext();
    const criteria={factsReliable:true,gapEstablished:outcome!=='none',reinforcementUse:outcome!=='none',concernAnswered:outcome==='great',risk:true,route:true,reception:true,motive:true,means:true,withdrawal:true};
    const topic=more.deploymentTasks?.[0]??'road';
    const argument={topic,quote:s.state.draft,clueIds:topic==='water'?['JT-C03']:['JT-C04']};
    const reasoning={linked:outcome!=='none',quote:s.state.draft,clueIds:['JT-C03','JT-C04'],conclusion:'守路队伍不可抽离，应预先另派部队'};
    const reinforcementAssessment={supportedTroops:outcome==='great'?5000:outcome==='small'?3000:0,quote:s.state.draft,reason:'受控测试：按本次论证完整度给出支持人数'};
    return {version:1,nodeId:c.nodeId,contextKey:c.contextKey,input:s.state.draft,clueIds:[...s.state.selected],phase:c.phase,round:c.round,status:'final',outcome,response:'我听明白了，先把要守的地方安排好。',criteria,verifiedClueIds:[],acceptedReasons:[],unresolvedConcerns:[],deploymentTasks:['road'],argument,reasoning,reinforcementAssessment,...more};
}

test('four questions, all three visits, source-read clue semantics',()=>{
    const s=new JietingSession(story,undefined,{aiEnabled:false});
    reach(s,'JT-008'); assert.equal(s.clues.length,0); s.advance(); assert.deepEqual(s.clues.map(c=>c.id),['JT-C01']);
    reach(s,'JT-Q1'); assert.equal(s.advance(),false); s.advance('JT-O020');
    reach(s,'JT-024'); assert.ok(!s.clues.some(c=>c.id==='JT-C05'));s.advance();assert.ok(s.clues.some(c=>c.id==='JT-C05'));
    reach(s,'JT-R1-FIXED'); assert.equal(s.state.visits.length,3); assert.equal(s.clues.length,8);assert.equal(s.scores.r,8);
});
test('round settlement waits for response, actual order, then actual arrival',()=>{
    const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:true}); const before=s.scores;
    assert.equal(s.submit(judgment(s)),true);assert.equal(s.current.kind,'open');assert.equal(s.below,5000);assert.deepEqual(s.scores,before);
    assert.equal(s.advance(),true);assert.equal(s.current.id,'JT-139');assert.equal(s.below,5000);assert.equal(s.state.roundResults[1].ordered,false);
    s.advance();assert.equal(s.state.roundResults[1].ordered,true);assert.equal(s.below,5000);assert.equal(s.scores.m,before.m+1);
    reach(s,'JT-151');assert.equal(s.below,5000);s.advance();assert.equal(s.below,10000);assert.equal(s.scores.w,before.w+1);
    const restored=new JietingSession(story,s.snapshot(),{aiEnabled:true});assert.equal(restored.below,10000);
});
test('single follow-up retains accepted reasons and does not grant troops, scores or facts',()=>{
    const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:true});const before=s.snapshot();
    const j=judgment(s,'small',{status:'followup',acceptedReasons:[{text:'两路都得守',clueIds:['JT-C04'],round:1}],unresolvedConcerns:['为何不能临时增援？']});
    assert.equal(s.submit(j),true);s.advance();assert.equal(s.current.id,'JT-OPEN-R1');assert.equal(s.below,5000);assert.deepEqual(s.scores,before.scores);assert.deepEqual(s.state.clueIds,before.clueIds);assert.equal(s.getEvaluationContext().followupUsed,true);assert.equal(s.getEvaluationContext().acceptedReasons.length,1);
    assert.equal(s.submit(judgment(s,'small',{status:'followup'})),false);
    assert.equal(s.submit(judgment(s,'great')),true);s.advance();reach(s,'JT-151');s.advance();assert.equal(s.below,10000);
});

test('withdrawal does not inherit an unfinished reinforcement question as its current demand', () => {
    const s = createJietingPlaytest(story, 'reinforcement', { aiEnabled: true });
    const concern = '这一次额外守路的人从哪里补？';
    const j = judgment(s, 'small', { unresolvedConcerns: [concern], acceptedReasons: [{ text: '正面和侧路都要守', clueIds: ['JT-C04'], round: 1 }] });
    assert.equal(s.submit(j), true);
    assert.deepEqual(s.getEvaluationContext().unresolvedConcerns, [concern]);
    s.advance(); s.setMode({ aiEnabled: false });
    reach(s, 'JT-WITHDRAW-FIXED');
    s.setMode({ aiEnabled: true });
    assert.equal(s.current.id, 'JT-OPEN-WITHDRAW');
    const context = s.getEvaluationContext();
    assert.deepEqual(context.unresolvedConcerns, []);
    assert.ok(context.acceptedReasons.some(r => r.text === '正面和侧路都要守'));
    assert.ok(context.roundResults.length > 0);
    assert.equal(context.currentQuestion, s.current.text);
    assert.ok(!jietingPolishInput(s).question.includes(concern));
    assert.ok(jietingPolishInput(s).question.includes('谁挡在前面'));
    assert.ok(!jietingPolishInput(s).question.includes('我还想等等'));
    assert.equal(jietingPolishInput(s).question, s.current.text);
    assert.deepEqual(s.state.unresolvedConcerns, [concern], 'history is retained without becoming the new scene requirement');
});

test('command authority resolves the source speaker explicitly in both judging and polishing materials', () => {
    const s = createJietingPlaytest(story, 'reinforcement', { aiEnabled: true });
    const clue = s.clues.find(c => c.id === 'JT-C06');
    assert.ok(clue.sources.some(source => source.speaker === '马谡' && source.text.includes('进退仍由我下令')));
    assert.ok(clue.text.includes('进退仍由马谡下令'));
    assert.ok(s.getEvaluationContext().ownedClues.find(c => c.id === clue.id).text.includes('进退仍由马谡下令'));
    s.state.selected = [clue.id];
    assert.ok(jietingPolishInput(s).evidence[0].text.includes('进退仍由马谡下令'));
});

test('polish material keeps critical facts and current deployment while preserving full sources separately', () => {
    const s = createJietingPlaytest(story, 'withdrawal', { aiEnabled: true });
    s.state.selected = ['JT-C06', 'JT-C09', 'JT-C10', 'JT-C12'];
    const before = s.snapshot(), input = jietingPolishInput(s);
    const material = id => input.evidence.find(item => item.id === id);
    assert.ok(material('JT-C06').text.includes('马谡下令'));
    assert.ok(material('JT-C09').text.includes('放箭逼退取水队'));
    assert.ok(material('JT-C09').text.includes('水源未被占毁'));
    assert.ok(material('JT-C10').text.includes(String(s.below)));
    for (const duty of ['守路', '护水', '接应']) assert.ok(material('JT-C10').text.includes(duty));
    assert.doesNotMatch(material('JT-C10').text, /第[一二三123]次/);
    assert.ok(material('JT-C10').sources.some(source => source.text.includes('第1次增派5000人')));
    assert.ok(material('JT-C12').text.includes('通路仍通'));
    assert.ok(material('JT-C12').text.includes('接应位置'));
    for (const item of input.evidence) {
        const original = s.clues.find(clue => clue.id === item.id);
        assert.ok(item.sources.some(source => source.text === original.text));
        for (const source of original.sources) assert.ok(item.sources.some(saved => saved.speaker === source.speaker && saved.text === source.text));
    }
    assert.ok(input.continuity.roundResults.every(record => !Object.hasOwn(record, 'argument') && !Object.hasOwn(record, 'input')));
    assert.deepEqual(s.snapshot(), before);
});

test('polish distinguishes arrived old duties from a newly accepted but not yet arrived water detachment', () => {
    const s = createJietingPlaytest(story, 'reinforcement', { aiEnabled: true });
    assert.equal(s.submit(judgment(s)), true); s.advance();
    reach(s, 'JT-151'); s.advance(); reach(s, 'JT-OPEN-R2');
    assert.equal(s.below, 10000);
    s.state.selected = ['JT-C10'];
    assert.equal(s.submit(judgment(s, 'great', { deploymentTasks: ['water'] })), true);
    const pending = jietingPolishInput(s);
    assert.ok(pending.evidence[0].text.includes('10000'));
    assert.ok(pending.evidence[0].text.includes('守路'));
    assert.ok(!pending.evidence[0].text.includes('护水'));
});
test('online early water guard persists, does not show a fabricated attack, remains valid after switching offline',()=>{
    const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:true});
    assert.equal(s.submit(judgment(s,'great',{deploymentTasks:['water']})),true);s.advance();reach(s,'JT-151');s.advance();
    assert.equal(s.current.id,'JT-WATER-PROTECTED');assert.ok(!s.current.text.includes('箭'));
    reach(s,'JT-OPEN-R2');assert.ok(!s.clues.some(c=>c.id==='JT-C09'));assert.ok(s.clues.some(c=>c.id==='JT-C10'));
    s.setMode({aiEnabled:false});assert.equal(s.current.id,'JT-R2-SAFE-FIXED');s.advance('r2-safe-small');s.advance();assert.equal(s.current.id,'JT-R2-SAFE-FOLLOW');
    s.advance('r2-safe-follow-great');assert.ok(s.current.text.includes('先前的人已经护着'));s.advance();assert.ok(s.current.text.includes('又挑回一担水'));
    reach(s,'JT-R3-FIXED');assert.equal(s.below,15000);assert.ok(!s.clues.some(c=>c.id==='JT-C09'));
});
test('all 27 reinforcement combinations yield exact arrived troops; <10000 has no lure option',()=>{
    const first=createJietingPlaytest(story,'reinforcement',{aiEnabled:false}).snapshot();
    for(const a of ['great','small','none'])for(const b of ['great','small','none'])for(const c of ['great','small','none']){
        const s=new JietingSession(story,first,{aiEnabled:false});
        const outcomes=[a,b,c], ids=[{great:'JT-O132',small:'JT-O131',none:'JT-O133'},{great:'JT-O167',small:'JT-O166',none:'JT-O168'},{great:'JT-O198',small:'JT-O197',none:'JT-O199'}];
        const changes=Object.fromEntries(outcomes.map((v,i)=>[`JT-R${i+1}-FIXED`,ids[i][v]]));Object.assign(changes,{'JT-R1-FOLLOW':'JT-O137','JT-R2-FOLLOW':'JT-O172','JT-R3-FOLLOW':'JT-O203'});
        reach(s,'JT-223',changes);s.advance();
        assert.equal(s.below,5000+outcomes.reduce((n,o)=>n+(o==='great'?5000:o==='small'?3000:0),0));assert.equal(s.above+s.below,25000);
        if(s.below<10000){assert.equal(s.current.id,'JT-225');assert.equal(s.options.length,0)}else{assert.equal(s.current.id,'JT-ROUTE-CHOICE');assert.ok(s.options.some(o=>o.id==='JT-O229'))}
        new JietingSession(story,s.snapshot(),{aiEnabled:false});
    }
});
test('guard formula preserves average trust, exclusive rescue task, exact half points and no low-mountain penalty',()=>{
    assert.equal(guardAssessment({w:3,m:4,r:5},10000).score,18.5);
    assert.equal(guardAssessment({w:3,m:4,r:5},10000,{early:true,rearReception:true}).receptionBonus,0);
    assert.equal(guardAssessment({w:3,m:4,r:5},10000,{rearReception:true}).score,21.5);
    assert.equal(guardAssessment({w:3,m:4,r:5},10000,{rearReception:true}).masuAlive,false);
    assert.equal(lureEligible({w:4,m:4,r:7},10000,'fixed'),true);assert.equal(lureEligible({w:4,m:4,r:7},20000,'fixed'),true);
    assert.equal(lureEligible({w:4,m:4,r:6},10000,'fixed'),false);assert.equal(lureEligible({w:4,m:4,r:5},10000,'discussion'),true);
});
test('three success endings and three ordinary failure endings are reachable from source choices',()=>{
    const alive=createJietingPlaytest(story,'withdrawal',{aiEnabled:false});assert.equal(finish(alive),'hold-both');
    const dead=new JietingSession(story,undefined,{aiEnabled:false});assert.equal(finish(dead,{'JT-R2-FIXED':'JT-O168','JT-R3-FIXED':'JT-O199'}),'hold-masu-dies');
    const victory=createJietingPlaytest(story,'lure',{aiEnabled:false});assert.equal(finish(victory),'great-victory');
    const lose={'JT-Q1':'JT-O016','JT-Q2':'JT-O029','JT-Q3':'JT-O085','JT-Q4':'JT-O107','JT-R1-FIXED':'JT-O133','JT-R2-FIXED':'JT-O168','JT-R3-FIXED':'JT-O199'};
    assert.equal(finish(new JietingSession(story,undefined,{aiEnabled:false}),lose),'retreat');
    assert.equal(finish(new JietingSession(story,undefined,{aiEnabled:false}),{...lose,'JT-RETREAT-CHOICE':'JT-O373'}),'rear-sacrifice');
    const trapped=createJietingPlaytest(story,'withdrawal',{aiEnabled:false});assert.equal(finish(trapped,{'JT-WITHDRAW-REPLY':'withdraw-wait','JT-STAY-CONFIRM':'JT-O393'}),'mountain-trapped');assert.equal(trapped.clues.find(c=>c.id==='JT-C12').current,false);
});
test('ordinary refusal is retryable; a direct confirmed offense reaches execution only after response and scene',()=>{
    const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:true});const j=judgment(s,'none');
    assert.equal(s.submit({...j,special:{kind:'execution',quote:j.input,reason:'mock confirmed directed threat'}}),true);assert.equal(s.state.ending,null);s.advance();assert.equal(s.current.id,'JT-410');assert.equal(s.state.ending,null);assert.equal(finish(s),'execution');
    assert.equal(s.retry(),true);assert.equal(s.current.id,'JT-OPEN-R1');assert.equal(s.below,5000);assert.equal(s.state.ending,null);
});
test('stale context, evidence, duplicate submission, and fabricated saved scores/arrivals are rejected',()=>{
    const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:true});const j=judgment(s);s.state.selected=['JT-C03'];assert.equal(s.submit(j),false);
    const valid=judgment(s);assert.equal(s.submit(valid),true);assert.equal(s.submit(valid),false);
    const bad=s.snapshot();bad.scores.m+=1;assert.throws(()=>new JietingSession(story,bad));
    const noSource=createJietingPlaytest(story,'reinforcement',{aiEnabled:true}).snapshot();noSource.clueIds.push('JT-C12');noSource.clueSourceNodes['JT-C12']=['JT-192'];assert.throws(()=>new JietingSession(story,noSource));
    const troop=s.snapshot();troop.roundResults[1]={round:1,outcome:'great',troops:5000,ordered:true,arrived:true,reported:true,source:'fixed',tasks:['road']};assert.throws(()=>new JietingSession(story,troop));
});
test('lure cancellation has no penalty; only an actual launched plan can enter failed-lure retreat',()=>{
    const s=createJietingPlaytest(story,'lure',{aiEnabled:false});reach(s,'JT-LURE-CONFIRM');s.advance('JT-O306');assert.equal(s.state.flags.failedLure,undefined);
    const launched=createJietingPlaytest(story,'lure',{aiEnabled:false});reach(launched,'JT-LURE-CONFIRM');launched.advance('JT-O305');reach(launched,'JT-LURE-SIGNAL');assert.equal(launched.state.flags.failedLure,undefined);launched.advance('lure-rush-signal');reach(launched,'JT-231');assert.equal(launched.state.flags.failedLure,true);assert.equal(launched.guard.failedLurePenalty,3);
});
test('offline while awaiting follow-up falls back after reading, and online can resume an unsettled fixed choice',()=>{
    const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:true});s.submit(judgment(s,'small',{status:'followup',unresolvedConcerns:['为何要现在下山？']}));
    s.setMode({aiEnabled:false});assert.equal(s.current.kind,'open');assert.ok(s.feedback);s.advance();assert.equal(s.current.id,'JT-R1-FIXED');
    s.setMode({aiEnabled:true});assert.equal(s.current.id,'JT-OPEN-R1');assert.equal(s.below,5000);assert.equal(s.getEvaluationContext().followupUsed,true);
    s.setMode({aiEnabled:false});s.advance('JT-O131');s.advance();assert.equal(s.current.id,'JT-R1-FOLLOW');s.setMode({aiEnabled:true});assert.equal(s.current.id,'JT-OPEN-R1');assert.ok(s.state.unresolvedConcerns.length);
});
test('clue source quotes freeze the actual heard numbers rather than future placeholders',()=>{
    const s=createJietingPlaytest(story,'lure',{aiEnabled:false});const clue=s.clues.find(c=>c.id==='JT-C10');
    assert.ok(clue.sources.some(q=>q.text.includes('10,000')));assert.ok(clue.sources.every(q=>!q.text.includes('{below}')));assert.ok(clue.text.includes('20,000'));assert.ok(clue.sources.some(q=>q.node==='JT-215'));
});
test('AI-assisted lure follows narrative criteria, and its actual authority still precedes battle',()=>{
    const s=createJietingPlaytest(story,'lure',{aiEnabled:true});s.advance('JT-O277');reach(s,'JT-OPEN-LURE');
    const j=judgment(s,'accepted');assert.equal(s.submit(j),true);s.advance();assert.equal(s.current.id,'JT-303');assert.notEqual(s.state.flags.lureAuthorized,true);s.advance();assert.equal(s.state.flags.lureAuthorized,true);assert.equal(finish(s),'great-victory');
});
test('revising the last assignment can return to an earlier accepted choice without stale flags',()=>{
    const s=createJietingPlaytest(story,'withdrawal',{aiEnabled:false});reach(s,'JT-LAST-TASK');s.advance('JT-O249');reach(s,'JT-GUARD-CONFIRM');assert.equal(s.state.flags.early,true);
    s.advance('guard-adjust');s.advance('JT-O251');reach(s,'JT-GUARD-CONFIRM');assert.equal(s.state.flags.early,false);
    s.advance('guard-adjust');s.advance('JT-O249');reach(s,'JT-GUARD-CONFIRM');assert.equal(s.state.flags.early,true);
});
test('explicitly keeping the existing order never grants troops even when prior arguments were recognized',()=>{
    const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:true});const j=judgment(s,'great');s.state.draft+='不过这回先照原令。';j.input=s.state.draft;j.contextKey=s.getEvaluationContext().contextKey;j.maintain=true;j.maintainQuote='这回先照原令';j.outcome='none';assert.equal(s.submit(j),true);s.advance();reach(s,'JT-151');s.advance();assert.equal(s.below,5000);assert.equal(s.state.roundResults[1].outcome,'none');
});
test('W4 cooperation requires an earlier Wang choice; high Ma trust cannot replace it',()=>{
    for(const method of ['discussion','fixed']) {
        const r=method==='discussion'?5:7;
        assert.equal(lureEligible({w:3,m:10,r},20000,method),false);
        assert.equal(lureEligible({w:4,m:4,r},10000,method),true);
        assert.equal(lureEligible({w:10,m:3,r},20000,method),false);
    }
    assert.equal(rearReceptionEligible({w:3,m:10,r:5}),false);
    assert.equal(rearReceptionEligible({w:4,m:0,r:5}),true);
    assert.equal(earlyWithdrawalEligible({w:10,m:3,r:10}),false);
    assert.equal(earlyWithdrawalEligible({w:0,m:4,r:0}),true);
    assert.equal(guardAssessment({w:3,m:9,r:5},10000).score,21);
    assert.equal(guardAssessment({w:9,m:3,r:5},10000).score,21);
});
test('legal playtest checkpoints first visit Wang and still complete all three visits',()=>{
    const s=createJietingPlaytest(story,'lure',{aiEnabled:false});
    assert.equal(s.state.flags.firstVisit,'wang');assert.ok(s.state.chosen.includes('JT-O029'));assert.ok(!s.state.chosen.includes('JT-O031'));
    assert.deepEqual([...s.state.visits].sort(),['camp','ma','wang']);assert.deepEqual(s.scores,{w:4,m:5,r:7});
    assert.equal(s.below,20000);assert.equal(lureEligible(s.scores,s.below,'fixed'),true);
    assert.equal(story.rulesVersion,'jieting-five-rounds-topic-credit-v1');
    const mapping=JSON.parse(readFileSync(new URL('../../content/chapters/jieting/chapter-three.unlocks.json',import.meta.url)));
    assert.equal(mapping.storyVersion,story.version);assert.equal(mapping.rulesVersion,story.rulesVersion);
    assert.equal(mapping.openSettlement.lure.phone.w,4);assert.equal(mapping.openSettlement.lure.fixed.w,4);assert.equal(mapping.openSettlement.guard.receptionBonus.w,4);
});
