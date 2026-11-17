import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDemoServer} from '../server.mjs';
import {createState,chooseCampPriority,campBriefing,publicView,resolveRound,nextRound} from '../.build/engine.js';
const fresh=()=>createState('test','seed');
const advance=s=>{resolveRound(s,[],[]);nextRound(s);};

test('各人一轮一次：选A即发现，B下一轮再问才发现，军吏依次交代',()=>{
 const s=fresh();chooseCampPriority(s,'liu','front');
 assert.equal(s.tracks.front.discovered,true);assert.equal(s.tracks.ma.discovered,false);
 assert.equal(s.campDecisions.ma.releaseRound,2);
 assert.throws(()=>chooseCampPriority(s,'liu','ma'));assert.equal(campBriefing(s,'liu'),null);
 assert.throws(()=>chooseCampPriority(s,'clerk','du'));
 chooseCampPriority(s,'clerk','sha');chooseCampPriority(s,'attendant','wang');
 assert.throws(()=>chooseCampPriority(s,'clerk','fu'));assert.throws(()=>chooseCampPriority(s,'clerk','du'));
 resolveRound(s,[],[]);assert.equal(campBriefing(s,'clerk'),null);assert.equal(s.tracks.fu.discovered,false);
 nextRound(s);assert.equal(publicView(s).routes.length,3);assert.equal(s.tracks.ma.discovered,false);assert.equal(s.tracks.fu.discovered,false);assert.equal(s.tracks.huang.discovered,false);
 assert.deepEqual(campBriefing(s,'clerk').choices.map(c=>c.id),['fu']);
 chooseCampPriority(s,'liu','ma');chooseCampPriority(s,'clerk','fu');chooseCampPriority(s,'attendant','huang');
 assert.equal(publicView(s).routes.length,6);assert.equal(campBriefing(s,'clerk'),null);advance(s);
 assert.deepEqual(campBriefing(s,'clerk').choices.map(c=>c.id),['du','cheng']);
 chooseCampPriority(s,'clerk','cheng');assert.equal(s.tracks.cheng.discovered,true);assert.equal(s.tracks.du.discovered,false);
 advance(s);assert.equal(s.tracks.du.discovered,false);chooseCampPriority(s,'clerk','du');assert.equal(s.tracks.du.discovered,true);assert.equal(campBriefing(s,'clerk'),null);
 assert.equal(s.troops,4000);
});

test('结果阶段选择也等完整一轮；船工保留第4时辰解锁',()=>{
 const s=fresh();assert.equal(campBriefing(s,'boat'),null);resolveRound(s,[],[]);
 chooseCampPriority(s,'liu','ma');assert.equal(s.tracks.front.discovered,false);
 nextRound(s);assert.equal(s.tracks.front.discovered,false);assert.equal(campBriefing(s,'boat'),null);
 resolveRound(s,[],[]);assert.equal(s.tracks.front.discovered,false);chooseCampPriority(s,'liu','front');assert.equal(s.tracks.front.discovered,true);
 chooseCampPriority(s,'boat','sun');assert.equal(s.tracks.sun.discovered,true);assert.throws(()=>chooseCampPriority(s,'boat','sun'));
});

test('旧存档本轮已问仍锁定；末轮延迟不能变成第七轮',()=>{
 const s=fresh();s.chats.clerk=[{role:'user',text:'旧版问话',round:1}];s.tracks.fu.discovered=true;
 assert.equal(campBriefing(s,'clerk'),null);assert.equal(publicView(s).camp.find(n=>n.id==='clerk').visited,true);
 advance(s);assert.deepEqual(campBriefing(s,'clerk').choices.map(c=>c.id),['sha']);
 for(let i=2;i<6;i++)advance(s);
 chooseCampPriority(s,'attendant','huang');assert.equal(s.campDecisions.wang.releaseRound,7);
 assert.match(s.campVisits.attendant.reply,/来不及/);advance(s);
 assert.equal(s.phase,'ended');assert.equal(s.tracks.wang.discovered,false);assert.equal(s.troops,5000);
 assert.equal(campBriefing(s,'invalid'),null);
});

test('服务端存档防重复、旧接口无法绕过、固定对白零模型调用',async()=>{
 const saveDir=await mkdtemp(join(tmpdir(),'yiling-camp-priority-'));let calls=0,s;
 const server=createDemoServer({saveDir,ai:async()=>{calls++;throw new Error('军营不应调用模型');}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
 const post=async(path,data={})=>{const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:s?.id,revision:s?.revision,...data})});const v=await r.json();if(v.state)s=v.state;return {status:r.status,...v};};
 try{
  await post('start');assert.equal((await post('camp-select',{target:'liu',route:'front'})).status,200);
  s=(await(await fetch(base+'/api/state?session='+s.id)).json()).state;
  assert.equal(s.camp.find(n=>n.id==='liu').briefing,null);assert.equal(s.routes.some(r=>r.id==='ma'),false);
  const revision=s.revision;
  assert.equal((await post('camp-select',{target:'liu',route:'ma'})).status,400);
  assert.equal((await post('camp-choice',{target:'liu',subject:'ma',choice:'courier'})).status,400);
  assert.equal((await post('camp-select',{target:'clerk',route:'du'})).status,400);
  assert.equal(s.revision,revision);assert.equal(calls,0);
  assert.equal((await post('camp-select',{target:'clerk',route:'fu'})).status,200);
  assert.equal(calls,0);
 }finally{await new Promise(ok=>server.close(ok));await rm(saveDir,{recursive:true,force:true});}
});

test('不回军营交谈，跨轮、刷新和军报均不增加已发现路线',()=>{let s=fresh();chooseCampPriority(s,'liu','front');chooseCampPriority(s,'clerk','sha');chooseCampPriority(s,'attendant','huang');for(let i=0;i<4;i++){advance(s);s=JSON.parse(JSON.stringify(s));assert.deepEqual(publicView(s).routes.map(r=>r.id).sort(),['front','huang','sha']);assert.ok(s.reports.every(r=>r.changes.every(c=>['front','huang','sha'].includes(c.id))));}assert.equal(s.campDecisions.ma.releaseRound,2);assert.deepEqual(campBriefing(s,'liu').choices.map(c=>c.id),['ma']);});
