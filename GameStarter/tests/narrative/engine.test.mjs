import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, yes, flag, set } from './fixture.mjs';
import { validateStory } from '../../scripts/validate-story.mjs';
const require=createRequire(import.meta.url);
const {NarrativeEngine}=require('../../.narrative-build/GameStarter/assets/scripts/narrative/engine.js');
const {evaluate}=require('../../.narrative-build/GameStarter/assets/scripts/narrative/conditions.js');
const {ApiJudge}=require('../../.narrative-build/GameStarter/assets/scripts/narrative/judge.js');
const accepted=request=>({requestId:request.requestId,status:'accept',interpretedIntentId:request.intentId,supportedEvidenceIds:request.evidenceIds,missingPoints:[],explanation:'fixture acceptance'});
const judge={async judge(request){return accepted(request);}};
const make=(port=judge,chapter=fixture())=>new NarrativeEngine(chapter,'fixture-v1',port);
const finish=e=>{e.skipCurrentSegment();e.completeSegment();};
const talk=(e,scene,actor,topic)=>{e.enterScene(scene);e.selectCharacter(actor);e.openTopic(topic);finish(e);};
const collect=e=>{talk(e,'gate','guard','notice');talk(e,'front','scout','scout');};
const persuade=async(e,evidence=['notice','scout_report'])=>{e.enterScene('front');e.selectCharacter('weiyan');e.openTopic('persuade');e.skipCurrentSegment();assert.equal((await e.submitFreeInput('propose_wait',evidence,'please arrange receipt')).kind,'judged');finish(e);};
const action=(e,id,token=id)=>e.executeAction(id,token);
const direct=async e=>{collect(e);await persuade(e);action(e,'risk');action(e,'direct_deliver');};
const approval=async e=>{collect(e);e.enterScene('relay');e.selectCharacter('relay');e.presentEvidence(['notice']);e.openTopic('contact','present_evidence');e.skipCurrentSegment();await e.submitFreeInput('propose_wait',['notice','scout_report'],'please request approval');finish(e);assert.equal(e.snapshot().flags['loop.request_sent'],false);action(e,'send_request');talk(e,'gate','guard','approval');};
test('canonical fixture type and references',()=>assert.equal(validateStory(fixture()).chapterId,'fixture'));
test('direct route: actual delivery, execution lines, rewind unlocks relay',async()=>{
 const e=make();await direct(e);const s=e.snapshot();assert.equal(s.flags['loop.lamp_lit'],true);assert.equal(s.flags['loop.player_alive'],false);assert.equal(s.flags['memory.seen_execution'],false);
 assert.equal(e.currentLine().id,'execution.verdict');e.confirmLine('execution.verdict');assert.equal(e.snapshot().flags['memory.seen_execution'],true);assert.equal(e.snapshot().flags['memory.knows_relay_tent'],false);
 e.skipCurrentSegment();assert.equal(e.snapshot().flags['memory.knows_relay_tent'],true);e.completeSegment();e.rewind();assert.equal(e.snapshot().flags['loop.player_alive'],true);assert(e.interactions().scenes.some(s=>s.id==='relay'&&s.enabled));assert.equal(Object.keys(e.snapshot().evidence).length,0);
});
test('authorized route requires contact, approval, handoff, reply, relay',async()=>{
 const e=make();await direct(e);finish(e);e.rewind();await approval(e);await persuade(e,['approval','scout_report']);assert.equal(e.snapshot().flags['loop.safe'],false);
 for(const id of ['bring_relay','handoff','get_reply']){action(e,id);assert.equal(e.snapshot().flags['loop.safe'],false);}
 action(e,'relay_reply');const s=e.snapshot();assert.equal(s.flags['loop.safe'],true);assert.equal(s.flags['loop.player_alive'],true);assert.equal(s.flags['loop.lamp_lit'],true);assert.equal(s.promises.authorized.status,'fulfilled');assert.equal(s.flags['loop.npc_weiyan_saw_approval'],true);
});
test('no execution: first unrelated delay warns, second fails; no relay unlock',async()=>{
 const e=make();collect(e);await persuade(e);assert.equal(e.snapshot().flags['loop.report_status'],'none');action(e,'delay','d1');assert.equal(e.snapshot().flags['loop.lamp_lit'],true);assert.equal(e.snapshot().promises.direct.delays,1);assert(e.snapshot().history.some(h=>h.kind==='promise_warning'));action(e,'delay','d2');assert.equal(e.snapshot().flags['loop.lamp_lit'],false);e.rewind();assert(!e.interactions().scenes.some(s=>s.id==='relay'));
});
test('old approval, evidence, and NPC knowledge reset after rewind',async()=>{
 const e=make();await direct(e);finish(e);e.rewind();await approval(e);await persuade(e,['approval','scout_report']);e.rewind();const s=e.snapshot();assert.equal(s.flags['loop.jiangwei_approval'],false);assert.equal(s.flags['loop.npc_weiyan_saw_approval'],false);assert.deepEqual(s.promises,{});e.enterScene('front');e.selectCharacter('weiyan');assert.throws(()=>e.presentEvidence(['approval']),/current loop/);
});
test('opening a node grants nothing, confirming a line once, repeated media and submissions do not duplicate',async()=>{
 const e=make();e.selectCharacter('guard');e.openTopic('notice');assert.equal(e.snapshot().evidence.notice,undefined);assert.equal(e.confirmLine('wrong'),false);assert(e.confirmLine('notice.line'));const revision=e.snapshot().revision;assert.equal(e.confirmLine('notice.line'),false);assert.equal(e.snapshot().revision,revision);e.completeSegment();talk(e,'gate','guard','notice');assert.equal(e.snapshot().history.filter(h=>h.kind==='line'&&h.target==='notice.line').length,1);
 talk(e,'front','scout','scout');await persuade(e);action(e,'delay','same');assert.equal(action(e,'delay','same'),false);assert.equal(e.snapshot().promises.direct.delays,1);await persuade(e);assert.equal(e.snapshot().promises.direct.delays,1);
});
test('late AI after rewind discarded; NPC context excludes past loops and player memory',async()=>{
 let resolve,request;const e=make({judge(r){request=r;return new Promise(done=>resolve=done);}});collect(e);e.enterScene('front');e.selectCharacter('weiyan');e.openTopic('persuade');e.skipCurrentSegment();const pending=e.submitFreeInput('propose_wait',['notice','scout_report'],'wait');assert(request.context.every(x=>!x.includes('memory.')));e.rewind();resolve(accepted(request));assert.equal((await pending).kind,'stale');assert.equal(e.snapshot().flags['loop.weiyan_status'],'approaching');assert.deepEqual(e.snapshot().promises,{});
});
test('technical failure and invalid AI fields preserve input and budget',async()=>{
 const e=make({async judge(){throw new Error('offline');}});collect(e);e.selectCharacter('weiyan');e.openTopic('persuade');e.skipCurrentSegment();const s=e.snapshot();assert.equal((await e.submitFreeInput('propose_wait',['notice'],'draft text')).kind,'technical_error');assert.equal(e.snapshot().revision,s.revision);assert.equal(e.snapshot().drafts.persuade,'draft text');assert.deepEqual(e.snapshot().promises,{});
});
test('API adapter uses canonical semantic fields, no previous response ID or AI effects',async()=>{
 let sent;const api={async respond(payload){sent=payload;const r=JSON.parse(payload.text).request;return {text:JSON.stringify({...accepted(r),effects:[set('loop.safe')]})};}};
 const e=make(new ApiJudge(api));collect(e);await persuade(e);assert.equal(sent.previousResponseId,undefined);assert.equal(e.snapshot().flags['loop.safe'],false);
});
test('evidence presentation is scoped to one character/interaction',()=>{
 const e=make();collect(e);e.selectCharacter('weiyan');e.presentEvidence(['notice']);assert.equal(evaluate({evidence:'notice',mode:'presented'},e.snapshot(),{actorId:'weiyan',evidenceIds:['notice'],intentId:null}),true);e.selectCharacter('scout');assert.equal(evaluate({evidence:'notice',mode:'presented'},e.snapshot()),false);
});
test('save restore at stable boundaries; incompatible version rejected',()=>{
 const e=make();collect(e);const saved=e.save();const other=make();other.load(saved);assert.deepEqual(other.snapshot(),e.snapshot());const broken=JSON.parse(saved);broken.contentVersion='old';assert.throws(()=>other.load(JSON.stringify(broken)),/Incompatible/);broken.contentVersion='fixture-v1';broken.flags['loop.jiangwei_approval']='yes';assert.throws(()=>other.load(JSON.stringify(broken)),/flag/);
});
test('bad references, empty any, branch completion, conflicting priority rejected',()=>{
 let c=fixture();c.actions[0].effects=[set('loop.unknown')];assert.throws(()=>validateStory(c,{typecheck:false}),/unknown initialFlags/);
 c=fixture();c.scenes[0].visibleWhen={any:[]};assert.throws(()=>validateStory(c,{typecheck:false}),/empty/);
 c=fixture();c.dialogues[2].onComplete=[set('loop.safe')];assert.throws(()=>validateStory(c,{typecheck:false}),/branching/);
 c=fixture();c.dialogues.push({...c.dialogues[0],id:'competing'});assert.throws(()=>validateStory(c,{typecheck:false}),/competing topic/);
});
test('nested all/any/not/intent use a single evaluator',()=>{
 const e=make();assert(evaluate({all:[{not:flag('loop.jiangwei_approval')},{any:[{intent:'wait'},flag('loop.player_alive',false)]}]},e.snapshot(),{actorId:'weiyan',evidenceIds:[],intentId:'wait'}));
});
test('invalid response evidence cannot create state or advance time',async()=>{
 const e=make({async judge(r){return {...accepted(r),supportedEvidenceIds:['invented']};}});collect(e);e.selectCharacter('weiyan');e.openTopic('persuade');e.skipCurrentSegment();const rev=e.snapshot().revision;assert.equal((await e.submitFreeInput('propose_wait',['notice'],'x')).kind,'technical_error');assert.equal(e.snapshot().revision,rev);
});
test('late AI after changing character discarded, new input remains available',async()=>{
 let done,request;const e=make({judge(r){request=r;return new Promise(resolve=>done=resolve);}});collect(e);e.selectCharacter('weiyan');e.openTopic('persuade');e.skipCurrentSegment();const p=e.submitFreeInput('propose_wait',['notice'],'x');e.selectCharacter('scout');done(accepted(request));assert.equal((await p).kind,'stale');assert.equal(e.interactions().pending,false);
});
test('choices execute action before reply; reply effects wait for actual line confirmation',()=>{
 const c=fixture();c.dialogues.push({id:'choice',sceneId:'gate',characterId:'guard',topicId:'choice',title:'choice',targetStatement:null,trigger:'topic',priority:1,availableWhen:yes,repeat:'repeatable',lines:[],freeInput:null,onComplete:[],next:null,choices:[{id:'select',label:'select',intentId:'test',visibleWhen:yes,enabledWhen:yes,lockedText:'locked',actionId:'delay',outcome:{reply:[{id:'choice.reply',speakerId:'guard',text:'confirmed',effects:[set('loop.knows_inside')]}],effects:[],next:null}}]});
 const e=make(judge,c);e.selectCharacter('guard');e.openTopic('choice');assert(e.choose('select','choice-click'));assert.equal(e.snapshot().actions.at(-1),'delay');assert.equal(e.snapshot().flags['loop.knows_inside'],false);assert.equal(e.choose('select','choice-click'),false);assert.throws(()=>e.enterScene('front'),/Finish/);e.skipCurrentSegment();e.completeSegment();assert.equal(e.snapshot().flags['loop.knows_inside'],true);
});
test('essential authorized steps consume zero waiting budget; starting twice never resets it',async()=>{
 const e=make();await direct(e);finish(e);e.rewind();await approval(e);await persuade(e,['approval','scout_report']);action(e,'delay','warning');action(e,'bring_relay');action(e,'handoff');action(e,'get_reply');action(e,'relay_reply');assert.equal(e.snapshot().promises.authorized.delays,1);assert.equal(e.snapshot().flags['loop.safe'],true);
});
test('pack is one-way, same JSON and version hash, preserves existing meta',async()=>{
 const {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const {join,resolve}=await import('node:path');const {execFileSync}=await import('node:child_process');
 const dir=mkdtempSync(join(tmpdir(),'story-pack-test-'));try{
  const source=join(dir,'source.json'),destination=join(dir,'output');const text=JSON.stringify(fixture());writeFileSync(source,text);mkdirSync(join(destination,'fixture'),{recursive:true});writeFileSync(join(destination,'fixture','chapter.json.meta'),'keep-uuid');
  execFileSync(process.execPath,[resolve('scripts/pack-story.mjs'),source,destination]);
  assert.equal(readFileSync(source,'utf8'),text);assert.deepEqual(JSON.parse(readFileSync(join(destination,'fixture','chapter.json'),'utf8')),JSON.parse(text));assert.equal(readFileSync(join(destination,'fixture','chapter.json.meta'),'utf8'),'keep-uuid');assert.equal(JSON.parse(readFileSync(join(destination,'fixture','manifest.json'),'utf8')).contentVersion.length,64);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('invalid action destination rolls back action, effects and command token',()=>{
 const c=fixture();c.actions[0].availableWhen=yes;c.actions[0].next='missing';const e=make(judge,c);const before=e.snapshot();assert.throws(()=>e.executeAction('send_request','rollback'),/Unknown node/);assert.deepEqual(e.snapshot(),before);
});
test('new-loop NPC prompt contains no prior-loop interactions or player memory',async()=>{
 const requests=[];const e=make({async judge(r){requests.push(r);return accepted(r);}});await direct(e);finish(e);e.rewind();collect(e);await persuade(e);const r=requests.at(-1);assert(r.context.every(x=>!x.includes('memory.')&&!x.includes('judge:accept')&&!x.includes('execution')));assert.equal(e.snapshot().flags['loop.npc_weiyan_saw_approval'],false);
});
