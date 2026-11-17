import fs from 'node:fs/promises';import {handle} from '../ai.mjs';import {fresh,confirm,step,preview} from '../.build/engine.js';
const c=(route,count,extra={})=>({route,action:'rescue',count,countMode:count===null?'keep':'set',goal:'all',grain:0,relief:0,waitFor:'now',...extra});
const mid=fresh();confirm(mid,[c('fu',500),c('feng',800),c('sha',700)],0,'开局');step(mid);const rest=structuredClone(mid);confirm(rest,[c('feng',null,{action:'rest'})],rest.revision,'休整');
const cases=[
 {name:'只报兵数自动配粮',text:'派五百人接傅肜，接齐后回来。',check:(r,p)=>r.kind==='order'&&p.commands[0].count===500&&p.commands[0].ration===100&&r.commands[0].grain===0},
 {name:'一句三路无粮数',text:'傅肜五百，旧营八百，沙摩柯七百，都接齐回来，营中留五百人。',check:(r,p)=>r.kind==='order'&&p.commands.length===3&&p.recommended.normal.totalUse===3750},
 {name:'多给些无需斤数',state:mid,route:'feng',text:'旧营这一路口粮多给些，原任务不变。',check:(r,p)=>r.kind==='order'&&p.commands[0].ration===120&&p.commands[0].count===800},
 {name:'少给些无需斤数',state:mid,route:'sha',text:'沙摩柯那边少给点口粮，先省着用，别改人数。',check:(r,p)=>r.kind==='order'&&p.commands[0].ration===80&&p.commands[0].count===700},
 {name:'明确成数',state:mid,route:'fu',text:'傅肜的口粮加三成，继续原任务。',check:(r,p)=>r.kind==='order'&&p.commands[0].ration===130},
 {name:'加紧赶路',state:mid,route:'sha',text:'让沙摩柯加紧赶路，不多派人。',check:(r,p)=>r.kind==='order'&&p.commands[0].pace==='rush'&&p.commands[0].count===700},
 {name:'休整后自动继续',state:mid,route:'feng',text:'旧营现队休整一时段，下轮再自动继续接应。',check:(r,p)=>r.kind==='order'&&p.commands[0].action==='rest'},
 {name:'同句休整与优待',state:mid,route:'feng',text:'旧营先休整一下，粮多给两成，之后继续接齐。',check:(r,p)=>r.kind==='order'&&p.commands[0].action==='rest'&&p.commands[0].ration===120},
 {name:'休整之后另改配粮保任务',state:rest,route:'feng',text:'口粮多给些，刚才安排不变。',check:(r,p)=>r.kind==='order'&&p.commands[0].action==='rest'&&p.commands[0].ration===120},
 {name:'问代价不执行',state:mid,route:'feng',text:'多给口粮、少给一点、赶路或休整分别有什么代价？先别执行。',check:r=>r.kind==='answer'&&r.reply.includes('疲劳')&&r.reply.includes('士气')&&!r.commands.length},
 {name:'恢复正常不误判成赶路',state:mid,route:'sha',text:'沙摩柯别赶路了，恢复正常，口粮按建议给。',check:(r,p)=>r.kind==='order'&&p.commands[0].pace==='normal'&&p.commands[0].ration===100},
 {name:'建议有用且不出兵',text:'三路怎么分兵合适，粮自动给多少？先别出兵。',check:r=>r.kind==='answer'&&r.reply.includes('自动')&&r.reply.includes('3750')},
 {name:'部分撤回保留余队',state:mid,route:'sha',text:'从他那儿抽回一半，其他人继续接应。',check:(r,p)=>r.kind==='order'&&p.commands[0].count===350},
 {name:'不支持的火攻不夹带执行',text:'派500人接傅肜，顺便火攻追兵。',check:r=>r.unsupported.length&&!r.commands.length}
];const results=[];
for(const item of cases){const state=item.state||fresh(),before=JSON.stringify(state);try{const result=await handle({state,route:item.route||'fu',text:item.text},AbortSignal.timeout(60000)),p=result.kind==='order'?preview(state,result.commands):null;results.push({name:item.name,text:item.text,passed:!!item.check(result,p)&&before===JSON.stringify(state),result});}catch(e){results.push({name:item.name,text:item.text,passed:false,error:e.message});}console.log(item.name,results.at(-1).passed?'PASS':'FAIL');}
await fs.writeFile(new URL('../checks/live.json',import.meta.url),JSON.stringify({date:'2026-11-15',realAPI:true,results},null,2));if(results.some(r=>!r.passed))process.exitCode=1;
