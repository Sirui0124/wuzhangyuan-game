import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {fresh} from '../.build/engine.js';
const cases=[
 ['four-units','甲队接应傅肜，乙队走南侧路接冯习张南，丙队搜东沟，丁队留营待命。',r=>r.kind==='order'&&r.commands.length===4],
 ['names-and-numbers','派700人接傅肜，800人去旧营，600人去东沟，400人留营。',r=>r.kind==='order'],
 ['position','甲队现在在哪里？只报位置，不用改变行动。',r=>r.kind==='query'&&r.topic==='position'],
 ['all-reports','各队报告现在的位置，先不要调兵。',r=>r.kind==='query'&&r.units.length===4],
 ['slow','甲队缓行前往东沟，不要突击。',r=>r.kind==='order'&&r.commands[0].slow&&!r.commands[0].rush],
 ['rush-flank','丁队急行军经东岭支援后阵。',r=>r.kind==='order'&&r.commands[0].rush&&r.commands[0].via==='ridge'],
 ['rest-minute','乙队原地休整一分钟。',r=>r.kind==='order'&&r.commands[0].seconds===60],
 ['advice','正常行军、急行和休整有什么区别？先别执行。',r=>r.kind!=='order'],
 ['unsupported','甲队放火烧旧营，然后撤回。',r=>r.kind!=='order']
];const rows=[];
for(let i=0;i<cases.length;i+=3){await Promise.all(cases.slice(i,i+3).map(async([name,text,check])=>{try{const response=await fetch('http://127.0.0.1:8953/api/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:fresh(),selected:'a',text})}),result=await response.json();rows.push({name,text,status:response.status,result,passed:response.ok&&check(result)});}catch(e){rows.push({name,text,passed:false,error:e.message});}}));}
await fs.writeFile(new URL('live.json',import.meta.url),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.map(({name,status,passed,result})=>({name,status,passed,kind:result?.kind}))));assert.ok(rows.every(r=>r.passed));
