import {polishFixtures} from './dialogue-polish-fixtures.mjs';
import {dialogueFixtures} from './dialogue-fixtures.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
if(!process.argv.includes('--live'))throw Error('Explicit --live required');
const build='outputs/dialogue-polish-20261027/build',out='outputs/dialogue-polish-20261027';mkdirSync(out,{recursive:true});
const imp=p=>import(pathToFileURL(resolve(build,'GameStarter/web-demo/src/'+p+'.js')));
const {polishDialogue}=await imp('dialogue-polish'),{judgeJietingDialogue}=await imp('chapters/chapter-three/open-dialogue'),{judgeOpenDialogue}=await imp('chapters/chapter-two/open-dialogue');
const {expressionAgents}=await imp('expression-agent');
const {GameApi}=await import(pathToFileURL(resolve(build,'GameStarter/assets/scripts/GameApi.js')));
const results=[],api=new GameApi(),cases=await polishFixtures(build);
const f=await dialogueFixtures(build);
for(const stage of ['first','authorized'])cases.push({id:'weiyan-'+stage,chapter:'wuzhang',stage});
const wanted=process.env.POLISH_CASE;
const queue=cases.filter(c=>!wanted||c.id===wanted);
async function run(c){
 const result={id:c.id,chapter:c.chapter,startedAt:new Date().toISOString()},signal=AbortSignal.timeout(240000);
 const traced={respond:async(...args)=>{const response=await api.respond(...args);(result.calls??=[]).push({prompt:args[0].text,response:response.text});return response;}};
 try{
  if(c.chapter==='wuzhang'){
   const agent=expressionAgents(traced),s=c.stage==='first'?f.first(agent.judge,agent.generate):await f.authorized(agent.judge,agent.generate);
   for(const id of [...s.snapshot().story.selected])s.selectEvidence(id);
   for(const id of c.stage==='first'?['C06','C05']:['C06','C08','R01'])s.selectEvidence(id);
   s.setFocus(c.stage==='first'?'我来转呈军报，请将军稍候。':'请将军随我去见伯约，交报由他判断。');
   if(!await s.generateExpression())throw Error(s.snapshot().composition.error);
   result.text=s.snapshot().story.draft;
   if(!await s.confirmExpression())throw Error('confirmation failed');
   result.judgment=s.snapshot().speech;result.passed=s.snapshot().speech?.result==='ok';
  }else{
   result.input=c.input;result.text=await polishDialogue(c.input,signal,traced);
   if(c.chapter==='grain'){
    result.judgment=await judgeOpenDialogue(result.text,c.session.currentRubric,c.session.clues,signal,[],[],{responseContext:c.session.dialogueResponseContext});
    result.passed=Object.values(result.judgment.scores).every(s=>s.delta>=1);
   }else{
    result.judgment=await judgeJietingDialogue({context:c.session.getEvaluationContext(),input:result.text,clueIds:c.session.state.selected,confirmed:true},signal,traced);
    result.passed=['great','accepted'].includes(result.judgment.outcome)&&result.judgment.status==='final'&&!result.judgment.special;
   }
  }
 }catch(e){result.error=e.message;result.passed=false;}
 results.push(result);writeFileSync(resolve(out,c.id+'-live.json'),JSON.stringify(result,null,2));writeFileSync(resolve(out,'live-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({id:c.id,passed:result.passed,text:result.text,error:result.error,judgment:result.judgment?.outcome??result.judgment?.scores??result.judgment?.result}));
}
await Promise.all([0,1].map(async()=>{while(queue.length)await run(queue.shift());}));
if(results.some(r=>!r.passed))process.exitCode=1;
