import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base=new URL('../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-three/',import.meta.url);
const {JietingSession,createJietingPlaytest}=await import(new URL('session.js',base));
const {deploymentProgress,deploymentAxisHTML}=await import(new URL('deployment-view.js',base));
const story=JSON.parse(readFileSync(new URL('../../content/chapters/jieting/chapter-three.story.json',import.meta.url)));
const picks={'JT-Q1':'JT-O018','JT-Q2':'JT-O029','JT-Q3':'JT-O093','JT-Q4':'JT-O111','JT-R1-FIXED':'JT-O132','JT-R2-FIXED':'JT-O167','JT-R3-FIXED':'JT-O198'};
function reach(s,target){for(let n=0;n<500&&s.current.id!==target;n++){const pick=picks[s.current.id]??(s.current.id==='JT-VISIT-REMAINING'?s.options[0]?.id:undefined);assert.ok(s.advance(s.current.kind==='choice'?pick:undefined),s.current.id);}assert.equal(s.current.id,target);}
function until(s,predicate){for(let n=0;n<120&&!predicate(s.current);n++)assert.ok(s.advance(),s.current.id);assert.ok(predicate(s.current));}
function judgment(s,{followup=false,outcome='great'}={}){
    s.state.draft='山下两处都要守，下山列阵也得花工夫，请将军先拨兵守路。';
    const c=s.getEvaluationContext();
    return {version:1,nodeId:c.nodeId,contextKey:c.contextKey,input:s.state.draft,clueIds:[...s.state.selected],phase:c.phase,round:c.round,status:followup?'followup':'final',outcome,
        response:followup?'你说两处都要守，我听明白了。为何不能等山下告急再派人？':'守路的人手与下山列阵的工夫，都得提前想好。',reasoning:{linked:outcome!=='none',quote:s.state.draft,clueIds:['JT-C04','JT-C08'],conclusion:'两处岗位不能空，下山列阵费时，需要提前增援'},reinforcementAssessment:{supportedTroops:outcome==='great'?5000:outcome==='small'?3000:0,quote:s.state.draft,reason:'受控测试支持人数'},
        criteria:{factsReliable:true,gapEstablished:outcome!=='none',reinforcementUse:outcome!=='none',concernAnswered:outcome==='great',risk:false,route:false,reception:false,motive:false,means:false,withdrawal:false},verifiedClueIds:[],acceptedReasons:[],unresolvedConcerns:followup?['为何现在增兵']:[],deploymentTasks:['road'],argument:{topic:'road',quote:s.state.draft,clueIds:['JT-C04','JT-C08']}};
}

test('the axis follows actual order and arrival events instead of awarding troops for an accepted choice',()=>{
    const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:false,phoneAllowed:false});
    assert.deepEqual([deploymentProgress(s).below,deploymentProgress(s).above,deploymentProgress(s).remaining],[5000,20000,5]);
    s.advance('JT-O132');let view=deploymentProgress(s);
    assert.deepEqual([view.below,view.proposed,view.remaining,view.stage],[5000,5000,4,'proposed']);
    until(s,n=>n.effects?.some(e=>e.type==='round-order'));s.advance();view=deploymentProgress(s);
    assert.deepEqual([view.below,view.proposed,view.stage],[5000,5000,'ordered']);
    until(s,n=>n.effects?.some(e=>e.type==='round-arrival'));s.advance();view=deploymentProgress(s);
    assert.deepEqual([view.below,view.above,view.proposed,view.stage],[10000,15000,0,'arrived']);
    assert.equal(view.below+view.above,25000);
    const before=structuredClone(s.state);deploymentAxisHTML(s,5000);deploymentProgress(s);assert.deepEqual(s.state,before);
});

test('an AI followup, the local final reply and settled decisions use separate round accounting',()=>{
    const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:true,phoneAllowed:false});
    assert.ok(s.submit(judgment(s,{followup:true,outcome:'small'})));
    assert.deepEqual([deploymentProgress(s).remaining,deploymentProgress(s).proposed,deploymentProgress(s).stage],[5,0,'followup']);
    s.advance();assert.equal(s.state.followupUsed['JT-OPEN-R1'],true);assert.equal(deploymentProgress(s).remaining,5);
    assert.ok(s.submit(judgment(s)));
    assert.deepEqual([deploymentProgress(s).remaining,deploymentProgress(s).proposed,deploymentProgress(s).below],[5,5000,5000]);
    s.advance();assert.equal(deploymentProgress(s).remaining,4);assert.equal(s.below,5000);
});

test('a smaller accepted proposal previews 3000; an unsuccessful round consumes one opportunity and no troops',()=>{
    for(const [outcome,troops] of [['small',3000],['none',0]]){
        const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:true,phoneAllowed:false});
        assert.ok(s.submit(judgment(s,{outcome})));assert.equal(deploymentProgress(s).proposed,troops);
        s.advance();assert.equal(deploymentProgress(s).remaining,4);assert.equal(s.below,5000);
    }
});

test('three successful rounds reach the 20000 deployment goal and skip the two remaining attempts',()=>{
    const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:false,phoneAllowed:false});
    reach(s,'JT-ROUTE-CHOICE');const p=deploymentProgress(s);
    assert.deepEqual([p.below,p.above,p.remaining,p.stage],[20000,5000,0,'goal']);
    assert.equal(p.lureMinimum,10000);assert.equal(p.targetBelow,20000);assert.match(p.status,/目标达成/);
    assert.ok(!s.state.visited.includes('JT-OPEN-R4')&&!s.state.visited.includes('JT-R4-FIXED'));
    const restored=new JietingSession(story,structuredClone(s.state),{aiEnabled:false});assert.deepEqual(deploymentProgress(restored),p);
    assert.equal(deploymentAxisHTML(restored),'','The second-act display does not appear on the third-act route choice');
});

test('the expanded command clue requires the new Wang Ping source; compatible old saves do not gain unheard facts',()=>{
    const s=new JietingSession(story,undefined,{aiEnabled:false});reach(s,'JT-WANG-CAMP-ORDER');
    assert.ok(!s.clues.find(c=>c.id==='JT-C01').text.includes('营寨'));
    s.advance();const clue=s.clues.find(c=>c.id==='JT-C01');
    assert.ok(clue.text.includes('营寨须扎在要道上'));assert.ok(clue.sources.some(source=>source.node==='JT-WANG-CAMP-ORDER'));
    assert.equal(s.clues.filter(c=>c.id==='JT-C01').length,1);assert.equal(story.clues.length,12);
    const oldStory=structuredClone(story);oldStory.nodes=oldStory.nodes.filter(n=>n.id!=='JT-WANG-CAMP-ORDER');
    oldStory.nodes.find(n=>n.id==='JT-036').next='JT-037';
    oldStory.clues.find(c=>c.id==='JT-C01').sources=oldStory.clues.find(c=>c.id==='JT-C01').sources.filter(source=>source.node!=='JT-WANG-CAMP-ORDER');
    const old=new JietingSession(oldStory,undefined,{aiEnabled:false});reach(old,'JT-R1-FIXED');
    const restored=new JietingSession(story,structuredClone(old.state),{aiEnabled:false});
    assert.ok(!restored.clues.find(c=>c.id==='JT-C01').text.includes('营寨'));
    assert.ok(!restored.state.sourceReadings['JT-WANG-CAMP-ORDER']);assert.equal(restored.current.id,'JT-R1-FIXED');
});
