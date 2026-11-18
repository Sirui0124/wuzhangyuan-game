import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fresh as engineFresh,orders,settle,assertLedger,derive} from '../campaign-engine.mjs';
import {createCampaignRuntime} from '../campaign-runtime.mjs';
import {authority,validateReply} from '../fu-ai.mjs';
import {resolveCampaignOrders} from '../.build/campaign-intent.js';
// The previous schema remains playable without inventing 500 extra soldiers.
const currentFresh=options=>engineFresh({...options,rules:'three'});
function fresh(options){const s=currentFresh(options);delete s.routeVersion;s.fronts.sha.work=3;s.fronts.camp.work=3.6;s.total=2000;s.balanceVersion='shared-2000-v1';s.units={};s.nextUnit=1;return s;}
const routeModel=async({system,input})=>system.includes('只判断意图')?{outcome:'DIALOGUE_ONLY',checks:{waitForVerifiedSearch:false,rearEscort:false,keepCover:false},quotes:[]}:{replies:[{speaker:input.authority.front==='sha'?'沙摩柯':'张南',text:'还在这里，正等接应。'}],claims:{status:input.authority.status,searchVerified:input.authority.searchVerified,planAccepted:input.authority.planAccepted,stages:input.authority.stages.map(({id,status})=>({id,status})),...(input.authority.crisis?{crisis:structuredClone(input.authority.crisis)}:{})},factRefs:['status']};
const o=(men,target='sha',action='rescue',unit='new')=>({unit,men,target,action,rush:false,via:'normal'});
test('傅肜回话可引用实际死讯来源，不能引用不存在的证据',()=>{
 const known=authority(fresh()),r={reply:'是吴军喊的消息。',claims:{liubei:'unverified',comrades:'dead',furong:'holding'},factRefs:['deathClaimSource']};assert.equal(validateReply(r,known),r.reply);assert.throws(()=>validateReply({...r,factRefs:['inventedEvidence']},known));
});
test('共享战场中的真实AI接口接收核实事实，受控完整说服不推进轮次',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wzy-campaign-'));try{
 const model=async({input})=>input.classification?{reply:'我回去继续护陛下，也把弟兄们的事告诉他。',claims:{liubei:input.authority.liubei,comrades:'dead',furong:input.authority.furong,...(input.authority.crisis?{crisis:structuredClone(input.authority.crisis)}:{})},factRefs:['liubeiAliveVerified']}:{outcomeId:'ACCEPT_CONTINUED_SERVICE',checks:{requestsWithdrawal:true,acknowledgesLoss:true,continuedDuty:true},quotes:[{messageId:'current',text:input.current.text}]};
 const r=createCampaignRuntime({routeModel,reportModel:false,directory,cooldownMs:0,model});let s=await r.session();const act=async(kind,x)=>s=await r.act(kind,{scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),...x});
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
 const survivors=s.units['1'].men;assert.equal(s.units['1'].state,'active');assert.equal(s.reserve,1500);orders(s,[o(undefined,null,'retreat','1')]);settle(s);assert.equal(s.units['1'].state,'returning');settle(s);assert.equal(s.reserve,1500+survivors);assertLedger(s);
});
test('侦察与核实有实际行程，原部众不会计入兵池',()=>{
 const s=fresh();orders(s,[o(100,'fu','verify'),{...o(100,'fu','scout'),via:'side'}]);assert.equal(s.facts.liubeiAliveVerified,false);settle(s);assert.equal(s.facts.liubeiAliveVerified,true);assert.equal(s.facts.liubeiSafeConfirmed,false);assert.equal(s.facts.alternateRouteOpen,true);settle(s);assert.equal(s.facts.liubeiSafeConfirmed,true);assert.equal(s.reserve,2000);assertLedger(s);
});
test('重复任务不叠知识，军事收益随兵力有上限；一队只占一个岗',()=>{
 const a=fresh({seed:9891}),b=fresh({seed:9891});orders(a,[o(100,'fu','relieve')]);orders(b,[o(400,'fu','relieve')]);settle(a);settle(b);settle(a);settle(b);assert.ok(b.core.journal.at(-1).crisis<a.core.journal.at(-1).crisis);
 assert.equal(b.units['1'].state,'active');derive(b);assert.equal(b.facts.reliefInPosition,true);assert.equal(b.facts.escortReady,false);assertLedger(b);
});
test('自然语言新编、现有残兵、手选补足和冲突拒绝',()=>{
 const auto={unit:'auto',target:'auto'};
 assert.deepEqual(resolveCampaignOrders('派四百人接应沙摩柯；派三百人给旧营断后',auto,{}).map(x=>x.men),[400,300]);
 assert.equal(resolveCampaignOrders('第12队撤回接应营',auto,{'12':{men:463}})[0].unit,'12');
 assert.throws(()=>resolveCampaignOrders('；；。',auto,{}),/请写明人数和任务/);
 assert.equal(resolveCampaignOrders('接应',{unit:'12',target:'fu'},{'12':{men:463}})[0].target,'fu');
 for(const text of ['不要派400人接应沙摩柯','如果敌军来了派400人接应沙摩柯','派150人接应沙摩柯','派400人接应沙摩柯和傅肜','第12队补充100人','派400人接应沙摩柯并断后'])assert.throws(()=>resolveCampaignOrders(text,auto,{'12':{men:463}}));
 assert.throws(()=>resolveCampaignOrders('派400人接应沙摩柯',{unit:'auto',target:'fu'},{}),/不一致/);
});
test('请求幂等、版本冲突、服务重建恢复和无发送冷却',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wzy-campaign-'));try{
 const runtime=createCampaignRuntime({routeModel,reportModel:false,directory,cooldownMs:10000});let s=await runtime.session();const input={scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),orders:[o(400)]};s=await runtime.act('orders',input);const replay=await runtime.act('orders',input);assert.equal(replay.reserve,1600);assert.equal(replay.revision,s.revision);
 await assert.rejects(runtime.act('orders',{...input,requestId:randomUUID()}),/更新/);
 s=await runtime.act('chat',{scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),front:'camp',text:'伤兵怎样接？'});assert.equal(s.nextSendAt,0);
 const reload=await createCampaignRuntime({routeModel,reportModel:false,directory}).session(s.scenarioId);assert.deepEqual(reload,s);
 const r={scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),trigger:'endRound'};s=await runtime.act('round',r);assert.equal(s.round,1);assert.equal((await runtime.act('round',r)).round,1);
 const raw=JSON.parse(await readFile(join(directory,s.scenarioId+'.json'),'utf8'));assertLedger(raw);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('模型失败不耗间隔；无法用玩家口头声明创造傅肜反证',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wzy-campaign-'));try{const runtime=createCampaignRuntime({routeModel,reportModel:false,directory,model:()=>{throw Error('模拟断网');}});const s=await runtime.session();await assert.rejects(runtime.act('chat',{scenarioId:s.scenarioId,expectedRevision:0,requestId:randomUUID(),front:'fu',text:'陛下活着'}),/断网/);const after=await runtime.session(s.scenarioId);assert.equal(after.revision,0);assert.equal(after.nextSendAt,0);assert.equal(after.facts.liubeiAliveVerified,false);}finally{await rm(directory,{recursive:true,force:true});}
});
test('同一存档并发派兵不能透支兵池',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wzy-campaign-'));try{const r=createCampaignRuntime({routeModel,reportModel:false,directory,cooldownMs:0}),s=await r.session();const results=await Promise.allSettled([1,2].map(()=>r.act('orders',{scenarioId:s.scenarioId,expectedRevision:0,requestId:randomUUID(),orders:[o(1200)]})));assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await r.session(s.scenarioId)).reserve,800);}finally{await rm(directory,{recursive:true,force:true});}
});

test('新版开局甲队500加预备兵2000，派甲不重复扣兵，回营保留残兵',()=>{
 const s=currentFresh({seed:9891});assert.equal(s.total,2500);assert.equal(s.reserve,2000);assert.equal(s.units['1'].name,'甲队');assert.equal(s.units['1'].men,500);assert.equal(s.units['1'].state,'ready');assert.deepEqual(Object.values(s.fronts).map(f=>f.urgency),[84,88,96]);
 orders(s,[o(undefined,'sha','rescue','1')]);assert.equal(s.reserve,2000);assert.equal(s.units['1'].state,'queued');orders(s,[o(undefined,null,'retreat','1')]);assert.equal(s.units['1'].state,'ready');assert.equal(s.reserve,2000);
 orders(s,[o(undefined,'sha','rescue','1')]);settle(s);settle(s);const men=s.units['1'].men;assert.ok(men<500);assert.equal(s.units['1'].state,'active');orders(s,[o(undefined,null,'retreat','1')]);settle(s);assert.equal(s.units['1'].state,'returning');settle(s);assert.equal(s.units['1'].men,men);assert.equal(s.units['1'].state,'ready');assert.equal(s.reserve,2000);assertLedger(s);
});
test('甲队占一个编制，其他队伍在确认出征后新建；不超5队',()=>{
 const s=currentFresh();assert.equal(Object.keys(s.units).length,1);orders(s,Array.from({length:4},()=>o(100)));assert.equal(Object.keys(s.units).length,5);assert.throws(()=>orders(s,[o(100)]),/最多/);assert.equal(s.reserve,1600);assertLedger(s);
 const a=resolveCampaignOrders('甲队接应沙摩柯',{unit:'auto',target:'auto'},s.units)[0];assert.equal(a.unit,'1');assert.equal(a.men,500);assert.equal(a.unitName,'甲队');
});
test('营中甲队待命不会阻止完成，也不会原地休整造成损伤',()=>{
 const s=currentFresh();orders(s,[o(undefined,null,'rest','1')]);assert.equal(s.units['1'].state,'ready');s.core.status='safe';for(const f of Object.values(s.fronts))f.status='safe';settle(s);assert.equal(s.ended,true);assert.equal(s.units['1'].men,500);assertLedger(s);
});
test('读取旧2000兵存档只更新展示，不凭空追加甲队或改写原文件',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wzy-old-pool-'));try{const old=fresh();orders(old,[o(400)]);const path=join(directory,old.scenarioId+'.json'),original=JSON.stringify(old);await writeFile(path,original);const s=await createCampaignRuntime({routeModel,reportModel:false,directory}).session(old.scenarioId);assert.equal(s.reserve,1600);assert.equal(s.total,2000);assert.equal(s.units['1'].men,400);assert.equal(s.units['1'].name,undefined);assert.deepEqual(Object.values(s.fronts).map(f=>f.urgency),[84,88,96]);assert.equal(await readFile(path,'utf8'),original);}finally{await rm(directory,{recursive:true,force:true});}
});

test('六轮截止不会伪造归营，第六轮返程兵力保留在外；军报记录实际差值',()=>{
 const s=currentFresh({seed:753});for(let i=0;i<4;i++)settle(s);
 s.fronts.sha.searchVerified=true;s.fronts.sha.stages[0].progress=.6;s.fronts.sha.stages[0].status='home';s.fronts.sha.stages[1].progress=1.1;s.fronts.sha.progress=s.fronts.sha.work-.1;orders(s,[o(1000)]);settle(s);settle(s);
 assert.equal(s.round,6);assert.equal(s.ended,true);assert.equal(s.endReason,'deadline');assert.equal(s.units['2'].state,'returning');assert.equal(s.reserve,1000);assert.ok(s.units['2'].men<1000);
 assert.equal(s.lastReport.round,6);assert.equal(s.lastReport.units.find(u=>u.id==='2').after,s.units['2'].men);assert.match(s.lastReport.events.join(' '),/两个时辰后归营/);assert.throws(()=>settle(s),/结束/);assertLedger(s);
});
test('八次问答按每组每轮计数、幂等不重复、重建不重置、下轮恢复',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wzy-turns-'));try{
 let r=createCampaignRuntime({routeModel,reportModel:false,directory}),s=await r.session();
 const act=async(kind,x)=>s=await r.act(kind,{scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),...x});
 for(let i=0;i<8;i++)await act('chat',{front:'sha',text:'敌情怎样？'});
 await assert.rejects(act('chat',{front:'sha',text:'再问一次'}),/八次/);
 await act('chat',{front:'camp',text:'敌情怎样？'});await act('orders',{orders:[o(100)]});
 r=createCampaignRuntime({routeModel,reportModel:false,directory});await assert.rejects(act('chat',{front:'sha',text:'刷新后再问'}),/八次/);
 await act('round',{trigger:'endRound'});await act('chat',{front:'sha',text:'下轮问话'});assert.equal(s.round,1);
 }finally{await rm(directory,{recursive:true,force:true});}
});


test('新编队人数不误识别成队号，保留真正的队伍冲突校验',()=>{
 const units={'1':{men:500,name:'甲队'},'2':{men:100}};
 for(const unit of ['new','auto'])for(const text of ['新增队伍100人，接应沙摩柯、','新增队伍一百人，接应沙摩柯','新编队100人接应沙摩柯','队伍100人接应沙摩柯','新增队伍 100 人，接应沙摩柯']){
  const [order]=resolveCampaignOrders(text,{unit,target:'sha'},units);
  assert.deepEqual([order.unit,order.men,order.action,order.target],['new',100,'rescue','sha']);
 }
 for(const name of ['队伍2','第二队','2队'])assert.equal(resolveCampaignOrders(name+'出动100人接应沙摩柯',{unit:'auto',target:'sha'},units)[0].unit,'2');
 assert.throws(()=>resolveCampaignOrders('队伍2接应沙摩柯',{unit:'new',target:'sha'},units),/不一致/);
 assert.throws(()=>resolveCampaignOrders('新增队伍100人接应沙摩柯',{unit:'2',target:'sha'},units),/不一致/);
});

test('危机未解除持续在前线作战，解围后再隔完整一轮归营',()=>{
 const s=currentFresh({seed:753});delete s.routeVersion;s.fronts.sha.work=3;orders(s,[o(1000),o(300,'sha','relieve')]);settle(s);settle(s);
 assert.equal(s.units['2'].state,'active');const men=s.units['2'].men;assert.equal(s.reserve,700);
 settle(s);assert.equal(s.units['2'].state,'active');assert.ok(s.units['2'].men<men);assert.equal(s.fronts.sha.status,'holding');
 settle(s);assert.equal(s.fronts.sha.status,'safe');assert.equal(s.units['2'].state,'returning');assert.equal(s.reserve,700);const returning=Object.values(s.units).filter(u=>u.state==='returning').reduce((n,u)=>n+u.men,0);
 settle(s);assert.equal(s.fronts.sha.status,'home');assert.equal(s.reserve,700+returning);assert.equal(s.units['2'],undefined);assertLedger(s);
});
