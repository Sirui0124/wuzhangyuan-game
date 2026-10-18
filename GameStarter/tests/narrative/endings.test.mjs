import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {chapter,NarrativeEngine,preset,tutorialInput,finish} from './weiyan-fixture.mjs';
const {endingFor,freshCollection,unlockEnding,parseCollection}=createRequire(import.meta.url)('../../.narrative-build/GameStarter/web-demo/src/endings.js');
const catalog=JSON.parse(readFileSync(new URL('../../../content/chapters/wuzhang/endings.json',import.meta.url)));
test('all terminal combinations map to one ending, including provocation before teaching completion',()=>{
 assert.equal(catalog.chapterId,chapter.id);assert.equal(new Set(catalog.endings.map(e=>e.id)).size,catalog.endings.length);
 const state=(result,completed,route='none',report='none',reason='none')=>({flags:{'loop.result':result,'progress.tutorial_completed':completed,'loop.route':route,'loop.report_status':report,'loop.execution_reason':reason}});
 for(const [s,id] of [[state('lamp_failure',false),'tutorial-blocked'],[state('tutorial_execution',true),'tutorial-sacrifice'],[state('lamp_failure',true),'no-plan'],[state('execution',false,'none','none','provocation'),'provocation'],[state('execution',true,'none','none','provocation'),'provocation'],[state('safe',true,'authorized','relayed'),'safe']])assert.equal(endingFor(catalog,s).id,id);
 assert.equal(endingFor(catalog,state('none',true)),null);
 assert.throws(()=>endingFor({...catalog,endings:[...catalog.endings,catalog.endings[0]]},state('lamp_failure',false)),/Ambiguous/);
});
test('unlocks survive replay and refresh without duplicate increments; corrupt records are rejected',()=>{
 const e=catalog.endings[0],c=unlockEnding(freshCollection(),e,'one');
 assert.equal(unlockEnding(c,e,'one'),c);assert.deepEqual(parseCollection(JSON.stringify(c),catalog),c);
 const next=unlockEnding(c,e,'two');assert.equal(next.unlocked[e.id].times,2);assert.equal(next.unlocked[e.id].firstUnlockedAt,c.unlocked[e.id].firstUnlockedAt);
 assert.throws(()=>parseCollection('{"schemaVersion":1,"unlocked":{"bad":{}}}',catalog));
 assert.throws(()=>parseCollection(JSON.stringify({...c,unlocked:{[e.id]:{...c.unlocked[e.id],times:0}}}),catalog));
});
test('unfulfilled report leads to death only after the full questioning; revival clears the loop',async()=>{
 const e=new NarrativeEngine(chapter,'ending-test',preset);tutorialInput(e);
 await e.submitFreeInput('propose_wait',['scout_statement'],'我现在去帐门传报');finish(e);
 assert.equal(e.interactions().nodeId,'tutorial.execution');
 assert.equal(e.currentLine().id,'tutorial.execution.promise');
 assert.equal(e.snapshot().flags['loop.player_alive'],true);
 const loop=e.snapshot().loopId;
 const spoken=[];while(e.currentLine()){spoken.push(e.currentLine().text);e.confirmLine(e.currentLine().id);}
 assert(spoken.includes('军情我会转呈，将军放心。'));
 assert(spoken.includes('昨夜军报，你交给谁了？谁回的令？'));
 assert.equal(e.snapshot().flags['loop.report_status'],'none');
 assert.equal(e.snapshot().flags['loop.tutorial_report_stage'],'unanswered');
 e.completeSegment({deferRestart:true});
 assert.equal(e.snapshot().flags['loop.player_alive'],false);
 assert.equal(e.snapshot().flags['loop.tutorial_report_stage'],'punished');
 assert.equal(e.snapshot().loopId,loop);assert.equal(e.snapshot().flags['loop.result'],'tutorial_execution');assert.equal(e.snapshot().flags['progress.tutorial_completed'],true);assert.equal(e.interactions().nodeId,null);
 const restored=new NarrativeEngine(chapter,'ending-test',preset);restored.load(e.save());assert.equal(endingFor(catalog,restored.snapshot()).id,'tutorial-sacrifice');
 restored.rewind(true);assert.notEqual(restored.snapshot().loopId,loop);assert.equal(restored.interactions().nodeId,'player.revival');assert.equal(restored.snapshot().flags['loop.result'],'none');assert.deepEqual(restored.snapshot().evidence,{});
});
