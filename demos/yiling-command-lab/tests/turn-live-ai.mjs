import {fresh,commit} from '../.build/turn-engine.js';import {writeFile} from 'node:fs/promises';
const state=fresh(123);const rows=[];
for(const [kind,route,text,troops] of [['ask','feng','为什么不能把人全派去强攻？',500],['plan','fu','派三百人先接应傅肜，让他的旧部回身掩护。',500],['plan','feng','留一千人清路，送一份绳索和担架。',1000],['plan','sha','派五百人接应，另外放火烧山。',500]]){
 const res=await fetch('http://127.0.0.1:8946/api/turn-'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,route,text,troops}),signal:AbortSignal.timeout(65000)});const data=await res.json();rows.push({kind,route,text,status:res.status,data});await writeFile(new URL('../checks/turn-live-ai.json',import.meta.url),JSON.stringify(rows,null,2));if(!res.ok)throw Error(data.error);
 if(route==='fu'&&kind==='plan'){if(data.draft.operations[0]?.troops!==300||!data.draft.operations[0]?.coordinate)throw Error('300人或原部配合未正确识别');commit(state,data.draft.operations,data.draft.id,data.draft.revision);}
 if(route==='feng'&&kind==='plan'&&(data.draft.operations[0]?.coordinate!==false||data.draft.operations[0]?.objective!=='clear'||data.draft.unsupported.length))throw Error('清路被改写成未授权的协同或迁旗');
 if(route==='sha'&&!data.draft.unsupported.length)throw Error('unsupported fire was not blocked');
}
await writeFile(new URL('../checks/turn-live-ai.json',import.meta.url),JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));
