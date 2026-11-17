// Read-only rule experiments. This is not model play or a browser/API test.
import fs from 'node:fs/promises';
import {fresh,confirm,step,pending,IDS} from '../../../.build/engine.js';
const command=(route,count,extra={})=>({route,action:'rescue',count,countMode:count===null?'keep':'set',goal:'all',grain:0,relief:0,waitFor:'now',...extra});
function run(seed,army=[500,800,700],ration=100,pace='normal',response='rest'){
 const s=fresh(seed),decision=[];
 confirm(s,IDS.map((id,i)=>command(id,army[i],{ration,pace})),s.revision,'固定开局');
 while(!s.world.ended&&s.world.history.length<12){
  for(const a of pending(s)){
   let extra={action:a.id==='grain-alert'?'continue':response};
   if(response==='reinforce'&&a.id!=='grain-alert')extra=s.world.camp>=400?{action:'continue',countMode:'add',count:400}:{action:'rest'};
   if(response==='relief'&&a.id!=='grain-alert')extra=s.conflict?.needGrain?{action:'supply',relief:s.conflict.needGrain}:{action:'rest'};
   decision.push({turn:s.world.turn,route:a.route,kind:s.conflict?.kind,action:extra.action,count:extra.count||0,relief:extra.relief||0});
   confirm(s,[command(a.route,extra.count??null,extra)],s.revision,'固定规则回令');
  }
  step(s);
 }
 return {seed,army,ration,pace,response,ended:s.world.ended,periods:s.world.history.length,saved:Object.keys(s.world.saved).length,full:IDS.filter(id=>s.world.fronts[id].result==='complete').length,loss:s.world.losses,grain:s.world.stock,eaten:s.world.eaten,relief:s.world.relief,decisions:decision,fronts:Object.fromEntries(IDS.map(id=>[id,{morale:s.world.fronts[id].morale,fatigue:s.world.fronts[id].fatigue,result:s.world.fronts[id].result}])),rescued:s.world.saved};
}
const rows=[];for(const seed of [731115,731116,731117])for(const army of [[500,800,700],[800,800,700],[800,900,800]])for(const response of ['rest','reinforce','relief','continue'])rows.push(run(seed,army,100,'normal',response));
await fs.writeFile(new URL('../evidence/reserve-audit.json',import.meta.url),JSON.stringify({kind:'rule-simulation-not-player',rows},null,2));
console.log(JSON.stringify(rows.filter(x=>x.army[0]===500).map(({fronts,rescued,...x})=>x),null,2));
