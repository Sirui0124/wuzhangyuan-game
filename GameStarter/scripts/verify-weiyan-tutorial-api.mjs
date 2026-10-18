import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {chapter,NarrativeEngine,tutorialInput,finish} from '../tests/narrative/weiyan-fixture.mjs';
const require=createRequire(import.meta.url);
const {ApiJudge}=require('../.narrative-build/GameStarter/assets/scripts/narrative/judge.js');
const {GameApi}=require('../.narrative-build/GameStarter/assets/scripts/GameApi.js');
const api=new GameApi(), records=[];
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'tutorial-v05-api-live.json';
if(!/^[\w.-]+\.json$/.test(output))throw Error('JSON filename only');
const cases=[
 {id:'reasonable',text:'告示说帐内有要事，斥候说营门尚未失守，但军情不能耽误。请将军暂候，我马上把急报交给帐门卫士，请他隔帘向帐内通报。',expected:'accept'},
 {id:'equivalent_words',text:'帐内有要事，您先在外面等一会儿，我马上到帐门请帐内的人出来听这份急报。',expected:'accept'},
 {id:'vague',text:'你可以找姜维啊',expected:'need_plan'},
 {id:'delay',text:'告示不让进，军情明早再说。',expected:'need_plan'},
 {id:'false_order',text:'奉姜将军之命，你不能进去。',expected:'need_evidence'},
];
const health=await fetch('http://127.0.0.1:8787/health').then(r=>r.json());
const persist=()=>writeFileSync('web-demo/verification/'+output,JSON.stringify({timestamp:new Date().toISOString(),health,records},null,2));
async function run(c){
 const calls=[];const port=new ApiJudge({async respond(payload,signal,timeout){const p=JSON.parse(payload.text),start=Date.now();try{const r=await api.respond(payload,signal,timeout);calls.push({phase:p.kind,request:p,text:r.text,seconds:(Date.now()-start)/1000});return r;}catch(e){calls.push({phase:p.kind,error:e.message});throw e;}}});
 const e=new NarrativeEngine(chapter,'tutorial-live',port);tutorialInput(e);const start=Date.now();
 const r=await e.submitFreeInput('propose_wait',['scout_statement'],c.text);const reply=e.currentLine()?.text;const before=e.snapshot();
 if(r.kind==='judged'){finish(e);if(c.expected==='accept'){finish(e);}else finish(e);}
 const after=e.snapshot();const record={...c,result:r,reply,seconds:(Date.now()-start)/1000,calls,before:{lamp:before.flags['loop.lamp_lit'],weiyan:before.flags['loop.weiyan_status']},after:{node:e.interactions().nodeId,lamp:after.flags['loop.lamp_lit'],completed:after.flags['progress.tutorial_completed'],evidence:after.evidence},passed:r.kind==='judged'&&r.result.status===c.expected&&(c.expected==='accept'?e.interactions().nodeId==='player.revival':after.flags['loop.lamp_lit']===false)};
 records.push(record);persist();console.log(JSON.stringify({id:c.id,passed:record.passed,status:r.result?.status??r.kind,reply}));
}
// Sequential live calls avoid confusing provider concurrency stalls with story decisions.
const selected=process.argv.filter(a=>!a.startsWith('--')).slice(2);
for(const c of cases.filter(c=>!selected.length||selected.includes(c.id))){try{await run(c);}catch(e){records.push({id:c.id,passed:false,error:e.message});persist();}}
persist();if(records.some(r=>!r.passed))process.exitCode=1;
