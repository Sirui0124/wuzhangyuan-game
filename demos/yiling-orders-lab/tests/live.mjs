import {handle} from '../ai.mjs';import {fresh,confirm,step,pending} from '../.build/engine.js';import {mkdir,writeFile} from 'node:fs/promises';
const c=(route,count)=>({route,action:'rescue',count,countMode:'set',goal:'all',supplies:false,waitFor:'now'});
const existing=fresh();confirm(existing,[c('sha',500)],0,'派五百接沙摩柯');step(existing);
const mid=fresh();confirm(mid,[c('fu',500),c('feng',1000),c('sha',1000)],0,'三路接应');step(mid);step(mid);
const cases=[
 {name:'问时间不出兵',route:'fu',text:'五百和一千人接应傅肜，分别要多久？',check:r=>r.kind==='answer'&&r.commands.length===0&&/[34三四]/.test(r.reply)},
 {name:'一句话安排三路',route:'fu',text:'傅肜派五百人，冯习张南派一千人，沙摩柯派一千人，都接齐后回来。',check:r=>r.kind==='order'&&r.commands.length===3&&r.commands.map(c=>c.count).join(',')==='500,1000,1000'},
 {name:'缺人数先澄清',route:'fu',text:'帮我把傅肜接回来。',check:r=>r.kind==='clarify'&&r.commands.length===0},
 {name:'否定出兵只咨询',route:'fu',text:'别出兵，我只是想问派三百人够不够？',check:r=>r.kind!=='order'&&r.commands.length===0},
 {name:'口语增援按增量',state:existing,route:'sha',text:'再给沙摩柯添三百人，其他人继续接。',check:r=>r.kind==='order'&&r.commands[0].count===800},
 {name:'将领先走仍接部众',state:mid,route:'sha',text:'让沙摩柯先随首批走，西沟的人继续接齐，还是这些兵。',check:r=>r.kind==='order'&&r.commands[0].goal==='all'&&r.commands[0].count===1000},
 {name:'未支持战术不部分执行',route:'fu',text:'派五百人去接傅肜，再放火烧掉追兵。',check:r=>r.commands.length===0&&r.unsupported.length>0},
 {name:'送物资保持既有兵力',state:existing,route:'sha',text:'这一路送一份转运物资，就按原来的兵力继续接。',check:r=>r.kind==='order'&&r.commands[0].supplies&&r.commands[0].count===500}
];
const results=await Promise.all(cases.map(async c=>{const state=c.state||fresh(),before=JSON.stringify(state);try{const result=await handle({state,route:c.route,text:c.text},AbortSignal.timeout(45000));return {name:c.name,text:c.text,passed:!!c.check(result)&&JSON.stringify(state)===before,result};}catch(e){return {name:c.name,text:c.text,passed:false,error:e.message};}}));
await mkdir(new URL('../checks/',import.meta.url),{recursive:true});await writeFile(new URL('../checks/live.json',import.meta.url),JSON.stringify({date:'2026-11-15',results,note:'Real configured API, no execution and no player save read or changed.'},null,2));console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.passed))process.exitCode=1;
