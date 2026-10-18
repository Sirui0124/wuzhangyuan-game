import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chapter,NarrativeEngine,tutorialInput,prepared,input,finish} from '../tests/narrative/weiyan-fixture.mjs';
const require=createRequire(import.meta.url);
const {ApiJudge}=require('../.narrative-build/GameStarter/assets/scripts/narrative/judge.js');
const inputFile=process.argv.find(s=>s.startsWith('--input='))?.slice(8)??'weiyan-v07-explicit-json.json';
const outputFile=process.argv.find(s=>s.startsWith('--output='))?.slice(9)??'weiyan-v07-safety-replay.json';
if(![inputFile,outputFile].every(s=>/^[\w.-]+\.json$/.test(s)))throw Error('JSON filenames only');
const source=JSON.parse(readFileSync('web-demo/verification/'+inputFile));
const records=[];
for(const c of source.records){
 const port=new ApiJudge({async respond(payload){const p=JSON.parse(payload.text),original=c.calls.find(call=>call.phase===p.kind);if(!original?.response)throw Error('Missing recorded response');let response=original.response;if(p.kind==='classify'){const parsed=JSON.parse(response);parsed.requestId=p.requestId;response=JSON.stringify(parsed);}return {text:response};}});
 const e=c.phase==='first'?new NarrativeEngine(chapter,'v07-replay',port):await prepared(false,port);
 c.phase==='first'?tutorialInput(e):input(e);
 const r=await e.submitFreeInput('propose_wait',c.phase==='first'?['scout_statement']:['scout_statement','jiangwei_route'],c.text);
 const reply=e.currentLine()?.text;finish(e);finish(e);
 const f=e.snapshot().flags,worldOK=c.expected==='accept'?(c.phase==='first'?e.interactions().nodeId==='player.revival':f['loop.completed_wuzhang']===true):c.expected==='out_of_scope'?f['loop.result']==='execution'&&f['loop.player_alive']===false:f['loop.result']==='lamp_failure';
 records.push({round:c.round,phase:c.phase,id:c.id,text:c.text,expected:c.expected,reply,sourceReply:c.reply,generatedUsed:c.responseJson?.['回应的话']===reply,changed:reply!==c.reply,passed:r.kind==='judged'&&r.result.status===c.expected&&worldOK});
}
const hashes=Object.fromEntries(['../assets/scripts/narrative/weiyan.ts','../../content/chapters/wuzhang/chapter.json'].map(p=>[p,createHash('sha256').update(readFileSync(new URL(p,import.meta.url))).digest('hex')]));
writeFileSync('web-demo/verification/'+outputFile,JSON.stringify({timestamp:new Date().toISOString(),scope:'Offline replay of actual recorded v07 API responses on final response guards; not new API calls. Only requestId is remapped to the new engine request.',sourceReport:inputFile,sourceHashes:source.hashes,hashes,records,summary:{total:records.length,passed:records.filter(c=>c.passed).length,generated:records.filter(c=>c.generatedUsed).length,fallback:records.filter(c=>!c.generatedUsed).length,changed:records.filter(c=>c.changed).length}},null,2));
console.log(JSON.stringify({total:records.length,passed:records.filter(c=>c.passed).length,changed:records.filter(c=>c.changed).map(c=>({phase:c.phase,id:c.id,reply:c.reply}))},null,2));
if(records.some(c=>!c.passed))process.exitCode=1;
