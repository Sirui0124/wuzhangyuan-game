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
const fixed=[];
for(let seed=731115;seed<731215;seed++)for(const ration of [80,100,120])for(const pace of ['normal','rush'])for(const response of ['rest','continue'])fixed.push(run(seed,[500,800,700],ration,pace,response));
const allocations=[];
for(let fu=300;fu<=1100;fu+=100)for(let feng=400;feng<=1400;feng+=100)for(let sha=300;sha<=1100;sha+=100){if(fu+feng+sha>2500)continue;for(const seed of [731115,731116,731117])allocations.push(run(seed,[fu,feng,sha]));}
const aggregates=[];
for(const ration of [80,100,120])for(const pace of ['normal','rush'])for(const response of ['rest','continue']){const rows=fixed.filter(x=>x.ration===ration&&x.pace===pace&&x.response===response);aggregates.push({ration,pace,response,n:rows.length,full:rows.filter(x=>x.full===3&&x.saved===4).length,zeroLoss:rows.filter(x=>x.loss===0).length,minGrain:Math.min(...rows.map(x=>x.grain)),maxGrain:Math.max(...rows.map(x=>x.grain)),meanLoss:rows.reduce((a,x)=>a+x.loss,0)/rows.length,meanPeriods:rows.reduce((a,x)=>a+x.periods,0)/rows.length});}
const byArmy=new Map();for(const row of allocations){const key=row.army.join('/');if(!byArmy.has(key))byArmy.set(key,[]);byArmy.get(key).push(row);}
const robust=[...byArmy.values()].filter(rows=>rows.every(x=>x.full===3&&x.saved===4&&x.loss===0)).map(rows=>({army:rows[0].army,total:rows[0].army.reduce((a,x)=>a+x,0),minGrain:Math.min(...rows.map(x=>x.grain)),maxPeriods:Math.max(...rows.map(x=>x.periods))})).sort((a,b)=>a.total-b.total||b.minGrain-a.minGrain);
await fs.writeFile(new URL('../evidence/numeric-audit.json',import.meta.url),JSON.stringify({kind:'rule-simulation-not-player',fixed,allocations,aggregates,robust},null,2));
console.log(JSON.stringify({fixed:fixed.length,allocations:allocations.length,aggregates,robustCount:robust.length,smallest:robust.slice(0,10)},null,2));
