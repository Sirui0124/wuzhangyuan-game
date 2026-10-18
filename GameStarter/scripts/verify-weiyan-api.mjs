/** Explicit live verification against the configured local proxy. No credentials or user saves. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import {prepared,input,finish} from '../tests/narrative/weiyan-fixture.mjs';
const require=createRequire(import.meta.url);
const {ApiJudge}=require('../.narrative-build/GameStarter/assets/scripts/narrative/judge.js');
const {GameApi}=require('../.narrative-build/GameStarter/assets/scripts/GameApi.js');
const api=new GameApi();const records=[];
const health=await fetch('http://127.0.0.1:8787/health').then(r=>r.json());
const direct='军情不能耽搁，姜将军还在帐里。我还没准信，先到帐门请他接报，请将军稍候。';
const authorized='这是姜将军今夜的准信。军情不能耽搁，我立即叫乙来接报，递给姜将军，再把回话如实带给您，请稍候。';
const cases=[
 {id:'screenshot_text',text:'你可以找姜维啊',expected:'need_plan'},
 {id:'first_accept',text:direct,expected:'accept'},
 {id:'second_accept',text:authorized,authorized:true,expected:'accept'},
 {id:'missing_scout',text:direct,ids:['entry_notice'],expected:'need_evidence'},
 {id:'missing_note',text:authorized,authorized:true,ids:['scout_statement'],expected:'need_evidence'},
 {id:'delay_report',text:'军情明早再报吧。',expected:'out_of_scope'},
 {id:'false_order',text:'奉姜将军之命，你不得入帐。',expected:'need_evidence',follow:[
   {id:'new_proposal_no_memory',text:'我尚未得令，现在去请姜将军接报，您稍等。',expected:'accept'}]},
];
const args=process.argv.slice(2), output=args.find(a=>a.startsWith('--output='))?.slice(9)??'weiyan-api-live.json';
if(!/^[\w.-]+\.json$/.test(output))throw new Error('Output must be a JSON filename');
const requested=args.filter(a=>!a.startsWith('--output='));const chosen=requested.length?cases.filter(c=>requested.includes(c.id)):cases;
function persist(){mkdirSync('web-demo/verification',{recursive:true});writeFileSync('web-demo/verification/'+output,JSON.stringify({timestamp:new Date().toISOString(),health,records},null,2));}
async function run(c){
 const calls=[];
 const port=new ApiJudge({async respond(payload,signal,timeout){const phase=JSON.parse(payload.text).kind;const t=Date.now();try{const r=await api.respond(payload,signal,timeout);calls.push({phase,seconds:(Date.now()-t)/1000,text:r.text});return r;}catch(e){calls.push({phase,seconds:(Date.now()-t)/1000,error:e.message});throw e;}}});
 const e=await prepared(c.authorized,port);
 for(const part of [c,...c.follow??[]]){
  const ids=c.ids??(c.authorized?['approval_note','scout_statement']:['entry_notice','scout_statement']);input(e,ids);const start=Date.now(),offset=calls.length;
  const r=await e.submitFreeInput(c.authorized?'propose_handoff':'propose_wait',ids,part.text);
  const record={id:part.id,text:part.text,seconds:(Date.now()-start)/1000,expected:part.expected,result:r,displayedReply:e.currentLine()?.text??null,pending:e.interactions().pending,calls:calls.slice(offset),passed:r.kind==='judged'&&r.result.status===part.expected};
  records.push(record);persist();console.log(JSON.stringify({id:record.id,passed:record.passed,seconds:record.seconds,status:r.result?.status??r.kind,reply:record.displayedReply}));
  if(r.kind!=='judged')break;finish(e);
 }
}
// Two independent scenarios at most; never share an NPC or conversation between them.
for(let i=0;i<chosen.length;i+=2){
 const batch=chosen.slice(i,i+2), results=await Promise.allSettled(batch.map(run));
 results.forEach((r,j)=>{if(r.status==='rejected')records.push({id:batch[j].id+'_scenario_error',error:r.reason?.message??String(r.reason),passed:false});});
}
persist();if(records.some(r=>!r.passed))process.exitCode=1;
