import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const rows=[];let s;
async function post(kind,payload={}){const r=await fetch('http://127.0.0.1:8812/api/yiling-command/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(kind==='session'?{}:{scenarioId:s.scenarioId,expectedRevision:s.revision,requestId:crypto.randomUUID(),...payload}),signal:AbortSignal.timeout(95000)});const v=await r.json();if(!r.ok)throw Error(v.error);s=v.session;return s;}
await post('session');
try{
 await post('chat',{front:'fu',text:'陛下遇害的消息，是谁告诉你的？'});const reply=s.messages.at(-1).text;assert.match(reply,/吴/);assert.equal(s.facts.liubeiAliveVerified,false);assert.equal(s.round,0);assert.equal(s.reserve,2000);rows.push({text:'陛下遇害的消息，是谁告诉你的？',reply,round:s.round,reserve:s.reserve,proof:s.facts.liubeiAliveVerified});
 console.log(JSON.stringify({passed:true,rows},null,2));
}finally{const out=new URL('../../../outputs/yiling-shared-ui/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('live-model.json',out),JSON.stringify({scenarioId:s.scenarioId,passed:rows.length===1,rows},null,2));}
