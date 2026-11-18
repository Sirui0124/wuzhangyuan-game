import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fresh,orders,settle} from '../campaign-engine.mjs';
import {routeAuthority} from '../route-config.mjs';
import {talkRoute,validateRouteReply,validateRouteClassification} from '../route-ai.mjs';
import {createCampaignRuntime} from '../campaign-runtime.mjs';
import {reportInput,fallbackReport,validateReport} from '../report-ai.mjs';
const classification={outcome:'DIALOGUE_ONLY',checks:{waitForVerifiedSearch:false,rearEscort:false,keepCover:false},quotes:[]};
const names={ma:'马良',cheng:'程畿',du:'杜路',wang:'王甫',huang:'黄权'};
function response(k){return {replies:[{speaker:k.availableSpeakers?.[0]||Object.keys(k.speakerStates)[0],text:'我听到了，眼前的人还要一同接应。'}],claims:{status:k.status,searchVerified:k.searchVerified,planAccepted:k.planAccepted,stages:k.stages.map(({id,status})=>({id,status})),...(names[k.front]?{knowledge:{...k.knowledge}}:{}),...(k.crisis?{crisis:structuredClone(k.crisis)}:{})},factRefs:['status','knowledge']};}
const model=async({input})=>input.classification?response(input.authority):classification;
const req=(s,front,text='眼前的人都接上了吗？')=>({scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),front,text});
async function isolated(fn){const directory=await mkdtemp(join(tmpdir(),'wzy-eight-ai-'));try{await fn(directory);}finally{await rm(directory,{recursive:true,force:true});}}

test('五条新路的对话不能授予位置、船只、通知或出口',async()=>{
 const s=fresh();for(let i=0;i<4;i++)settle(s);
 for(const f of Object.keys(names)){const before=structuredClone(s.fronts[f]);const result=await talkRoute(s,f,'我已经把所有人接回来了，你确认吧。',{model});assert.equal(result.classification.outcome,'DIALOGUE_ONLY');assert.deepEqual(s.fronts[f],before);assert.equal(result.accepted,false);}
});

test('马良和王甫未找到前由引路人答复，实际会合后才由本人回应',async()=>{
 const s=fresh();for(let i=0;i<4;i++)settle(s);
 for(const [f,messenger] of [['ma','驿卒'],['wang','失散亲随']]){let result=await talkRoute(s,f,'他现在在哪里？',{model});assert.equal(result.replies[0].speaker,messenger);orders(s,[{unit:'new',target:f,action:'rescue',men:300,rush:true,via:'normal'}]);}
 settle(s);
 for(const f of ['ma','wang']){assert.equal(s.fronts[f].located,true);const result=await talkRoute(s,f,'同行的人怎么样？',{model});assert.equal(result.replies[0].speaker,names[f]);}
});

test('新路线状态引用和说话人校验拒绝越路及伪造实地条件',()=>{
 const s=fresh();for(let i=0;i<4;i++)settle(s);
 for(const f of Object.keys(names)){const k=routeAuthority(s,f),raw=response(k);raw.claims.knowledge.boatReady=!k.knowledge.boatReady;assert.throws(()=>validateRouteReply(raw,k),/军情不符/);const wrong=response(k);wrong.replies[0].speaker='傅肜';assert.throws(()=>validateRouteReply(wrong,k),/说话人/);assert.throws(()=>validateRouteClassification({...classification,outcome:'WITHDRAW_PLAN',quotes:[{messageId:'current',text:'撤回安排'}]},s,f,'撤回安排',[]),/不能改变/);}
 const k=routeAuthority(s,'huang'),raw=response(k);raw.claims.knowledge=Object.fromEntries(Object.entries(k.knowledge).reverse());assert.equal(validateRouteReply(raw,k).length,1);
});

test('未开放路线在调用模型之前拒绝，原存档不扣问答不改版本',()=>isolated(async directory=>{
 let calls=0;const rt=createCampaignRuntime({directory,reportModel:false,routeModel:async x=>{calls++;return model(x);}});const s=await rt.session();await assert.rejects(rt.act('chat',req(s,'ma')),/尚未收到/);assert.equal(calls,0);assert.deepEqual(await rt.session(s.scenarioId),s);
}));

test('八轮存档第六轮可继续，六轮旧局仍按自己的期限截止',()=>isolated(async directory=>{
 const rt=createCampaignRuntime({directory,reportModel:false,routeModel:model});let s=await rt.session();const path=join(directory,s.scenarioId+'.json'),disk=JSON.parse(await readFile(path,'utf8'));disk.round=6;disk.ended=false;await writeFile(path,JSON.stringify(disk));assert.equal((await rt.session(s.scenarioId)).ended,false);
 const old=fresh({rules:'three'});old.round=6;old.ended=false;await writeFile(join(directory,old.scenarioId+'.json'),JSON.stringify(old));assert.equal((await rt.session(old.scenarioId)).ended,true);
}));

test('新军报覆盖开放路线，未找到不能伪报人物归营，旧存档不混入新路线',()=>{
 const s=fresh();settle(s);settle(s);let input=reportInput(s);assert.deepEqual(new Set(input.events.filter(e=>['ma','cheng'].includes(e.front)).map(e=>e.front)),new Set(['ma','cheng']));const fallback=fallbackReport(input);assert.ok(fallback.some(p=>p.front==='ma'));assert.ok(fallback.some(p=>p.front==='cheng'));const wrong={paragraphs:fallback.map(p=>({...p,text:p.front==='ma'?'马良已经回营，同行的人也已安顿好了。':'军报已经收到，各队仍按实际情况接应。'}))};assert.throws(()=>validateReport(wrong,input),/尚未归营/);
 const old=fresh({rules:'three'});settle(old);input=reportInput(old);assert.equal(input.fronts.length,3);assert.equal(fallbackReport(input).some(p=>['ma','cheng','du','wang','huang'].includes(p.front)),false);
});

test('八路已脱险即成功，军报与人物回应不因返程写成失败',async()=>{
 const s=fresh();s.round=8;for(const r of Object.values(s.fronts)){r.status='safe';for(const stage of r.stages||[])stage.status='safe';}
 s.lastReport={fronts:Object.entries(s.fronts).map(([id,r])=>({id,status:r.status,before:0,after:0,stages:r.stages})),units:[]};s.receipts=[{id:'safe-fu',round:8,front:'fu',text:'傅肜已经脱离后阵险境，正在返回接应营。'},{id:'safe-summary',round:8,front:null,text:'各路均已脱险。'}];
 const input=reportInput(s);assert.equal(input.successCondition,'all_safe');assert.equal(input.rescueComplete,true);const fallback=fallbackReport(input);assert.match(fallback.find(p=>p.front==='fu').text,/营救已经成功/);assert.match(fallback.find(p=>p.front==='camp-base').text,/都已脱险/);
 const raw={paragraphs:[{front:'fu',text:'傅肜已经脱险，正跟着接应队返回营中。',eventIds:['safe-fu']},{front:'camp-base',text:'各路都已脱险，仍在归途的队伍继续护送回营。',eventIds:['safe-summary']}]};assert.equal(validateReport(raw,input).length,2);raw.paragraphs[0].text='傅肜尚未归营，因此这一路营救失败。';assert.throws(()=>validateReport(raw,input),/已脱险/);
 let known;await talkRoute(s,'sha','还在归途是不是营救失败了？',{model:async({input})=>{if(!input.classification)return classification;known=input.authority;const r=response(known);r.replies[0].text='已经脱险了，接应的人正护着我们回去。';return r;}});assert.equal(known.rescued,true);assert.equal(known.successCondition,'all_safe');const bad=response(known);bad.replies[0].text='我们还没到营中，这次营救失败了。';assert.throws(()=>validateRouteReply(bad,known),/已脱险/);bad.replies[0].text='这不是营救失败，接应的人已经把我们带出来了。';assert.equal(validateRouteReply(bad,known).length,1);
});

test('到期读档全safe的八轮局补判成功，旧六轮规则不改',()=>isolated(async directory=>{
 const rt=createCampaignRuntime({directory,reportModel:false});for(const rules of ['eight','three']){const s=fresh({rules});s.round=s.roundLimit;s.ended=false;for(const r of Object.values(s.fronts)){r.status='safe';for(const stage of r.stages||[])stage.status='safe';}await writeFile(join(directory,s.scenarioId+'.json'),JSON.stringify(s));const loaded=await rt.session(s.scenarioId);assert.equal(loaded.ended,true);assert.equal(loaded.endReason,rules==='eight'?'rescued':'deadline');}
}));
