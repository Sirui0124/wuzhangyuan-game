import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fresh as engineFresh} from '../campaign-engine.mjs';
const fresh=options=>engineFresh({...options,rules:'three'});
import {routeAuthority} from '../route-config.mjs';
import {talkRoute,validateRouteClassification,validateRouteReply} from '../route-ai.mjs';
import {createCampaignRuntime} from '../campaign-runtime.mjs';
const checks={waitForVerifiedSearch:false,rearEscort:false,keepCover:false};
const classify=(outcome='DIALOGUE_ONLY',text='当前问题',flags={})=>({outcome,checks:{...checks,...flags},quotes:outcome==='DIALOGUE_ONLY'?[]:[{messageId:'current',text}]});
function reply(known,speakers){return {replies:(speakers||(known.front==='sha'?['沙摩柯']:['张南'])).map(speaker=>({speaker,text:'我在这里，眼前的事还没有办完。'})),claims:{status:known.status,searchVerified:known.searchVerified,planAccepted:known.planAccepted,stages:known.stages.map(({id,status})=>({id,status})),...(known.crisis?{crisis:structuredClone(known.crisis)}:{})},factRefs:['status']};}
const model=async({input})=>input.classification?reply(input.authority):classify();
async function isolated(fn){const directory=await mkdtemp(join(tmpdir(),'wzy-route-ai-'));try{await fn(directory);}finally{await rm(directory,{recursive:true,force:true});}}
const request=(s,front,text)=>({scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),front,text});

test('新路线初始事实未知，不能从对话授予实地核实或归营',async()=>{const s=fresh(),known=routeAuthority(s,'sha');assert.equal(known.searchVerified,false);assert.equal(known.status,'holding');assert.equal(known.stages.every(x=>x.status==='holding'),true);const result=await talkRoute(s,'sha','先别独自追了，等侦察的人核实后一起找。',{model:async({input})=>input.classification?reply(input.authority):classify('COOPERATE_SEARCH','等侦察的人核实后一起找',{waitForVerifiedSearch:true})});assert.equal(result.accepted,true);assert.equal(s.fronts.sha.searchVerified,false);assert.equal(s.fronts.sha.planAccepted,false);});

test('分类不能混路线、伪造引用或引用NPC原话',()=>{const s=fresh();assert.throws(()=>validateRouteClassification(classify('ARRANGE_RELAY','后队接应',{rearEscort:true,keepCover:true}),s,'sha','后队接应',[]));assert.throws(()=>validateRouteClassification(classify('COOPERATE_SEARCH','先等着',{waitForVerifiedSearch:true}),s,'camp','先等着',[]));const raw=classify('ARRANGE_RELAY','后队接应',{rearEscort:true,keepCover:true});raw.quotes=[{messageId:'npc',text:'后队接应'}];assert.throws(()=>validateRouteClassification(raw,s,'camp','嗯',[{playerId:'p',player:'你好',replyIds:['npc'],replies:[{text:'后队接应'}]}]));});

test('前队已撤出不允许追认协同；未齐备条件拒绝',()=>{const s=fresh();s.fronts.camp.stages[0].status='safe';assert.throws(()=>validateRouteClassification(classify('ARRANGE_RELAY','后队接应，掩护留守',{rearEscort:true,keepCover:true}),s,'camp','后队接应，掩护留守',[]));s.fronts.camp.stages[0].status='holding';assert.throws(()=>validateRouteClassification(classify('ARRANGE_RELAY','后队接应',{rearEscort:true}),s,'camp','后队接应',[]));});

test('结构化回应限制说话人、阶段、未知事实和重复说话人',()=>{const s=fresh(),sha=routeAuthority(s,'sha'),camp=routeAuthority(s,'camp');assert.throws(()=>validateRouteReply(reply(sha,['冯习']),sha));assert.throws(()=>validateRouteReply(reply(camp,['张南','张南']),camp));const raw=reply(sha);raw.claims.searchVerified=true;assert.throws(()=>validateRouteReply(raw,sha));const raw2=reply(camp);raw2.claims.stages[0].status='home';assert.throws(()=>validateRouteReply(raw2,camp));assert.equal(validateRouteReply(reply(camp,['张南','冯习']),camp).length,2);});

test('历史只取本路最近4轮，分类与回应收到相同窗口',async()=>{const s=fresh();s.routeTurns=Array.from({length:12},(_,i)=>({front:i%2?'sha':'camp',playerId:'p'+i,player:'问题'+i,replies:[{speaker:'张南',text:'答复'}]}));const seen=[];await talkRoute(s,'camp','继续说吧',{model:async x=>{seen.push(x.input.history);return model(x);}});assert.deepEqual(seen[0].map(x=>x.playerId),['p4','p6','p8','p10']);assert.deepEqual(seen[0],seen[1]);});

test('撤回方案优先，谈话不改变兵力、推进或实地事实',async()=>{const s=fresh();s.fronts.camp.planAccepted=true;const result=await talkRoute(s,'camp','撤回刚才的前后接力方案。',{model:async({input})=>input.classification?reply(input.authority):classify('WITHDRAW_PLAN','撤回刚才的前后接力方案')});assert.equal(result.accepted,false);assert.equal(s.round,0);assert.equal(s.reserve,2000);assert.equal(s.fronts.camp.progress,0);});

test('模型失败与取消不计问答，不写版本、资源或事实',()=>isolated(async directory=>{const runtime=createCampaignRuntime({directory,reportModel:false,routeModel:async()=>{throw Error('模拟模型故障');}});const s=await runtime.session();await assert.rejects(runtime.act('chat',request(s,'sha','你在哪儿？')),/模拟模型故障/);assert.deepEqual(await runtime.session(s.scenarioId),s);const abort=new AbortController();abort.abort();const good=createCampaignRuntime({directory,reportModel:false,routeModel:model});await assert.rejects(good.act('chat',request(s,'camp','前队怎样？'),abort.signal),/取消/);assert.deepEqual(await good.session(s.scenarioId),s);}));

test('幂等回放不重复调用模型、不重复写消息；重建保留路线对话',()=>isolated(async directory=>{let calls=0;const runtime=createCampaignRuntime({directory,reportModel:false,routeModel:async x=>{calls++;return model(x);}});let s=await runtime.session();const req=request(s,'camp','张南，前队怎么样？');s=await runtime.act('chat',req);assert.equal(calls,2);const replay=await runtime.act('chat',req);assert.deepEqual(replay,s);assert.equal(calls,2);const disk=JSON.parse(await readFile(join(directory,s.scenarioId+'.json'),'utf8'));assert.equal(disk.routeTurns.length,1);assert.equal(disk.routeTurns[0].front,'camp');assert.deepEqual(await createCampaignRuntime({directory,reportModel:false,routeModel:model}).session(s.scenarioId),s);await assert.rejects(runtime.act('chat',{...req,requestId:randomUUID()}),/已更新/);}));

test('两名说话人的回应只计一次问答，各路线独立八次',()=>isolated(async directory=>{const runtime=createCampaignRuntime({directory,reportModel:false,routeModel:async({input})=>input.classification?reply(input.authority,input.authority.front==='camp'?['张南','冯习']:undefined):classify()});let s=await runtime.session();for(let i=0;i<8;i++)s=await runtime.act('chat',request(s,'camp','前后队怎么样？'));assert.equal(s.messages.filter(m=>m.kind==='question'&&m.front==='camp').length,8);await assert.rejects(runtime.act('chat',request(s,'camp','再问一次')),/八次/);s=await runtime.act('chat',request(s,'sha','你在哪里？'));assert.equal(s.messages.filter(m=>m.kind==='question'&&m.front==='sha').length,1);assert.equal(s.round,0);assert.equal(s.reserve,2000);}));

test('分类和回应各允许一次校正重试，第一次无效不落地',async()=>{const s=fresh(),calls={classify:0,respond:0},corrections=[];const result=await talkRoute(s,'camp','后队另派护送、掩护留守营口。',{model:async({input})=>{if(input.classification){calls.respond++;if(calls.respond===1)return reply(input.authority,['沙摩柯']);corrections.push(input.correction);return reply(input.authority);}calls.classify++;if(calls.classify===1)return '{bad json';corrections.push(input.correction);return classify('ARRANGE_RELAY','后队另派护送、掩护留守营口',{rearEscort:true,keepCover:true});}});assert.equal(result.accepted,true);assert.deepEqual(calls,{classify:2,respond:2});assert.equal(corrections.filter(Boolean).length,2);assert.equal(s.fronts.camp.planAccepted,false);});

test('中途取消立即抛出，不再尝试修复模型输出',async()=>{const s=fresh(),controller=new AbortController();let calls=0;await assert.rejects(talkRoute(s,'sha','在哪里？',{signal:controller.signal,model:async()=>{calls++;controller.abort();throw Error('已取消');}}),/取消/);assert.equal(calls,1);});

test('整路holding不覆盖本人已归营的位置，旧营分说话人投影',()=>{const s=fresh();s.fronts.sha.stages[0].status='home';s.fronts.sha.stages[1].status='holding';let known=routeAuthority(s,'sha');assert.equal(known.status,'holding');assert.equal(known.location,'接应营');assert.deepEqual(known.speakerStates['沙摩柯'],{status:'home',location:'接应营'});s.fronts.camp.stages[0].status='home';s.fronts.camp.stages[1].status='holding';known=routeAuthority(s,'camp');assert.equal(known.status,'holding');assert.deepEqual(known.speakerStates['张南'],{status:'home',location:'接应营'});assert.deepEqual(known.speakerStates['冯习'],{status:'holding',location:'旧营'});});

