import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDemoServer} from '../server.mjs';
import {createState,recordChat,think,publicView} from '../.build/engine.js';

test('两次问情报、一次说服仍能完成核心路线',()=>{
 const s=createState('test','seed');s.tracks.huang.discovered=true;s.tracks.huang.known=['huang-0'];
 recordChat(s,'huang','两岸怎样接应？','两岸回号。',['huang-1']);
 recordChat(s,'huang','最后一批呢？','留船。',['huang-2']);think(s,'huang',['huang-1','huang-2']);
 recordChat(s,'huang','分批接收，留船接回最后一队。','我安排将士过江。',[],true);
 assert.equal(s.tracks.huang.agreed,true);assert.equal(publicView(s).routes[0].questionsLeft,0);
 assert.throws(()=>recordChat(s,'huang','再问','回复',[]),/3次/);
});

test('每队每轮三次：失败不计数、读档保持、第四次不调用模型、下一轮重置',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'yiling-quota-'));let calls=0,fail=false;
 const server=createDemoServer({saveDir:dir,ai:async(kind,input)=>{
  if(kind==='talk'){calls++;if(fail)throw new Error('模拟请求失败');return {reply:'报信人说明了眼前的情况。',reveal:[],accepted:false};}
  return {text:'各路军报已到。',messages:input.changes.map(c=>({id:c.id,message:'队伍仍在等待接应。'}))};
 }});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;let s;
 const post=async(path,data={})=>{const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:s?.id,revision:s?.revision,...data})});const v=await r.json();if(v.state)s=v.state;return {status:r.status,...v};};
 try{
  await post('start');await post('camp-select',{target:'liu',route:'front'});await post('camp-select',{target:'attendant',route:'huang'});
  fail=true;assert.equal((await post('talk',{target:'front',question:'问路'})).status,400);fail=false;
  assert.equal(s.routes.find(r=>r.id==='front').questionsLeft,3);
  for(let i=0;i<3;i++)assert.equal((await post('talk',{target:'front',question:'问路'})).status,200);
  const before=calls;assert.equal((await post('talk',{target:'front',question:'第四问'})).status,400);assert.equal(calls,before);
  s=(await(await fetch(base+'/api/state?session='+s.id)).json()).state;assert.equal(s.routes.find(r=>r.id==='front').questionsLeft,0);
  assert.equal((await post('talk',{target:'huang',question:'问路'})).status,200);
  const p=await post('preview',{orders:[]});await post('commit',{token:p.token});assert.equal(s.routes.find(r=>r.id==='front').questionsLeft,0);
  assert.equal((await post('talk',{target:'front',question:'结果阶段也不能再问'})).status,400);
  await post('next');assert.equal(s.routes.find(r=>r.id==='front').questionsLeft,3);assert.equal((await post('talk',{target:'front',question:'本轮再问'})).status,200);
 }finally{await new Promise(ok=>server.close(ok));await rm(dir,{recursive:true,force:true});}
});
