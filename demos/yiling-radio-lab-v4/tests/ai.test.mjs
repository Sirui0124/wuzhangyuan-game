import test from 'node:test';import assert from 'node:assert/strict';import {handle} from '../ai.mjs';import {fresh} from '../.build/engine.js';
const signal=new AbortController().signal;
const model=o=>async()=>({text:JSON.stringify(o)});
const order=(text,c)=>({text,state:fresh(),selected:'a'});
test('pure location wording requests a fresh report rather than stale advice',async()=>{const result=await handle({text:'甲队现在在哪里？只报位置。',state:fresh(),selected:'a'},signal,model({kind:'answer',reply:'在营。'}));assert.equal(result.kind,'query');assert.equal(result.topic,'position');});
test('a quoted wrong force size cannot silently turn 500 into 700',async()=>{const body=order('派500人接傅肜。');await assert.rejects(handle(body,signal,model({kind:'order',commands:[{units:['a'],action:'rescue',target:'rear',quote:body.text}]})),/整队/);});
test('only reported enemy data and qualitative stamina reach the model',async()=>{let facts;await handle({text:'有什么情况？',state:fresh(),selected:'a'},signal,async p=>{facts=JSON.parse(p.text).facts;return {text:JSON.stringify({kind:'answer',reply:'等前线回报。'})};});assert.deepEqual(facts.knownEnemy,[]);assert.equal(facts.units[0].stamina,undefined);});
test('a changed rest duration must come from the player words',async()=>{const body=order('甲队原地休整一分钟。');const r=await handle(body,signal,model({kind:'order',commands:[{units:['a'],action:'rest',target:'camp',seconds:900,quote:body.text}]}));assert.equal(r.commands[0].seconds,60);});
test('unsupported actions do not leave a partial valid order',async()=>{const body=order('甲队烧旧营，乙队接伤兵。');const r=await handle(body,signal,model({kind:'order',unsupported:['本版不支持放火。'],commands:[{units:['b'],action:'rescue',target:'campfire',quote:'乙队接伤兵'}]}));assert.deepEqual(r.commands,[]);});
