import {handle} from '../ai.mjs';import {fresh,confirm,step,preview} from '../.build/engine.js';import fs from 'node:fs/promises';
const c=(route,count,extra={})=>({route,action:'rescue',count,countMode:count===null?'keep':'set',goal:'all',grain:0,relief:0,waitFor:'now',...extra});
const mid=fresh();confirm(mid,[c('fu',500),c('feng',800),c('sha',700)],0,'分兵');step(mid);
const reorg=structuredClone(mid);confirm(reorg,[c('feng',null,{action:'reorganize'})],reorg.revision,'先重整');
const cases=[
 {name:'Terra咨询原话',text:'傅肜现在情况如何？需要多少兵粮才能把人带回来？',route:'fu',check:r=>r.kind==='answer'&&/隘口|后阵/.test(r.reply)&&/起步|每|派/.test(r.reply)},
 {name:'Sol咨询原话',text:'先报傅肜现在的敌情、要接多少人，需要多少兵粮才能安全回来。',route:'fu',check:r=>r.kind==='answer'&&/后阵|隘口/.test(r.reply)},
 {name:'三路需求不编造待接人数',text:'先别出兵。请分别告诉我傅肜、冯习张南、沙摩柯三路各有多少人要接，路上有什么危险，需要多少接应兵和粮？',route:'fu',check:r=>r.kind==='answer'&&r.reply.includes('尚无确报')&&/清路|迁旗/.test(r.reply)},
 {name:'定向追问山林',text:'联络沙摩柯，请他报部众人数、两沟地形和追兵情况；这只是询问，暂不调兵。',route:'sha',check:r=>r.kind==='answer'&&/东沟.*西沟/.test(r.reply)&&/追兵/.test(r.reply)},
 {name:'总携粮含默认携粮',text:'派九百人，带一千五百斤粮，去接傅肜和他的部众，接到后一起撤回。',route:'fu',check:(r,p)=>r.kind==='order'&&p.cost===1500&&p.commands[0].grain===600},
 {name:'三路各200斤',state:mid,text:'三路各补给200斤口粮，继续接齐部众撤回。',route:'fu',check:(r,p)=>r.kind==='order'&&p.commands.length===3&&p.commands.every(c=>c.grain===200)},
 {name:'补粮原安排不变保留重整',state:reorg,text:'给冯习、张南的接应队再送六百斤口粮，原来的接应安排不变。',route:'feng',check:(r,p)=>r.kind==='order'&&p.commands[0].action==='reorganize'&&p.commands[0].grain===600},
 {name:'原有多派比较仍有效',state:mid,text:'如果多派三百，跟现在比能快多少？先别下令。',route:'feng',check:r=>r.kind==='answer'&&r.reply.includes('共1100人')&&r.reply.includes('共800人')},
 {name:'部分撤回原有功能',state:mid,text:'从他那儿抽回一半，留下的人继续接应。',route:'sha',check:(r,p)=>r.kind==='order'&&p.commands[0].count===350},
 {name:'微观分工告知自动安排',state:mid,text:'用现有八百人，不增兵；其中三百人分流，五百人护送，接齐冯习张南后回来。',route:'feng',check:r=>(r.kind==='order'&&r.notes?.length)||r.unsupported?.length>0},
];
const results=[];for(const item of cases){const state=item.state||fresh(),before=JSON.stringify(state);try{const r=await handle({state,route:item.route,text:item.text},AbortSignal.timeout(60000)),p=r.kind==='order'?preview(state,r.commands):null;results.push({name:item.name,text:item.text,passed:!!item.check(r,p)&&before===JSON.stringify(state),result:r});}catch(e){results.push({name:item.name,text:item.text,passed:false,error:e.message});}console.log(item.name,results.at(-1).passed?'PASS':'FAIL');}
await fs.writeFile(new URL('../checks/revision-live.json',import.meta.url),JSON.stringify({date:'2026-11-15',realAPI:true,results},null,2));if(results.some(r=>!r.passed))process.exitCode=1;
