import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {withItemDialogue} from '../web-demo/.build/GameStarter/web-demo/src/item-dialogue.js';
import {itemConductPrompt,judgeItemConduct} from '../web-demo/.build/GameStarter/web-demo/src/weiyan-item-conduct.js';
import {ChapterSession} from '../web-demo/.build/GameStarter/web-demo/src/chapter-session.js';
import {eraArrestReply} from '../web-demo/.build/GameStarter/web-demo/src/phone/era-judgment.js';
const current='魏将军，看我给你变个戏法！我拿出仙女棒，用打火机点燃，举在身前晃了个圈。你看，这满天小星星，比吵架好看吧？';
const input={stage:'authorized',current,said:[],evidence:[{id:'C08',summary:'已答应',boundary:'未交报',originals:[]}],items:[{id:'sparkler',name:'仙女棒',ability:'点燃发出火星',boundary:'需火源'}]};
const none={type:'none',quote:'',reason:'正常展示。'},fatal={type:'off_topic',quote:current,reason:'帐前点火耍闹、戏弄催报将军。'};
const ordinaryEra={version:1,severeMismatch:false,explanation:'coherent',itemIds:[],quote:'',reason:'火星不单独判妖异。'};
const verdict=(overrides={})=>({decision:{version:1,route:'radio-relay',itemIds:['sparkler'],quote:current,reason:'模拟方案被误判成立。'},mainlineEligible:true,eraAssessment:ordinaryEra,...overrides});
test('conduct execution overrides every item/mainline eligibility combination without consuming items',async()=>{
 for(const route of [null,'radio-relay','item-plan'])for(const mainlineEligible of [false,true]){
  let calls=0;
  const judge=withItemDialogue({respond:async request=>{calls++;return{text:JSON.stringify(request.text.startsWith(itemConductPrompt)?fatal:verdict({mainlineEligible,decision:{version:1,route,itemIds:route?['sparkler']:[],quote:route?current:'',reason:'物品判断'}}))};}},async()=>{throw Error('must not reach mainline');});
  const result=await judge(input,new AbortController().signal);
  assert.equal(result.npcTurn.classification.code,'execute');assert.match(result.npcTurn.reply.text,/拿下.*处斩/);
  assert.equal(result.itemDecision.route,null);assert.deepEqual(result.itemDecision.itemIds,[]);assert.equal(calls,2);
 }
});
test('era failure has priority and does not also call the conduct judge',async()=>{
 let calls=0;const era={...ordinaryEra,severeMismatch:true,explanation:'incoherent',itemIds:['sparkler'],quote:current,reason:'测试：实际效果严重异常且解释矛盾。'};
 const judge=withItemDialogue({respond:async()=>{calls++;return{text:JSON.stringify(verdict({eraAssessment:era}))};}},async()=>{throw Error('not reached');});
 const result=await judge(input,new AbortController().signal);assert.equal(calls,1);assert.ok(result.itemDecision.eraFailure);assert.equal(result.npcTurn.reply.text,eraArrestReply);
});
test('benign conduct, invalid proof and cancellation never create an execution',async()=>{
 assert.equal(await judgeItemConduct({respond:async()=>({text:JSON.stringify(none)})},input,new AbortController().signal),null);
 for(const raw of [{...fatal,quote:'未说过的话'},{...fatal,quote:''},{...fatal,type:'maybe'},null])await assert.rejects(judgeItemConduct({respond:async()=>({text:JSON.stringify(raw)})},input,new AbortController().signal));
 const controller=new AbortController();await assert.rejects(judgeItemConduct({respond:async()=>{controller.abort();return{text:JSON.stringify(fatal)};}},input,controller.signal),{name:'AbortError'});
});
test('item execution reaches the existing death screen and retry keeps purchases and authorization',async()=>{
 const json=p=>JSON.parse(readFileSync(p,'utf8'));
 const checkpoint=json('GameStarter/web-demo/.build/playtest/weiyan-second.json');
 const content=json('content/chapters/wuzhang/chapter-one.script.json'),flow=json('content/chapters/wuzhang/chapter-one.flow.json');
 const judge=withItemDialogue({respond:async request=>({text:JSON.stringify(request.text.startsWith(itemConductPrompt)?fatal:verdict({decision:{version:1,route:null,itemIds:[],quote:'',reason:'耍闹'}}))})},async()=>{throw Error('not reached');});
 const s=new ChapterSession(content,flow,checkpoint.contentVersion,judge);s.restore(JSON.stringify(checkpoint));
 const item={id:'shop-11111111-2222-4333-8444-555555555555',name:'仙女棒',price:500,ability:'点燃发火星',boundary:'需火源',source:'',quote:'测试估价',date:'2026-10-28',priceKind:'estimate',why:'测试',request:'仙女棒',searchState:'empty',sources:[]};
 assert.ok(s.buySuggestedItem(item));assert.ok(s.attachItem(item.id));s.setDraft(current);assert.ok(await s.confirmExpression());
 assert.ok(s.acknowledgeReply());assert.equal(s.snapshot().phase,'reply');assert.ok(s.finishExecution());assert.equal(s.snapshot().end,'weiyan-execution');
 const saved=s.serialize(), restored=new ChapterSession(content,flow,checkpoint.contentVersion,judge);restored.restore(saved);assert.equal(restored.snapshot().end,'weiyan-execution');
 assert.ok(restored.retryWeiyanRound());assert.equal(restored.snapshot().end,null);assert.ok(restored.collected.includes('C08'));
 assert.deepEqual(restored.snapshot().supplies,s.snapshot().supplies);assert.deepEqual(restored.snapshot().supplies.consumed,[]);
});
