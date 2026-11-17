import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fresh as currentFresh,orders,settle,assertLedger,derive} from '../campaign-engine.mjs';
import {createCampaignRuntime} from '../campaign-runtime.mjs';
import {authority,validateReply} from '../fu-ai.mjs';
import {resolveCampaignOrders} from '../.build/campaign-intent.js';
// The previous schema remains playable without inventing 500 extra soldiers.
function fresh(options){const s=currentFresh(options);s.total=2000;s.balanceVersion='shared-2000-v1';s.units={};s.nextUnit=1;return s;}
const o=(men,target='sha',action='rescue',unit='new')=>({unit,men,target,action,rush:false,via:'normal'});
test('傅肜回话可引用实际死讯来源，不能引用不存在的证据',()=>{
 const known=authority(fresh()),r={reply:'是吴军喊的消息。',claims:{liubei:'unverified',comrades:'dead',furong:'holding'},factRefs:['deathClaimSource']};assert.equal(validateReply(r,known),r.reply);assert.throws(()=>validateReply({...r,factRefs:['inventedEvidence']},known));
});
test('共享战场中的真实AI接口接收核实事实，受控完整说服不推进轮次',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wzy-campaign-'));try{
 const model=async({input})=>input.classification?{reply:'我回去继续护陛下，也把弟兄们的事告诉他。',claims:{liubei:input.authority.liubei,comrades:'dead',furong:input.authority.furong},factRefs:['liubeiAliveVerified']}:{outcomeId:'ACCEPT_CONTINUED_SERVICE',checks:{requestsWithdrawal:true,acknowledgesLoss:true,continuedDuty:true},quotes:[{messageId:'current',text:input.current.text}]};
 const r=createCampaignRuntime({directory,cooldownMs:0,model});let s=await r.session();const act=async(kind,x)=>s=await r.act(kind,{scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),...x});
 await assert.rejects(act('chat',{front:'fu',text:'跟我回去，继续护陛下，也把弟兄们的事告诉他。'}),/条件/);
 await act('orders',{orders:[o(100,'fu','verify')]});await act('round',{trigger:'endRound'});const round=s.round;await act('chat',{front:'fu',text:'跟我回去，继续护陛下，也把弟兄们的事告诉他。'});assert.equal(s.facts.withdrawalAccepted,true);assert.equal(s.round,round);assert.equal(s.reserve,1900);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('兼容旧局2000待命、无预编队；百人粒度与整批原子校验',()=>{
 const s=fresh();assert.equal(s.reserve,2000);assert.deepEqual(s.units,{});
 for(const n of [-100,0,50,150,2100,NaN])assert.throws(()=>orders(s,[o(n)]));
 assert.throws(()=>orders(s,[o(400),o(1800)]));assert.equal(s.reserve,2000);assert.equal(s.nextUnit,1);
 orders(s,[o(400),o(300,'camp'),o(300,'fu')]);assert.equal(s.reserve,1000);assertLedger(s);
});
test('最多5队；取消退回资源，编号不复用，行军与归途占位',()=>{
 const s=fresh();orders(s,Array.from({length:5},()=>o(100)));assert.throws(()=>orders(s,[o(100)]),/最多/);
 orders(s,[{...o(undefined,null,'retreat','3')}]);assert.equal(s.reserve,1600);orders(s,[o(100)]);assert.ok(s.units['6']);assert.equal(s.units['3'],undefined);
 settle(s);orders(s,[o(undefined,null,'retreat','1')]);settle(s);assert.equal(s.units['1'].state,'returning');assert.throws(()=>orders(s,[o(100)]),/最多/);settle(s);assert.ok(!s.units['1']);assertLedger(s);
});
test('伤亡精确到人；不取整、不隔空补员，归营守恒',()=>{
 const s=fresh({seed:753});orders(s,[o(500)]);settle(s);settle(s);assert.ok(s.wounded+s.dead>0);assert.ok(s.units['1'].men<500);assert.throws(()=>orders(s,[o(500,'sha','relieve','1')]),/隔空/);
 const survivors=s.units['1'].men;orders(s,[o(undefined,null,'retreat','1')]);settle(s);settle(s);assert.equal(s.reserve,1500+survivors);assertLedger(s);
});
test('侦察与核实有实际行程，原部众不会计入兵池',()=>{
 const s=fresh();orders(s,[o(100,'fu','verify'),{...o(100,'fu','scout'),via:'side'}]);assert.equal(s.facts.liubeiAliveVerified,false);settle(s);assert.equal(s.facts.liubeiAliveVerified,true);assert.equal(s.facts.liubeiSafeConfirmed,false);assert.equal(s.facts.alternateRouteOpen,true);settle(s);assert.equal(s.facts.liubeiSafeConfirmed,true);assert.equal(s.reserve,2000);assertLedger(s);
});
test('重复任务不叠知识，军事收益随兵力有上限；一队只占一个岗',()=>{
 const a=fresh({seed:9891}),b=fresh({seed:9891});orders(a,[o(100,'fu','relieve')]);orders(b,[o(400,'fu','relieve')]);settle(a);settle(b);settle(a);settle(b);assert.ok(b.fronts.fu.urgency<a.fronts.fu.urgency);
 orders(b,[o(undefined,'fu','rescue','1')]);derive(b);assert.equal(b.facts.reliefInPosition,true,'未结束本轮，旧岗位仍有效');settle(b);assert.equal(b.facts.reliefInPosition,false);assert.equal(b.facts.escortReady,true);assertLedger(b);
});
test('自然语言新编、现有残兵、手选补足和冲突拒绝',()=>{
 const auto={unit:'auto',target:'auto'};
 assert.deepEqual(resolveCampaignOrders('派四百人接应沙摩柯；派三百人给旧营断后',auto,{}).map(x=>x.men),[400,300]);
 assert.equal(resolveCampaignOrders('第12队撤回接应营',auto,{'12':{men:463}})[0].unit,'12');
 assert.equal(resolveCampaignOrders('接应',{unit:'12',target:'fu'},{'12':{men:463}})[0].target,'fu');
 for(const text of ['不要派400人接应沙摩柯','如果敌军来了派400人接应沙摩柯','派150人接应沙摩柯','派400人接应沙摩柯和傅肜','第12队补充100人','派400人接应沙摩柯并断后'])assert.throws(()=>resolveCampaignOrders(text,auto,{'12':{men:463}}));
 assert.throws(()=>resolveCampaignOrders('派400人接应沙摩柯',{unit:'auto',target:'fu'},{}),/不一致/);
});
test('请求幂等、版本冲突、服务重建恢复和跨前线共用倒计时',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wzy-campaign-'));try{
 const runtime=createCampaignRuntime({directory,cooldownMs:10000});let s=await runtime.session();const input={scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),orders:[o(400)]};s=await runtime.act('orders',input);const replay=await runtime.act('orders',input);assert.equal(replay.reserve,1600);assert.equal(replay.revision,s.revision);
 await assert.rejects(runtime.act('orders',{...input,requestId:randomUUID()}),/更新/);
 await assert.rejects(runtime.act('chat',{scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),front:'camp',text:'伤兵怎样接？'}),/间隔/);
 const reload=await createCampaignRuntime({directory}).session(s.scenarioId);assert.deepEqual(reload,s);
 const r={scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),trigger:'endRound'};s=await runtime.act('round',r);assert.equal(s.round,1);assert.equal((await runtime.act('round',r)).round,1);
 const raw=JSON.parse(await readFile(join(directory,s.scenarioId+'.json'),'utf8'));assertLedger(raw);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('模型失败不耗间隔；无法用玩家口头声明创造傅肜反证',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wzy-campaign-'));try{const runtime=createCampaignRuntime({directory,model:()=>{throw Error('模拟断网');}});const s=await runtime.session();await assert.rejects(runtime.act('chat',{scenarioId:s.scenarioId,expectedRevision:0,requestId:randomUUID(),front:'fu',text:'陛下活着'}),/断网/);const after=await runtime.session(s.scenarioId);assert.equal(after.revision,0);assert.equal(after.nextSendAt,0);assert.equal(after.facts.liubeiAliveVerified,false);}finally{await rm(directory,{recursive:true,force:true});}
});
test('同一存档并发派兵不能透支兵池',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wzy-campaign-'));try{const r=createCampaignRuntime({directory,cooldownMs:0}),s=await r.session();const results=await Promise.allSettled([1,2].map(()=>r.act('orders',{scenarioId:s.scenarioId,expectedRevision:0,requestId:randomUUID(),orders:[o(1200)]})));assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await r.session(s.scenarioId)).reserve,800);}finally{await rm(directory,{recursive:true,force:true});}
});

test('新版开局甲队500加预备兵2000，派甲不重复扣兵，回营保留残兵',()=>{
 const s=currentFresh({seed:9891});assert.equal(s.total,2500);assert.equal(s.reserve,2000);assert.equal(s.units['1'].name,'甲队');assert.equal(s.units['1'].men,500);assert.equal(s.units['1'].state,'ready');assert.deepEqual(Object.values(s.fronts).map(f=>f.urgency),[84,88,96]);
 orders(s,[o(undefined,'sha','rescue','1')]);assert.equal(s.reserve,2000);assert.equal(s.units['1'].state,'queued');orders(s,[o(undefined,null,'retreat','1')]);assert.equal(s.units['1'].state,'ready');assert.equal(s.reserve,2000);
 orders(s,[o(undefined,'sha','rescue','1')]);settle(s);settle(s);const men=s.units['1'].men;assert.ok(men<500);orders(s,[o(undefined,null,'retreat','1')]);settle(s);settle(s);assert.equal(s.units['1'].men,men);assert.equal(s.units['1'].state,'ready');assert.equal(s.reserve,2000);assertLedger(s);
});
test('甲队占一个编制，其他队伍在确认出征后新建；不超5队',()=>{
 const s=currentFresh();assert.equal(Object.keys(s.units).length,1);orders(s,Array.from({length:4},()=>o(100)));assert.equal(Object.keys(s.units).length,5);assert.throws(()=>orders(s,[o(100)]),/最多/);assert.equal(s.reserve,1600);assertLedger(s);
 const a=resolveCampaignOrders('甲队接应沙摩柯',{unit:'auto',target:'auto'},s.units)[0];assert.equal(a.unit,'1');assert.equal(a.men,500);assert.equal(a.unitName,'甲队');
});
test('营中甲队待命不会阻止完成，也不会原地休整造成损伤',()=>{
 const s=currentFresh();orders(s,[o(undefined,null,'rest','1')]);assert.equal(s.units['1'].state,'ready');s.core.status='safe';for(const f of Object.values(s.fronts))f.status='safe';settle(s);assert.equal(s.ended,true);assert.equal(s.units['1'].men,500);assertLedger(s);
});
test('读取旧2000兵存档只更新展示，不凭空追加甲队或改写原文件',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wzy-old-pool-'));try{const old=fresh();orders(old,[o(400)]);const path=join(directory,old.scenarioId+'.json'),original=JSON.stringify(old);await writeFile(path,original);const s=await createCampaignRuntime({directory}).session(old.scenarioId);assert.equal(s.reserve,1600);assert.equal(s.total,2000);assert.equal(s.units['1'].men,400);assert.equal(s.units['1'].name,undefined);assert.deepEqual(Object.values(s.fronts).map(f=>f.urgency),[84,88,96]);assert.equal(await readFile(path,'utf8'),original);}finally{await rm(directory,{recursive:true,force:true});}
});
