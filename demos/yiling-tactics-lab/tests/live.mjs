import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {handleAI} from '../ai.mjs';
import {fresh,defaultPolicy} from '../.build/engine.js';
const cases=[
 {kind:'plan',route:'fu',text:'派三百人先替后阵，借傅肜原部整队后回身掩护。全部接齐后回来。',expected:r=>r.policy?.troops===300&&r.policy?.mode==='borrow'&&!r.policy?.package&&!r.unsupported.length},
 {kind:'plan',route:'feng',text:'派五百人先清侧路，让原军吏迁旗。送一份绳索和担架，留下二百人引导岔口，其余护送，接齐后回来。',expected:r=>r.policy?.troops===500&&r.policy?.guard===200&&r.policy?.native&&r.policy?.package&&!r.unsupported.length},
 {kind:'ask',route:'sha',text:'现在把人全派去搜，林口不留人，找到后能接出来吗？',expected:r=>typeof r.reply==='string'&&r.reply.length>5}
];
const results=await Promise.all(cases.map(async c=>{const state=fresh(),before=JSON.stringify(state);try{const result=await handleAI(c.kind,{state,route:c.route,text:c.text,policy:{...defaultPolicy(c.route),troops:500}},AbortSignal.timeout(45000));assert.equal(JSON.stringify(state),before);return {kind:c.kind,route:c.route,text:c.text,passed:!!c.expected(result),result};}catch(e){return {kind:c.kind,route:c.route,text:c.text,passed:false,error:e.message};}}));
await mkdir(new URL('../checks/',import.meta.url),{recursive:true});await writeFile(new URL('../checks/live.json',import.meta.url),JSON.stringify({date:'2026-11-15',results,note:'Real configured model; drafts only, no player save changed.'},null,2));console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.passed))process.exitCode=1;
