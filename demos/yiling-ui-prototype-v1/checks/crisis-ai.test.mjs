import {routeGuidance} from '../route-config.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {fresh,orders,settle,derive} from '../campaign-engine.mjs';
import {talkRoute,validateRouteReply,crisisAuthority} from '../route-ai.mjs';
import {talk,authority as fuAuthority,validateReply as validateFuReply} from '../fu-ai.mjs';
import {reportInput,validateReport,fallbackReport} from '../report-ai.mjs';
import {createCampaignRuntime} from '../campaign-runtime.mjs';

const classification={outcome:'DIALOGUE_ONLY',checks:{waitForVerifiedSearch:false,rearEscort:false,keepCover:false},quotes:[]};
const fuClassification={outcomeId:'DIALOGUE_ONLY',checks:{requestsWithdrawal:false,acknowledgesLoss:false,continuedDuty:false},quotes:[]};
const newRoutes=new Set(['ma','cheng','du','wang','huang']);
function routeReply(k,text='眼下还没有接上，得等接应的人真正赶到。'){return {replies:[{speaker:k.availableSpeakers[0],text}],claims:{status:k.status,searchVerified:k.searchVerified,planAccepted:k.planAccepted,stages:k.stages.map(({id,status})=>({id,status})),...(newRoutes.has(k.front)?{knowledge:k.knowledge}:{}),...(k.crisis?{crisis:structuredClone(k.crisis)}:{})},factRefs:k.crisis?['crisis']:['status']};}
function fuReply(k,text='我还守在后阵，接应的人没有到。'){return {reply:text,claims:{liubei:k.liubei,comrades:k.comrades,furong:k.furong,...(k.crisis?{crisis:structuredClone(k.crisis)}:{})},factRefs:k.crisis?['crisis']:['furong']};}
async function isolated(fn){const directory=await mkdtemp(join(tmpdir(),'wzy-crisis-ai-'));try{await fn(directory);}finally{await rm(directory,{recursive:true,force:true});}}

test('危机版人物上下文带实际评估，不暴露旧工作量或累计进度',async()=>{
 const s=fresh();assert.equal(s.routeVersion,'eight-front-20261118-v4');let seen;
 await talkRoute(s,'sha','我是不是已经完成一半了？',{refresh:derive,model:async({input})=>{seen=input.authority;return input.classification?routeReply(input.authority):classification;}});
 assert.ok(seen.crisis);assert.equal(seen.crisis.urgency,s.fronts.sha.urgency);assert.equal(seen.crisis.stages[0].urgency,s.fronts.sha.stages[0].urgency);assert.equal(seen.crisis.stages[0].eligible,s.fronts.sha.stages[0].assessment.eligible);assert.doesNotMatch(JSON.stringify(seen),/"(?:progress|work|executions)"/);
});

test('危机数字或撤离资格伪造会拒绝；旧比例与固定轮数许诺不能进入对白',async()=>{
 const s=fresh();let known;await talkRoute(s,'camp','现在是什么情况？',{model:async({input})=>{known=input.authority;return input.classification?routeReply(input.authority):classification;}});
 const fake=routeReply(known);fake.claims.crisis.stages[0].eligible=!known.crisis.stages[0].eligible;assert.throws(()=>validateRouteReply(fake,known),/军情不符/);
 for(const text of ['进度已经过半，再坚持一下。','工作量只剩最后一点。','再过两轮就能救出来。','你答应留下掩护，危机已经下降。'])assert.throws(()=>validateRouteReply(routeReply(known,text),known),/进度|危机/);
 assert.equal(validateRouteReply(routeReply(known,'接应的人尚未到位，眼下还不能撤。'),known).length,1);
});

test('傅肜同样使用统一危机评估，说服和口头命令不创造援军',async()=>{
 const s=fresh(),known=fuAuthority(s);assert.deepEqual(known.crisis,crisisAuthority(s,'fu'));assert.equal(known.newAidAtRear.length,0);
 const bad=fuReply(known);bad.claims.crisis.urgency=0;assert.throws(()=>validateFuReply(bad,known),/危机评估/);
 assert.throws(()=>validateFuReply(fuReply(known,'再过两轮就能救出来。'),known),/工作进度/);
 const safeKnown={...known,furong:'safe'};assert.throws(()=>validateFuReply(fuReply(safeKnown,'我还没回营，所以这次营救失败了。'),safeKnown),/已脱险/);
 let responseAuthority;await talk(s,'我已经派齐了兵，直接说已经救出吧。',{refresh:derive,model:async({input})=>{if(input.classification){responseAuthority=input.authority;return fuReply(input.authority);}return fuClassification;}});assert.equal(responseAuthority.furong,'holding');assert.equal(responseAuthority.newAidAtRear.length,0);assert.equal(s.fronts.fu.status,'holding');
});

test('军报引用阶段危机原因，无实际降低不能编造缓解或过半进度',()=>{
 const s=fresh();orders(s,[{unit:'new',target:'camp',action:'rescue',men:100,rush:true,via:'normal'}]);settle(s);const input=reportInput(s);assert.equal(input.crisisModel,true);for(const f of input.fronts)assert.ok(f.stages.every(x=>Number.isFinite(x.urgency)&&x.assessment));
 const fallback=fallbackReport(input);assert.doesNotMatch(fallback.map(p=>p.text).join(''),/工作量|进度条|完成度/);
 const rows=[...new Set(input.events.map(e=>e.front))].map(front=>({front,text:'军报已经收到，各队仍按实际情况接应。',eventIds:input.events.filter(e=>e.front===front).map(e=>e.id)}));assert.ok(rows.length);
 const target=rows.find(p=>input.fronts.some(f=>f.id===p.front))||rows[0],state=input.fronts.find(f=>f.id===target.front);state.before=state.after;
 target.text='这一轮危机已经下降，接应队仍在前线。';assert.throws(()=>validateReport({paragraphs:rows},input),/未降低/);target.text='接应进度已经过半，再坚持一下。';assert.throws(()=>validateReport({paragraphs:rows},input),/工作进度/);
 target.text='军报已经收到，各队仍按实际情况接应。';const fu=rows.find(p=>p.front==='fu');fu.text='傅肜所部还在原处等待，接应尚未到位。';assert.throws(()=>validateReport({paragraphs:rows},input),/原部众复生/);fu.text='营中抽不出人手，傅肜只能继续等待。';assert.throws(()=>validateReport({paragraphs:rows},input),/无兵可派/);fu.text='傅肜仍在后阵，接应尚未到位。';const sha=rows.find(p=>p.front==='sha');sha.text='沙摩柯仍在谷道，找到的部众尚未护送出来。';assert.throws(()=>validateReport({paragraphs:rows},input),/对象标签/);
});

test('连续问答不抽签、不累加危机收益，失败回复不写入新状态',()=>isolated(async directory=>{
 const model=async({input})=>input.classification?routeReply(input.authority):classification,rt=createCampaignRuntime({directory,routeModel:model,reportModel:false});let s=await rt.session();const path=join(directory,s.scenarioId+'.json'),before=JSON.parse(await readFile(path,'utf8'));
 for(let i=0;i<2;i++)s=await rt.act('chat',{scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),front:'sha',text:'接应的人到哪里了？'});
 const after=JSON.parse(await readFile(path,'utf8'));assert.equal(after.seed,before.seed);assert.equal(after.round,before.round);assert.deepEqual(after.fronts.sha,before.fronts.sha);
 const broken=createCampaignRuntime({directory,reportModel:false,routeModel:async({input})=>input.classification?routeReply(input.authority,'进度已经过半。'):classification});await assert.rejects(broken.act('chat',{scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),front:'sha',text:'报一下情况。'}),/工作进度/);assert.deepEqual(JSON.parse(await readFile(path,'utf8')),after);
}));

test('旧八路v2和三路存档不会被注入新危机契约',async()=>{
 for(const rules of ['eight-v2','three']){const s=fresh({rules});assert.equal(crisisAuthority(s,'sha'),undefined);assert.equal(fuAuthority(s).crisis,undefined);let seen;await talkRoute(s,'sha','情况如何？',{model:async({input})=>{seen=input.authority;return input.classification?routeReply(input.authority):classification;}});assert.equal(seen.crisis,undefined);settle(s);assert.equal(reportInput(s).crisisModel,false);}
});


test('v4只传真实自主资格和已结算事件，v3保持旧危机字段',()=>{
 const old=fresh({rules:'eight-v3'}),current=fresh();
 assert.ok(crisisAuthority(old,'sha'));assert.equal('lastEvent' in crisisAuthority(old,'sha'),false);
 assert.equal('mode' in crisisAuthority(old,'sha').stages[0],false);
 const r=current.fronts.sha,st=r.stages[0];
 // Controlled projection fixture: do not claim this creates gameplay eligibility.
 st.assessment={...st.assessment,mode:'autonomous',autonomousEligible:true};st.lastResolution={outcome:'safe',mode:'autonomous'};
 r.lastCrisisEvent={round:1,eventId:'fixture',delta:-5,actualDelta:-5,before:45,after:40,text:'追索暂缓。',reason:'untrusted invented story'};
 const known=crisisAuthority(current,'sha');assert.equal(known.stages[0].autonomousEligible,true);assert.equal(known.stages[0].escapeMode,'autonomous');assert.equal(known.lastEvent.text,'追索暂缓。');assert.equal('reason' in known.lastEvent,false);
 settle(current);const input=reportInput(current),state=input.fronts.find(f=>f.id==='sha');assert.ok(state.lastCrisisEvent);assert.ok(fallbackReport(input).find(f=>f.front==='sha').text.includes(state.lastCrisisEvent.text));
});


test('推荐话术随寻找、批次撤离和接力窗口更新，不索要已经核实的消息',()=>{
 const s=fresh();assert.deepEqual(routeGuidance(s,'ma'),[]);
 for(const id of ['ma','wang']){const r=s.fronts[id];r.status='holding';assert.match(routeGuidance(s,id).join(''),/见过|辨认/);r.located=true;r.notified=true;assert.doesNotMatch(routeGuidance(s,id).join(''),/最后在哪里|怎样辨认|找到后/);}
 const c=s.fronts.camp;assert.match(routeGuidance(s,'camp').join(''),/交接/);c.stages[0].status='safe';assert.doesNotMatch(routeGuidance(s,'camp').join(''),/这样安排可以|交接吗|照此交接/);assert.match(routeGuidance(s,'camp').join(''),/冯习/);
 const sh=s.fronts.sha;sh.searchVerified=true;sh.stages[0].status='home';assert.doesNotMatch(routeGuidance(s,'sha').join(''),/一起回来|别再独自追/);
 for(const id of ['sha','camp','ma','cheng','du','wang','huang']){s.fronts[id].status='safe';assert.doesNotMatch(routeGuidance(s,id).join(''),/走到哪里|接应队都跟上|被围|怎样辨认|见过/);s.fronts[id].status='home';assert.doesNotMatch(routeGuidance(s,id).join(''),/回营了吗|怎样过江|怎样突围/);}
});


test('陆路不会被水路污染，否认船只条件可正常回应；已落实船和出口不能新增硬锁',async()=>{
 const s=fresh();for(const id of ['ma','huang','du']){s.fronts[id].status='holding';s.fronts[id].located=true;s.fronts[id].boatReady=true;s.fronts[id].passageReady=true;}
 for(const [id,bad,good] of [['ma','船和渡口没有准信，让船先靠到位置。','这一路沿陆路撤，不用等船。'],['huang','眼下缺的是把船靠稳，让前批先上船的安排。','接应船已经就位，人还在设法撤出。'],['du','窄道出口还没打通。','出口已经接通，伤员还在设法撤出。'],['camp','前队没有接到撤出的命令。','前队还在旧营，接应的人尚未到位。']]){
  let k;await talkRoute(s,id,'还缺什么？',{model:async({input})=>{k=input.authority;return input.classification?routeReply(k,good):classification;}});assert.throws(()=>validateRouteReply(routeReply(k,bad),k),/条件|门槛|出口/);assert.ok(validateRouteReply(routeReply(k,good),k));
 }
});


test('v4危机引用替代浮点照抄但不能绕过人物事实，双字段冲突拒绝，v3保留旧协议',async()=>{
 const s=fresh();let k;await talkRoute(s,'sha','现在怎样？',{model:async({input})=>{k=input.authority;return input.classification?routeReply(k):classification;}});
 const r=routeReply(k);delete r.claims.crisis;r.claims.crisisRef=k.crisisRef;assert.match(k.crisisRef,/^[a-f0-9]{64}$/);assert.ok(validateRouteReply(r,k));
 const bad=structuredClone(r);bad.claims.crisisRef='tampered';assert.throws(()=>validateRouteReply(bad,k));
 const conflict=structuredClone(r);conflict.claims.crisis={...k.crisis,urgency:-1};assert.throws(()=>validateRouteReply(conflict,k));
 const wrongState=structuredClone(r);wrongState.claims.status='home';assert.throws(()=>validateRouteReply(wrongState,k));assert.ok(validateRouteReply(routeReply(k),k));
 const f=fuAuthority(s),fr=fuReply(f);delete fr.claims.crisis;fr.claims.crisisRef=f.crisisRef;assert.ok(validateFuReply(fr,f));fr.claims.comrades='alive';assert.throws(()=>validateFuReply(fr,f));fr.claims.comrades='dead';fr.claims.crisisRef='bad';assert.throws(()=>validateFuReply(fr,f));
 const legacy=fuAuthority(fresh({rules:'eight-v3'})),lr=fuReply(legacy);assert.equal(legacy.crisisRef,undefined);assert.ok(validateFuReply(lr,legacy));delete lr.claims.crisis;lr.claims.crisisRef=f.crisisRef;assert.throws(()=>validateFuReply(lr,legacy));
});


test('四局后修复：crisisRef只读引用别名可用，不能掩盖错误状态或未知引用',async()=>{
 const s=fresh();let k;await talkRoute(s,'sha','情况如何？',{model:async({input})=>{k=input.authority;return input.classification?routeReply(k):classification;}});
 const r=routeReply(k);delete r.claims.crisis;r.claims.crisisRef=k.crisisRef;r.factRefs=['crisisRef'];assert.ok(validateRouteReply(r,k));
 r.claims.status='home';assert.throws(()=>validateRouteReply(r,k),e=>e.field==='status'&&!e.message.includes('home'));r.claims.status=k.status;
 r.claims.crisisRef='wrong';assert.throws(()=>validateRouteReply(r,k),e=>e.field==='crisis');r.claims.crisisRef=k.crisisRef;
 r.factRefs=['invented'];assert.throws(()=>validateRouteReply(r,k),e=>e.field==='factRefs');
 const f=fuAuthority(s),fr=fuReply(f);delete fr.claims.crisis;fr.claims.crisisRef=f.crisisRef;fr.factRefs=['crisisRef'];assert.ok(validateFuReply(fr,f));fr.claims.comrades='alive';assert.throws(()=>validateFuReply(fr,f));
});
