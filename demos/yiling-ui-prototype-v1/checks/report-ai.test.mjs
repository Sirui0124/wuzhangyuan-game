import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fresh as currentFresh,orders,settle} from '../campaign-engine.mjs';
import {createCampaignRuntime} from '../campaign-runtime.mjs';
import {narrateReport,reportInput,validateReport,REPORT_PROMPT} from '../report-ai.mjs';
const fresh=()=>{const s=currentFresh({seed:753,rules:'three'});delete s.routeVersion;s.fronts.sha.work=3;return s;};
const order={unit:'new',men:1000,target:'sha',action:'rescue',rush:false,via:'normal'};
test('行军、战后返程、归营的正文与派遣快照分别准确',async()=>{
 const s=fresh({seed:753});orders(s,[order]);settle(s);
 let n=await narrateReport(s,{model:false});assert.match(n.paragraphs[0].text,/仍在赶往.*尚未到位/);assert.doesNotMatch(n.paragraphs[0].text,/伤亡|已经回营/);
 settle(s);n=await narrateReport(s,{model:false});assert.match(n.paragraphs[0].text,/东沟|西沟/);assert.match(n.paragraphs[0].text,/尚未解围/);assert.doesNotMatch(n.paragraphs[0].text,/正往接应营返回/);
 const u=s.lastReport.units.find(u=>u.id==='2');assert.equal(u.target,'sha');assert.equal(u.task,'接应护送');assert.equal(u.before-u.after,u.wounded+u.dead);assert.equal(s.lastReport.pool.outside,u.after);
 s.fronts.sha.progress=s.fronts.sha.work;settle(s);assert.equal(s.units['2'].state,'returning');n=await narrateReport(s,{model:false});assert.match(n.paragraphs[0].text,/两个时辰后才能归营/);settle(s);n=await narrateReport(s,{model:false});assert.match(n.paragraphs[0].text,/已经回营/);assert.equal(s.lastReport.pool.outside,0);
});
test('Prompt约束实际遭遇，拒绝无来源引用、遗漏分路与数字复述',()=>{
 assert.match(REPORT_PROMPT,/不得添加新事件/);assert.match(REPORT_PROMPT,/不虚构伏击/);
 const s=fresh();orders(s,[order]);settle(s);const input=reportInput(s),p={front:'sha',text:'接应队正赶往沙摩柯所在处，目前尚未到位。',eventIds:[input.events[0].id]};
 assert.equal(validateReport({paragraphs:[p]},input)[0].text,p.text);
 assert.throws(()=>validateReport({paragraphs:[{...p,eventIds:['invented']}]},input));
 assert.throws(()=>validateReport({paragraphs:[]},input));
 assert.throws(()=>validateReport({paragraphs:[{...p,text:'派了1000人，剩余999人，危机度降低。'}]},input));
});
test('军报模型失败仍提交同一次结算，重试不重复调用模型或扣兵',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wzy-report-'));let calls=0;
 try{
 const runtime=createCampaignRuntime({directory,reportModel:async()=>{calls++;throw Error('模拟断网');}});let s=await runtime.session();
 s=await runtime.act('orders',{scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),orders:[order]});
 const request={scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:randomUUID(),trigger:'endRound'};
 s=await runtime.act('round',request);assert.equal(s.lastReport.narrative.source,'facts');assert.equal(s.round,1);assert.equal(calls,1);
 const replay=await runtime.act('round',request);assert.deepEqual(replay,s);assert.equal(calls,1);
 assert.equal(s.messages.filter(m=>m.round===1&&m.kind==='report').length,s.lastReport.narrative.paragraphs.length);assert.match(s.messages.find(m=>m.round===1&&m.kind==='report'&&m.front==='sha').text,/尚未到位/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('成功生成的正文保存到结报，读取与重看不重新生成',async()=>{
 const s=fresh();orders(s,[order]);settle(s);let input;
 const n=await narrateReport(s,{model:async request=>{input=request.input;return {paragraphs:[{front:'sha',text:'接应队还在往沙摩柯所在处赶，尚未与前线会合。',eventIds:[input.events[0].id]}]};}});
 assert.equal(n.source,'model');assert.equal(input.units.find(u=>u.id==='2').state,'marching');
});
