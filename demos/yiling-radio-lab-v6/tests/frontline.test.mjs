import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,confirm,tick} from '../.build/engine.js';
import {frontlineFacts,frontlineReply} from '../.build/frontline.js';
import {handle} from '../ai.mjs';
const signal=new AbortController().signal;
const model=result=>async()=>({text:JSON.stringify(result)});
const body=(text,front='sha')=>({mode:'frontline',text,front,state:fresh()});
test('three contacts describe their own problems before any deployment',()=>{
 const s=fresh();assert.match(frontlineReply(s,'sha','reason'),/两沟/);assert.match(frontlineReply(s,'camp','reason'),/前后队/);assert.match(frontlineReply(s,'fu','reason'),/退路/);
 assert.equal(s.started,false);assert.equal(s.time,0);
});
test('frontline context does not leak undetected enemy stats or work counters',()=>{
 const f=frontlineFacts(fresh(),'fu');assert.match(f.enemy,/尚无已确认/);assert.ok(!JSON.stringify(f).includes('470'));assert.ok(!JSON.stringify(f).includes('stamina'));
});
test('API question can address the named general instead of selected contact',async()=>{
 const b=body('傅肜为什么不撤？');const before=JSON.stringify(b.state);
 const r=await handle(b,signal,model({intent:'question',front:'fu',topic:'reason'}));
 assert.equal(r.kind,'frontline');assert.equal(r.speaker,'傅肜');assert.match(r.reply,/退路/);assert.equal(JSON.stringify(b.state),before);
});
test('an order on the contact page redirects without executing any command',async()=>{
 const b=body('派甲队接傅肜。');const r=await handle(b,signal,model({intent:'dispatch',front:'fu',topic:'needs'}));
 assert.equal(r.kind,'dispatch');assert.equal(r.commands,undefined);assert.equal(b.state.started,false);
});
test('missed contact is reported by the military clerk, not a live general',async()=>{
 const b=body('傅肜在哪里？','fu');confirm(b.state,[{units:['c'],action:'move',target:'east'}]);tick(b.state,270);
 const r=await handle(b,signal,model({intent:'question',front:'fu',topic:'position'}));assert.equal(r.speaker,'军侯');assert.match(r.reply,/失去联络/);
});
test('frontline cannot fabricate rescue or exact force counts',async()=>{
 const b=body('你手下多少人？');const r=await handle(b,signal,model({intent:'question',front:'sha',topic:'numbers',reply:'全员归营，1000人。'}));
 assert.match(r.reply,/尚未报/);assert.ok(!r.reply.includes('1000'));assert.ok(!Object.values(b.state.goals).some(g=>g.safe));
});

test('requests change after the general is picked up but wounded remain',()=>{
 const s=fresh();confirm(s,[{units:['c'],action:'rescue',target:'east'}]);tick(s,85);
 assert.ok(s.goals.east.carrier);assert.equal(s.goals.west.carrier,null);
 assert.match(frontlineReply(s,'sha','needs'),/东沟的人已经接上/);
});
