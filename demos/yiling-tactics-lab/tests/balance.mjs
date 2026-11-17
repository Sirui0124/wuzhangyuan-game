import {fresh,defaultPolicy,queue,advance} from '../.build/engine.js';
import {mkdir,writeFile} from 'node:fs/promises';
const policies={
 '留预备，三回合转投山林':{fu:[1000,{mode:'forward'}],feng:[500,{}],sha:[500,{}],sample:true},
 '早搜山林，借原部接傅肜':{fu:[500,{mode:'borrow'}],feng:[1000,{mode:'parallel'}],sha:[1000,{}]},
 '早用双将与山林物资':{fu:[500,{mode:'borrow'}],feng:[1000,{mode:'parallel',guard:200,package:true}],sha:[1000,{package:true}]},
 '省物资，维持初始部署':{fu:[500,{mode:'borrow'}],feng:[1000,{mode:'parallel'}],sha:[500,{}]},
 '先救傅肜，再转双将':{fu:[2500,{mode:'forward'}],feng:[0,{native:false}],sha:[0,{native:false}],concentrate:true},
 '三路只派三百':{fu:[300,{mode:'borrow'}],feng:[300,{guard:200}],sha:[300,{guard:300}]}
};
function run(spec,seed){const s=fresh(seed);for(const id of ['fu','feng','sha']){const [n,extra]=spec[id];queue(s,id,{...defaultPolicy(id),troops:n,...extra});}while(!s.ended){
 if(spec.concentrate&&s.turn===4)queue(s,'feng',{...defaultPolicy('feng'),troops:1500,mode:'parallel'});
 if(spec.sample&&s.turn===3){queue(s,'feng',{...defaultPolicy('feng'),troops:500,guard:200,package:true});queue(s,'sha',{...defaultPolicy('sha'),troops:1000,package:true});}
 if(spec.sample&&s.turn===4)queue(s,'sha',{...defaultPolicy('sha'),troops:500});
 advance(s);
 }return {saved:Object.keys(s.saved).length,full:Object.values(s.fronts).filter(f=>f.result==='complete').length,rounds:s.turn-1,loss:s.losses,stock:s.stock,exposure:s.history.reduce((n,r)=>n+r.lines.reduce((m,l)=>m+l.risk,0),0)};}
const N=500,out={date:'2026-11-15',samplesPerPolicy:N,method:'Direct compiled engine; same 500 seed values and fixed per-turn/front draws; policies are hand-authored, not exhaustive optimization.',policies:{}};
for(const [name,spec] of Object.entries(policies)){const rows=Array.from({length:N},(_,i)=>run(spec,Math.imul(i+1,2654435761)>>>0));const mean=k=>rows.reduce((n,r)=>n+r[k],0)/N;out.policies[name]={allLeaders:rows.filter(r=>r.saved===4).length/N,allRoutes:rows.filter(r=>r.full===3).length/N,rounds:mean('rounds'),loss:mean('loss'),stock:mean('stock'),exposure:mean('exposure'),example:run(spec,731115)};}
await mkdir(new URL('../checks/',import.meta.url),{recursive:true});await writeFile(new URL('../checks/balance.json',import.meta.url),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
