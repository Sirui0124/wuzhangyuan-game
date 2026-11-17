import {fresh,ROUTES,commit,endTurn,demand,risk} from '../.build/turn-engine.js';
import {writeFile,mkdir} from 'node:fs/promises';
const order=(route,troops,coordinate=false,supply=false,action='rescue')=>({route,troops,coordinate,supply,action});
function run(mode,seed,delta=0){const s=fresh(seed);for(const id of ROUTES)s.fronts[id].crisis=Math.min(100,s.fronts[id].crisis+delta);let count=0;
 while(!s.ended&&s.turn<=9){
  const active=ROUTES.filter(id=>s.fronts[id].status==='active');let ops=[];
  if(s.turn===1){
   const allocations={balanced:[1000,1000,500],reserve:[900,800,300],small:[300,300,300],concentrated:[2000,500,0],wrong:[1000,1000,500],supply:[1000,1000,500],noCoord:[1000,1000,500],adaptive:[900,1100,500],clearFirst:[900,1100,500]}[mode];
   ops=ROUTES.map((id,i)=>({...order(id,allocations[i],!['noCoord','wrong'].includes(mode)&&allocations[i]>0,mode==='supply',mode==='wrong'?'attack':'rescue'),objective:mode==='clearFirst'&&id==='feng'?'clear':'current'}));
  }else if(mode==='adaptive'||mode==='clearFirst'||mode==='reserve'||mode==='concentrated'){
   let camp=s.camp,stock=s.supplies;
   for(const id of active){const f=s.fronts[id];let n=f.men;const want=demand(s,id);
    if(camp>0&&stock>0&&n<want){const add=Math.min(camp,want-n,stock*500);n+=add;camp-=add;stock-=Math.ceil(add/500);}
    const supply=n>0&&risk({...s,fronts:{...s.fronts,[id]:{...f,men:n}}},id)>0&&stock>0;if(supply)stock--;
    ops.push(order(id,n,!f.coordinated&&n>0,supply));
   }
  }else if(mode==='supply'){
   let stock=s.supplies;ops=active.map(id=>{const f=s.fronts[id];const send=f.men>0&&risk(s,id)>0&&stock>0;if(send)stock--;return order(id,f.men,false,send);});
  }
  if(ops.length){commit(s,ops,'sim-'+(++count),s.revision);}
  endTurn(s);
 }
 return {saved:s.saved.length,full:ROUTES.filter(id=>s.fronts[id].status==='saved').length,rounds:s.turn-1,loss:s.losses,stock:s.supplies};
}
const N=2000,modes=['balanced','adaptive','clearFirst','reserve','supply','noCoord','concentrated','small','wrong'];const out={sampleSize:N,seedMethod:'LCG seeded with imul(index+1,2654435761) >>> 0; paired across policies',policies:{}};
for(const mode of modes){const rows=Array.from({length:N},(_,i)=>run(mode,Math.imul(i+1,2654435761)>>>0));out.policies[mode]={allPeople:rows.filter(x=>x.saved===4).length/N,allRoutes:rows.filter(x=>x.full===3).length/N,meanSaved:rows.reduce((a,x)=>a+x.saved,0)/N,meanRounds:rows.reduce((a,x)=>a+x.rounds,0)/N,meanLoss:rows.reduce((a,x)=>a+x.loss,0)/N,meanStock:rows.reduce((a,x)=>a+x.stock,0)/N,sample:run(mode,12345)};}
out.sensitivity={};for(const delta of [-10,10]){out.sensitivity[delta]={};for(const mode of ['balanced','adaptive','reserve','supply']){const rows=Array.from({length:N},(_,i)=>run(mode,Math.imul(i+1,2654435761)>>>0,delta));out.sensitivity[delta][mode]={allPeople:rows.filter(x=>x.saved===4).length/N,meanRounds:rows.reduce((a,x)=>a+x.rounds,0)/N,meanLoss:rows.reduce((a,x)=>a+x.loss,0)/N};}}
await mkdir(new URL('../checks/',import.meta.url),{recursive:true});await writeFile(new URL('../checks/turn-balance.json',import.meta.url),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
