import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDemoServer} from '../server.mjs';
import {validateTalk,validateAssess} from '../ai.mjs';

test('页面入口及其浏览器模块依赖均可加载',async()=>{
 const server=createDemoServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const html=await(await fetch(base+'/')).text();
  const scripts=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
  assert.ok(scripts.length,'页面必须声明入口脚本');
  const seen=new Set();
  async function check(path){
   const url=new URL(path,base).href;if(seen.has(url))return;seen.add(url);
   const response=await fetch(url);assert.equal(response.status,200,url);
   assert.match(response.headers.get('content-type'),/javascript/,url);
   const source=await response.text();
   for(const m of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))await check(new URL(m[1],url).href);
  }
  for(const script of scripts)await check(script);
 }finally{await new Promise(ok=>server.close(ok));}
});
test('拒绝越权情报和伪造军令引用',()=>{assert.throws(()=>validateTalk({reply:'泄漏',reveal:['future'],accepted:false},['now']));assert.throws(()=>validateAssess({orders:[{id:'fu',evidence:[{id:'a',quote:'没有写过'}],reason:'ok'}]},[{id:'fu',text:'救人',allowedActions:[{id:'a'}]}]));});
test('事务提交、重复确认、AI失败与读档恢复',async()=>{const dir=await mkdtemp(join(tmpdir(),'yiling-test-'));let failReport=false;const ai=async(kind,input)=>{if(kind==='camp')throw new Error('军营对白不应调用模型');if(kind==='talk')return {reply:'我知道的就这一件。',reveal:input.offered.map(f=>f.id),accepted:false};if(kind==='assess')return {orders:input.orders.map(o=>({id:o.id,evidence:[],reason:'需要进一步明确安排。'}))};if(failReport)throw new Error('模拟服务断线');return {text:'各路报信的人回到营中，尚未接到的人仍在等待。',messages:input.changes.map(c=>({id:c.id,message:'报信人回营，交代了这一趟的实际情况。'}))};};const server=createDemoServer({ai,saveDir:dir});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;let s;
 const post=async(path,data={})=>{const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:s?.id,revision:s?.revision,...data})});return {status:r.status,...await r.json()};};
 try{s=(await post('start')).state;const failedChoice=await post('camp-select',{target:'liu',route:'invalid'});assert.equal(failedChoice.status,400);const untouched=JSON.parse(await readFile(join(dir,s.id+'.json'),'utf8'));assert.deepEqual(untouched.campDecisions,{});assert.equal(untouched.tracks.front.discovered,false);s=(await post('camp-select',{target:'liu',route:'front'})).state;assert.ok(s.routes.some(r=>r.id==='front'));const repeated=await post('camp-select',{target:'liu',route:'ma'});assert.equal(repeated.status,400);const bypass=await post('talk',{target:'clerk',subject:'sha',question:'直接告知'});assert.equal(bypass.status,400);const p=await post('preview',{orders:[{id:'front',troops:1000,text:'去接人'}]});assert.deepEqual(Object.keys(p.entries[0]).sort(),['id','name','outlook','reason','text','troops']);assert.equal(typeof p.entries[0].outlook,'string');assert.ok(!JSON.stringify(s).includes('battleSeed'));failReport=true;const bad=await post('commit',{token:p.token});assert.equal(bad.status,400);let disk=JSON.parse(await readFile(join(dir,s.id+'.json'),'utf8'));assert.equal(disk.troops,2500);assert.equal(disk.phase,'orders');failReport=false;const good=await post('commit',{token:p.token});s=good.state;assert.equal(s.troops,1500);assert.equal(s.phase,'results');const again=await post('commit',{token:p.token});assert.equal(again.state.troops,1500);assert.equal(again.state.reports.length,1);s=(await post('next')).state;const recovered=await(await fetch(base+'/api/state?session='+s.id)).json();assert.equal(recovered.state.round,2);assert.equal(recovered.state.troops,2000);assert.equal('draw' in recovered.state.routes[0],false);
 }finally{await new Promise(ok=>server.close(ok));await rm(dir,{recursive:true,force:true});}
});

test('手动存档保留种子、军情与分支，读档创建独立进度并校验版本',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'yiling-checkpoint-'));
 const server=createDemoServer({saveDir:dir,ai:async()=>{throw new Error('存读档不应调用AI');}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 let s;
 const post=async(path,data={})=>{const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:s?.id,revision:s?.revision,...data})});return {status:r.status,...await r.json()};};
 try {
  s=(await post('start')).state;
  s=(await post('camp-select',{target:'liu',route:'front'})).state;
  const before=JSON.parse(await readFile(join(dir,s.id+'.json'),'utf8'));
  const saved=await post('checkpoint');assert.equal(saved.status,200);assert.equal('state' in saved,false);
  const snap=JSON.parse(await readFile(join(dir,saved.checkpoint.id+'.json'),'utf8'));
  const {id:ignored,checkpoint,...content}=snap;const {id:original,...expected}=before;
  assert.deepEqual(content,expected);assert.equal(checkpoint,true);
  const stale=await post('restore',{checkpoint:saved.checkpoint.id,revision:-1});assert.equal(stale.status,409);
  const forged=await post('restore',{checkpoint:s.id});assert.equal(forged.status,400);
  const restored=await post('restore',{checkpoint:saved.checkpoint.id});assert.equal(restored.status,200);
  assert.notEqual(restored.state.id,s.id);assert.notEqual(restored.state.id,saved.checkpoint.id);
  assert.equal(JSON.stringify(restored).includes('battleSeed'),false);
  const recovered=JSON.parse(await readFile(join(dir,restored.state.id+'.json'),'utf8'));
  const {id:newId,...actual}=recovered;assert.deepEqual(actual,expected);
  const second=await post('restore',{checkpoint:saved.checkpoint.id});assert.notEqual(second.state.id,newId);
  const immutable=await post('camp-select',{session:saved.checkpoint.id,revision:snap.revision,target:'clerk',route:'sha'});assert.equal(immutable.status,400);
  assert.deepEqual(JSON.parse(await readFile(join(dir,saved.checkpoint.id+'.json'),'utf8')),snap);
 } finally {await new Promise(ok=>server.close(ok));await rm(dir,{recursive:true,force:true});}
});
