import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dialogueFixtures } from '../../tools/ai/dialogue-fixtures.mjs';
import { npcTurn } from './npc-fixture.mjs';
import { parseNpcTurn } from '../web-demo/.build/GameStarter/web-demo/src/npc-dialogue.js';
import { expressionAgents } from '../web-demo/.build/GameStarter/web-demo/src/expression-agent.js';
import { parseWeiyanAssessment, decideWeiyan, guardedWeiyanReply } from '../web-demo/.build/GameStarter/web-demo/src/weiyan-judgment.js';
import { weiyanClassifierPrompt, weiyanReplyPrompt, weiyanConfig } from '../web-demo/.build/GameStarter/web-demo/src/weiyan-prompt-config.js';
import { compactWeiyanFacts, JIANG_CONFIRMED_CONSENT_FACT } from '../web-demo/.build/GameStarter/web-demo/src/weiyan-facts.js';
import { weiyanReplyAuditPrompt } from '../web-demo/.build/GameStarter/web-demo/src/weiyan-reply-audit.js';
const fixtures=await dialogueFixtures(resolve('GameStarter/web-demo/.build'));
const input=(stage='first',current='我说过的话',said=[])=>({stage,current,said,evidence:[]});
const assessment=(stage='first',missing=[],quote='我说过的话')=>({fatal:{type:'none',quote:''},checks:Object.fromEntries(weiyanConfig.stages[stage].checks.map(c=>[c.id,missing.includes(c.id)?'':quote])),unsupported:''});

test('runtime prompt and conditions match the editable design sources',()=>{
 const source=JSON.parse(readFileSync('docs/design/dialogue/weiyan-prompt.stages.json','utf8'));
 assert.equal(weiyanClassifierPrompt,readFileSync('docs/design/dialogue/weiyan-prompt.txt','utf8').replace(/\r\n/g,'\n').trim());
 assert.equal(weiyanReplyPrompt,readFileSync('docs/design/dialogue/weiyan-reply-prompt.txt','utf8').replace(/\r\n/g,'\n').trim());
 assert.equal(weiyanReplyAuditPrompt,readFileSync('docs/design/dialogue/weiyan-reply-audit-prompt.txt','utf8').replace(/\r\n/g,'\n').trim());
 for(const key of ['stages','replyIntents','replyAnchors'])assert.deepEqual(weiyanConfig[key],source[key]);
 assert.equal(weiyanConfig.classifierTemperature,source.request.classifierTemperature);
 assert.equal(weiyanConfig.replyTemperature,source.request.replyTemperature);
 assert.deepEqual(source.request.thinking,{type:'disabled'});
});

test('NPC wire contract rejects malformed, cross-stage, foreign-evidence and speaker-swapped output',()=>{
 const original=npcTurn({stage:'first'});assert.deepEqual(parseNpcTurn(original,'first',[]),original);
 for(const change of [x=>{x.schemaVersion=2;},x=>{x.npcId='jiangwei';},x=>{x.extra=true;},x=>{x.classification.code='P2-F4';},x=>{x.classification.disposition='revise';},x=>{x.classification.reason='';},x=>{x.classification.evidenceIds=['C08'];},x=>{x.reply.speaker='守卒';},x=>{x.reply.text='';},x=>{x.reply.text='P2-F4';},x=>{x.reply.extra=true;}]) {
  const candidate=structuredClone(original);change(candidate);assert.throws(()=>parseNpcTurn(candidate,'first',[]));
 }
 assert.throws(()=>parseNpcTurn('ok','first',[]));
 for(const stage of ['first','authorized']){
  const failure=npcTurn({stage});failure.classification.code='execute';failure.classification.disposition='execute';failure.reply.text='放肆！拿下，处斩！';
  assert.deepEqual(parseNpcTurn(failure,stage,[]),failure);failure.classification.disposition='revise';assert.throws(()=>parseNpcTurn(failure,stage,[]));
 }
});

test('all quotes are continuous confirmed speech; fatal quotes must come from current speech',()=>{
 const a=assessment();assert.deepEqual(parseWeiyanAssessment(a,input()),a);
 const history=assessment('first',[],'之前说过');assert.ok(parseWeiyanAssessment(history,input('first','现在补充',['之前说过'])));
 for(const mutation of [x=>{x.checks.ban='资料里才有';},x=>{x.checks.extra='';},x=>{delete x.checks.ban;},x=>{x.unsupported='不存在的句子';},x=>{x.checks.ban=' ';},x=>{x.fatal={type:'offense',quote:'之前说过'};},x=>{x.fatal={type:'none',quote:'我说过的话'};},x=>{x.fatal={type:'other',quote:'我说过的话'};},x=>{x.extra=true;}]){
  const invalid=structuredClone(a);mutation(invalid);assert.throws(()=>parseWeiyanAssessment(invalid,input('first','我说过的话',['之前说过'])));
 }
 const contradictory=assessment();contradictory.unsupported='我说过的话';
 const conservative=parseWeiyanAssessment(contradictory,input());
 assert.deepEqual(conservative.checks,{situation:'',ban:'',relay:''});assert.equal(conservative.unsupported,'我说过的话');
 assert.deepEqual(decideWeiyan('first',conservative),{result:'clarify',reason:'unsupported',code:'R1-RETRY'});
 assert.equal(contradictory.checks.situation,'我说过的话');
});

test('mapping exposes only accept, clarify and execute, and identifies the actual earliest missing condition',()=>{
 for(const stage of ['first','authorized']){
  assert.equal(decideWeiyan(stage,assessment(stage)).result,'accept');
  for(const c of weiyanConfig.stages[stage].checks){const d=decideWeiyan(stage,assessment(stage,[c.id]));
   if(weiyanConfig.stages[stage].optionalChecks.includes(c.id)) assert.equal(d.result,'accept');
   else {assert.equal(d.result,'clarify');assert.equal(d.reason,c.id);}}
  const a=assessment(stage);a.unsupported='另一句无据的话';assert.equal(decideWeiyan(stage,a).reason,'unsupported');
  for(const type of ['off_topic','offense']){a.fatal={type,quote:'当前冒犯原话'};assert.deepEqual(decideWeiyan(stage,a),{result:'execute',reason:type,code:'execute'});}
 }
 assert.equal(decideWeiyan('first',assessment('first',['situation','ban'])).reason,'ban');
 assert.equal(decideWeiyan('authorized',assessment('authorized',['following'])).code,'P2-F4');
});

test('a model cannot grant missing C08 through a valid authorization quote',async()=>{
 const session=await fixtures.authorized();
 const current='伯约亲口答应在帐外接报。前夜闻号即退，今夜不退还随我军换向，可能在试探。请现在到帐外向伯约当面交报，不入丞相帐。';
 const authorized=session.expressionContext(current);
 const missing={...authorized,evidence:authorized.evidence.filter(clue=>clue.id!=='C08')};
 const claimed=assessment('authorized',[],current);
 const checked=parseWeiyanAssessment(claimed,missing);
 assert.equal(checked.checks.authorization,'');
 assert.equal(claimed.checks.authorization,current,'Do not mutate the model output');
 assert.equal(decideWeiyan('authorized',checked).reason,'authorization');
 assert.equal(decideWeiyan('authorized',parseWeiyanAssessment(claimed,authorized)).result,'accept');
 const responses=[claimed,{reply:'这是伯约亲口答应的？'}];
 const turn=await expressionAgents({respond:async()=>({text:JSON.stringify(responses.shift())})}).judge(missing,new AbortController().signal);
 assert.equal(turn.classification.code,'P2-F1');
 assert.equal(turn.classification.disposition,'revise');
 assert.equal(turn.reply.text,'这是伯约亲口答应的？');
 const fatal={...claimed,fatal:{type:'offense',quote:'伯约'}};
 assert.equal(decideWeiyan('authorized',parseWeiyanAssessment(fatal,missing)).result,'execute');
});

test('adapter separates facts from actual speech and uses a fixed accept with one low-temperature request',async()=>{
 for(const stage of ['first','authorized']){
  const calls=[],a=assessment(stage),i=input(stage);i.evidence=[{id:'C08',summary:'只存在资料里的事实',boundary:'不能算实说',originals:[]}];
  const agent=expressionAgents({respond:async request=>{calls.push(request);return{text:JSON.stringify(a)};}});
  const turn=await agent.judge(i,new AbortController().signal);
  assert.equal(turn.classification.code,'ok');assert.equal(turn.reply.text,weiyanConfig.stages[stage].fixedAcceptReply);assert.equal(calls.length,1);
  const source=JSON.parse(calls[0].text.split('\n资料：')[1]);assert.deepEqual(source.facts,compactWeiyanFacts(i.evidence));assert.equal(source.current,i.current);assert.deepEqual(source.spokenTurns,[i.current]);assert.equal(source.said,undefined);
  assert.equal(calls[0].temperature,0);assert.equal(calls[0].thinking,undefined);assert.doesNotMatch(calls[0].text,/enable.*thinking/);
 }
});

test('compact facts use actual acquired IDs, preserve boundaries, and distinguish duty from a later real commitment',async()=>{
 const branchB=fixtures.first(undefined,undefined,'b').expressionContext('营门未破，姜维答应了');
 const unknown=compactWeiyanFacts(branchB.evidence);
 assert.equal(unknown.status.campSituation.state,'未知');assert.deepEqual(unknown.status.campSituation.sources,[]);
 assert.equal(unknown.status.jiangConsent.state,'未取得');
 assert.deepEqual(unknown.status.jiangConsent.sources,[]);assert.doesNotMatch(JSON.stringify(unknown),/等候魏延|判断是否禀报丞相/);
 assert.deepEqual(unknown.known.map(c=>c.id),['C05','C06']);assert.match(unknown.known.find(c=>c.id==='C05').boundary,/不能确认|不证明/);
 const second=(await fixtures.authorized()).expressionContext('');
 const duty=compactWeiyanFacts(second.evidence.filter(c=>c.id!=='C08'));
 assert.equal(duty.status.jiangConsent.state,'未取得');assert.equal(duty.status.campSituation.state,'已知');
 assert.deepEqual(duty.status.jiangConsent.sources,[]);assert.doesNotMatch(JSON.stringify(duty),/等候魏延|判断是否禀报丞相/);
 const actual=compactWeiyanFacts(second.evidence);
 assert.equal(actual.status.jiangConsent.state,'已确认');assert.deepEqual(actual.status.jiangConsent.sources,['C08']);
 assert.equal(actual.status.jiangConsent.detail,JIANG_CONFIRMED_CONSENT_FACT);
 assert.equal(actual.known.find(c=>c.id==='C08').fact,JIANG_CONFIRMED_CONSENT_FACT);
 assert.match(actual.status.jiangConsent.detail,/判断是否禀报丞相/);assert.match(actual.status.jiangConsent.detail,/帐外等候魏延/);
 assert.ok(actual.known.some(c=>c.id==='C07'));  
 assert.equal(actual.known.length,second.evidence.length);assert.ok(actual.known.every(c=>!Object.hasOwn(c,'originals')));
 assert.ok(JSON.stringify(actual).length<JSON.stringify(second.evidence).length);
 assert.equal(compactWeiyanFacts(fixtures.first().expressionContext('').evidence).status.campSituation.state,'已知');
});

test('reply generation receives only the locked result and intent; only execution gets current speech',async()=>{
 for(const fatal of [false,true]){
  const calls=[],i=input('first','我说过的话'),a=assessment('first',['relay']);if(fatal)a.fatal={type:'offense',quote:i.current};
  const responses=[a,{reply:fatal?'放肆！拿下，处斩！':weiyanConfig.replyIntents.relay}];
  const turn=await expressionAgents({respond:async request=>{calls.push(request);return{text:JSON.stringify(responses.shift())};}}).judge(i,new AbortController().signal);
  assert.equal(turn.classification.code,fatal?'execute':'R1-RETRY');assert.equal(calls.length,2);assert.deepEqual(calls.map(c=>c.temperature),[0,0.2]);
  const source=JSON.parse(calls[1].text.split('\n资料：')[1]);assert.deepEqual(Object.keys(source),fatal?['result','intent','current']:['result','intent']);assert.equal(source.result,fatal?'execute':'clarify');
 }
});

test('bad classifier output and outages remain technical failures, with no generated story fallback',async()=>{
 for(const response of ['invalid',JSON.stringify({fatal:{type:'none',quote:''},checks:{},unsupported:''}),JSON.stringify(assessment('authorized'))]){
  let calls=0;await assert.rejects(expressionAgents({respond:async()=>{calls++;return{text:response};}}).judge(input(),new AbortController().signal));assert.equal(calls,1);
 }
 await assert.rejects(expressionAgents({respond:async()=>{throw Error('offline');}}).judge(input(),new AbortController().signal),/offline/);
});

test('an unsupported camp claim keeps other valid speech but cannot pass branch B',async()=>{
 const current='将军，营门还没被突破，眼下不必强闯。帐内确实不许进去，我现在替您转呈。';
 const i=fixtures.first(undefined,undefined,'b').expressionContext(current);
 assert.deepEqual(i.evidence.map(e=>e.id),['C05','C06']);
 const a={fatal:{type:'none',quote:''},checks:{situation:'营门还没被突破，眼下不必强闯',ban:'帐内确实不许进去',relay:'我现在替您转呈'},unsupported:'营门还没被突破'};
 const calls=[],responses=[a,{reply:'这话有何凭据？说清楚。'}];
 const turn=await expressionAgents({respond:async request=>{calls.push(request);return{text:JSON.stringify(responses.shift())};}}).judge(i,new AbortController().signal);
 assert.equal(turn.classification.code,'R1-RETRY');assert.match(turn.classification.reason,/尚无依据/);
 assert.equal(calls.length,2);assert.match(calls[0].text,/仅听见阵前叫嚷不证明营门未破/);
 assert.deepEqual(JSON.parse(calls[1].text.split('\n资料：')[1]),{result:'clarify',intent:weiyanConfig.replyIntents.unsupported});
});

test('a valid first-round earlier proposal is included in spokenTurns and remains quotable after a factual supplement',async()=>{
 const said=['我现在替您转呈，绝不耽误军情，您别闯。'];
 const current='营门尚未突破，眼下还不必强闯。今夜帐内确实不许进入。';
 const i=fixtures.first().expressionContext(current);i.said=said;
 const a={fatal:{type:'none',quote:''},checks:{situation:'营门尚未突破，眼下还不必强闯',ban:'今夜帐内确实不许进入',relay:said[0]},unsupported:''};
 const calls=[];const turn=await expressionAgents({respond:async request=>{calls.push(request);return{text:JSON.stringify(a)};}}).judge(i,new AbortController().signal);
 assert.equal(turn.classification.code,'ok');assert.equal(calls.length,1);
 const source=JSON.parse(calls[0].text.split('\n资料：')[1]);assert.deepEqual(source.spokenTurns,[...said,current]);assert.equal(source.current,current);
 assert.equal(source.facts.status.campSituation.state,'已知');
});

test('bad wording falls back to the reviewed intent without a third model request or changed classification',async()=>{
 const d={result:'clarify',reason:'following',code:'P2-F4'},fallback=weiyanConfig.replyIntents.following;
 for(const reply of ['军情有什么变化？','我去递报，好吗？','你去帐外候着，如何？','主角下一步干什么？','字'.repeat(46),'我军调动时，敌军呢？保证无事。'])assert.equal(guardedWeiyanReply({reply},'authorized',d),fallback);
 for(const reply of ['再敢胡言，拿下处斩！','不必拿下处斩。','放肆！'])assert.equal(guardedWeiyanReply({reply},'first',{result:'execute',reason:'offense',code:'execute'}),weiyanConfig.replyIntents.offense);
 assert.equal(guardedWeiyanReply({reply:'我军换向时，敌军如何应对？'},'authorized',d),'我军换向时，敌军如何应对？');
 for(const reply of ['莫把猜测当作军情，我军换向时敌军如何？','不要将猜测视为实情，我军换向时敌军如何？','别拿猜测当军情，我军换向时敌军如何？'])assert.equal(guardedWeiyanReply({reply},'authorized',d),fallback);
 for(const bad of ['not-json',JSON.stringify({reply:'我去递报，如何？'}),null]){
  let calls=0;const agent=expressionAgents({respond:async()=>{calls++;if(calls===1)return{text:JSON.stringify(assessment('first',['relay']))};if(bad===null)throw Error('wording unavailable');return{text:bad};}});
  const turn=await agent.judge(input(),new AbortController().signal);assert.equal(turn.classification.code,'R1-RETRY');assert.equal(turn.reply.text,weiyanConfig.replyIntents.relay);assert.equal(calls,2);
 }
});

test('cancellation between classifier and reply cannot return even a fixed fallback',async()=>{
 const controller=new AbortController();let calls=0;
 const agent=expressionAgents({respond:async()=>{calls++;controller.abort();return{text:JSON.stringify(assessment())};}});
 await assert.rejects(agent.judge(input(),controller.signal),/abort/i);assert.equal(calls,1);
 const second=new AbortController();calls=0;
 const replyAgent=expressionAgents({respond:async()=>{calls++;if(calls===1)return{text:JSON.stringify(assessment('first',['relay']))};second.abort();throw Error('stale');}});
 await assert.rejects(replyAgent.judge(input(),second.signal),/abort/i);assert.equal(calls,2);
});

test('independent reply audit rejects invented facts even when the shape guard allows the candidate',async()=>{
 const cases=[
  {stage:'authorized',reason:'authorization',text:'伯约已经撤回承诺，这是他亲口答应的吗？'},
  {stage:'first',reason:'relay',text:'敌军已经退去，这军报由谁去传？'},
  {stage:'first',reason:'offense',text:'你已拔刀杀人，拿下，处斩！'},
 ];
 for(const c of cases){
  const i=input(c.stage),a=assessment(c.stage,[c.reason]);if(c.reason==='offense')a.fatal={type:'offense',quote:i.current};
  const decision=decideWeiyan(c.stage,a);assert.equal(guardedWeiyanReply({reply:c.text},c.stage,decision),c.text);
  const calls=[],responses=[a,{reply:c.text},{equivalent:false}];
  const turn=await expressionAgents({respond:async request=>{calls.push(request);return{text:JSON.stringify(responses.shift())};}}).judge(i,new AbortController().signal);
  assert.equal(turn.classification.code,decision.code);assert.equal(turn.reply.text,weiyanConfig.replyIntents[c.reason]);
  assert.equal(calls.length,3);assert.deepEqual(calls.map(c=>c.temperature),[0,0.2,0]);
  assert.deepEqual(JSON.parse(calls[2].text.split('\n资料：')[1]),{speaker:'魏延',intent:weiyanConfig.replyIntents[c.reason],candidate:c.text});
 }
});

test('equivalent short paraphrases require a strict audit while reviewed original wording skips it',async()=>{
 const candidate='我军换向时，敌军如何应对？',intent=weiyanConfig.replyIntents.following;
 const authorized=(await fixtures.authorized()).expressionContext('我说过的话');
 for(const text of [candidate,intent]){
  const calls=[],responses=[assessment('authorized',['following']),{reply:text},{equivalent:true}];
  const turn=await expressionAgents({respond:async request=>{calls.push(request);return{text:JSON.stringify(responses.shift())};}}).judge(authorized,new AbortController().signal);
  assert.equal(turn.classification.code,'P2-F4');assert.equal(turn.reply.text,text);assert.equal(calls.length,text===intent?2:3);
 }
});

test('reply audit denial, invalid format and service errors fall back without changing the decision',async()=>{
 const candidate='我军换向时，敌军如何应对？';
 const authorized=(await fixtures.authorized()).expressionContext('我说过的话');
 for(const audit of ['not-json','null','[]','{"equivalent":"true"}','{"equivalent":true,"reply":"胡乱替换"}','{"equivalent":false}',null]){
  let calls=0;
  const turn=await expressionAgents({respond:async()=>{
   calls++;if(calls===1)return{text:JSON.stringify(assessment('authorized',['following']))};
   if(calls===2)return{text:JSON.stringify({reply:candidate})};
   if(audit===null)throw Error('audit unavailable');return{text:audit};
  }}).judge(authorized,new AbortController().signal);
  assert.equal(calls,3);assert.equal(turn.classification.code,'P2-F4');assert.equal(turn.reply.text,weiyanConfig.replyIntents.following);
 }
});

test('cancellation during reply audit propagates instead of displaying even a reviewed fallback',async()=>{
 const authorized=(await fixtures.authorized()).expressionContext('我说过的话');
 for(const reject of [false,true]){
  const controller=new AbortController();let calls=0;
  const agent=expressionAgents({respond:async()=>{
   calls++;if(calls===1)return{text:JSON.stringify(assessment('authorized',['following']))};
   if(calls===2)return{text:JSON.stringify({reply:'我军换向时，敌军如何应对？'})};
   controller.abort();if(reject)throw Error('cancelled');return{text:'{"equivalent":true}'};
  }});
  await assert.rejects(agent.judge(authorized,controller.signal),/abort/i);assert.equal(calls,3);
 }
});

test('AI refusal is actually displayed and persisted, with explicit revision and no story grants',async()=>{
 const s=fixtures.first(async input=>npcTurn(input,'R1-RETRY','等不得。眼下急报如何处置？'));
 s.setFocus('先等一等');s.setDraft('等到明日再报。');const context=s.expressionContext(s.snapshot().story.draft);assert.equal(context.current,'等到明日再报。');assert.equal('focus' in context,false);
 await s.confirmExpression();assert.equal(s.snapshot().phase,'spoken');assert.equal(s.currentReply(),null);assert.equal(s.snapshot().story.history.length,0);
 s.acknowledgeReply();assert.equal(s.currentReply().text,'等不得。眼下急报如何处置？');assert.equal(s.snapshot().story.history[0].npcTurn.classification.code,'R1-RETRY');assert.equal(s.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,undefined);
 s.openNotes();const restored=fixtures.first();restored.restore(s.serialize());restored.closeNotes();assert.equal(restored.currentReply().text,s.snapshot().speech.npcTurn.reply.text);assert.deepEqual(restored.snapshot().story.history,s.snapshot().story.history);
 const raw=restored.snapshot();raw.story.history[0].npcTurn.reply.text='篡改回应';assert.throws(()=>fixtures.first().restore(JSON.stringify(raw)));
 assert.ok(restored.reviseExpression());assert.equal(restored.snapshot().story.draft,'等到明日再报。');assert.equal(restored.snapshot().composition.focus,'先等一等');
});

test('accepted AI text overlays the real story row and cannot complete a report early',async()=>{
 for(const stage of ['first','authorized']){
  const judge=async input=>npcTurn(input,'ok','带路，我亲自去问明。');const s=stage==='first'?fixtures.first(judge):await fixtures.authorized(judge);
  s.setDraft('测试实际发言');await s.confirmExpression();assert.equal(s.snapshot().story.flags.PERSUADED,undefined);assert.equal(s.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,stage==='first'?undefined:s.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED);
  s.acknowledgeReply();const target=stage==='first'?'A-40B':'W07';while(s.row()?.id!==target)assert.ok(s.nextLine());assert.equal(s.row().text,'带路，我亲自去问明。');assert.equal(s.snapshot().story.flags.REPORT_CLOSED,undefined);
  const restored=stage==='first'?fixtures.first():await fixtures.authorized();restored.restore(s.serialize());assert.equal(restored.row().text,'带路，我亲自去问明。');
  if(stage==='first'){assert.equal(s.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,undefined);s.nextLine();assert.equal(s.snapshot().story.flags.FIRST_TRANSFER_ACCEPTED,true);}
 }
});

test('cancelled/restarted late NPC JSON never mutates the session; legacy enum-only runtime output fails',async()=>{
 for(const change of [s=>s.cancelSpeech(),s=>s.restart()]){
  let resolve;const s=fixtures.first(()=>new Promise(ok=>resolve=ok));s.setDraft('我去报');const pending=s.confirmExpression();change(s);const before=s.serialize();resolve(npcTurn({stage:'first'}));await pending;assert.equal(s.serialize(),before);
 }
 const s=fixtures.first(async()=> 'ok');s.setDraft('我去报');assert.equal(await s.confirmExpression(),false);assert.equal(s.snapshot().speech.status,'failed');assert.equal(s.acknowledgeReply(),false);
});
