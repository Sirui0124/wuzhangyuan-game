import {fresh} from '../.build/engine.js';
import {writeFile} from 'node:fs/promises';
const s=fresh(),results=[];
for(const [kind,text] of [['plan','甲队先去傅肜那边坚守40秒，再接人。乙队丙队去接黄权，同时派船。'],['ask','傅将军为什么还没有撤下来？']]){
 const started=Date.now();const r=await fetch('http://127.0.0.1:8946/api/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:s,text,route:'fu'}),signal:AbortSignal.timeout(65000)});const result=await r.json();results.push({kind,status:r.status,seconds:Math.round((Date.now()-started)/1000),result});console.log(JSON.stringify(results.at(-1)));if(!r.ok)process.exitCode=1;
}
await writeFile(new URL('../checks/live-ai-result.json',import.meta.url),JSON.stringify(results,null,2));
