import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8828',out=resolve('outputs/yiling-rescue-demo-20261028');await mkdir(out,{recursive:true});let s;const log=[];
async function post(path,data={}){const began=Date.now();const response=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:s?.id,revision:s?.revision,...data})});const result=await response.json();log.push({path,seconds:(Date.now()-began)/1000,...data,result});await writeFile(resolve(out,'live-ai.json'),JSON.stringify(log,null,2));if(!response.ok)throw new Error(result.error);if(result.state)s=result.state;console.log(path,((Date.now()-began)/1000).toFixed(1)+'s',result.reply??result.entries?.map(e=>({name:e.name,reason:e.reason,after:e.after}))??s?.phase);return result;}
await post('start');await post('camp-choice',{target:'liu',subject:'front',choice:'trace'});
await post('camp-choice',{target:'clerk',subject:'sha',choice:'guide'});assert.ok(s.routes.find(r=>r.id==='sha'));
await post('talk',{target:'front',question:'他们能从哪条路撤回来？'});
await post('talk',{target:'front',question:'后面的追兵怎么办？'});assert.equal(s.routes.find(r=>r.id==='front').facts.length,3);
const p=await post('preview',{orders:[{id:'front',troops:1800,text:'把陛下已向西撤的消息送到，叫他们停止向旧御营靠拢。先守住西侧山口，让他们通过后一起撤，别再回头攻城。'}]});assert.equal(p.entries[0].matched.length,3);
await post('commit',{token:p.token});assert.equal(s.troops,700);assert.equal(s.phase,'results');
await post('next');assert.equal(s.round,2);
console.log('LIVE PASS',s.id);
