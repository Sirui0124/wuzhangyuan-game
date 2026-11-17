import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,validateDecision} from '../server.mjs';
test('AI采纳必须引用本次真实原话',()=>{assert.throws(()=>validateDecision({reply:'好。',accepted:true,quote:'不存在的军令'},'先接伤员'));assert.deepEqual(validateDecision({reply:'好，先接伤员。',accepted:true,quote:'先接伤员'},'先接伤员，再撤回来'),{reply:'好，先接伤员。',accepted:true});});
test('不能一边采纳一边追加问题',()=>{assert.throws(()=>validateDecision({reply:'好。谁来安排最后一批？',accepted:true,quote:'留船'},'留船接最后一批'));});
test('服务沿用本机模型传输，限制事件与跨来源，健康接口不泄露凭据',async()=>{
 let called=0;const server=createServer({config:async()=>({apiKey:'TEST_SECRET',baseUrl:'https://example.invalid',model:'fixture'}),model:async(c,input)=>{called++;assert.ok(input.system.includes('不要求固定句式'));return {text:JSON.stringify({reply:'我带将士一道撤。',accepted:true,quote:'一起撤'})};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{const health=await(await fetch(base+'/api/health')).text();assert.ok(!health.includes('SECRET'));assert.equal(JSON.parse(health).ai,true);
 const post=(body,origin=base)=>fetch(base+'/api/dialogue',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 assert.equal((await post({event:'fu-arrival',text:'一起撤'},'https://evil.invalid')).status,403);
 assert.equal((await post({event:'unknown',text:'一起撤'})).status,400);
 const good=await post({event:'fu-arrival',text:'护送伤兵，然后一起撤'});assert.equal(good.status,200);assert.equal((await good.json()).accepted,true);assert.equal(called,1);
 assert.equal((await fetch(base+'/../../GameStarter/server/.env')).status,404);
 }finally{await new Promise(r=>server.close(r));}
});
