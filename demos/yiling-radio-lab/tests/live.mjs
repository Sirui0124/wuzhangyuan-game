import {handle} from '../ai.mjs';import {fresh,confirm,step} from '../.build/engine.js';import {writeFile} from 'node:fs/promises';
const c=(route,count)=>({route,action:'rescue',count,countMode:'set',goal:'all',grain:0,relief:0,waitFor:'now'});
const mid=fresh();confirm(mid,[c('fu',500),c('feng',800),c('sha',700)],0,'分兵');step(mid);
const cases=[
 {name:'全部剩余预备兵',state:mid,route:'feng',text:'把剩下的预备兵全派给旧营，接齐后回来。',check:r=>r.kind==='order'&&r.commands[0].count===1300},
 {name:'口语撤一半',state:mid,route:'sha',text:'从他那儿抽回一半，留下的人继续接应。',check:r=>r.kind==='order'&&r.commands[0].count===350},
 {name:'新增人数比较',state:mid,route:'feng',text:'如果多派三百，跟现在比能快多少？先别下令。',check:r=>r.kind==='answer'&&r.reply.includes('共1100人')&&r.reply.includes('共800人')},
 {name:'咨询不出兵',route:'fu',text:'五百和一千人接应傅肜，分别要多久、需要多少斤粮？',check:r=>r.kind==='answer'&&!r.commands.length},
 {name:'一句话三路留预备',route:'fu',text:'傅肜五百人，冯习张南八百人，沙摩柯七百人，都接齐后回来，剩下五百人在营中待命。',check:r=>r.kind==='order'&&r.commands.length===3&&r.commands.map(c=>c.count).join(',')==='500,800,700'},
 {name:'缺人数澄清',route:'fu',text:'接应傅肜回来。',check:r=>r.kind==='clarify'},
 {name:'斤不是人',state:mid,route:'feng',text:'给旧营的接应队补八百斤口粮，仍按原令接人。',check:r=>r.kind==='order'&&r.commands[0].grain===800&&r.commands[0].count===800&&!r.commands[0].relief},
 {name:'散兵救济',state:mid,route:'feng',text:'给新增散兵发四百斤粮，接应队仍按原令继续。',check:r=>r.kind==='order'&&r.commands[0].relief===400&&!r.commands[0].grain&&r.commands[0].count===800},
 {name:'预备增援',state:mid,route:'feng',text:'再给旧营添四百人，其余任务照旧。',check:r=>r.kind==='order'&&r.commands[0].count===1200&&!r.commands[0].grain},
 {name:'重整自然说法',state:mid,route:'feng',text:'先让现有的人安置这批散兵，安置好再接后队，不增兵。',check:r=>r.kind==='order'&&r.commands[0].action==='reorganize'&&r.commands[0].count===800},
 {name:'补粮缺斤数澄清',state:mid,route:'sha',text:'给接应队补点粮。',check:r=>r.kind==='clarify'&&!r.commands.length},
 {name:'询问不解除冲突',state:mid,route:'feng',text:'不增援而照旧继续，会耽误多久？',check:r=>r.kind==='answer'&&!r.commands.length},
 {name:'继续接受代价',state:mid,route:'feng',text:'仍照原令继续接人，不增援也不补粮。',check:r=>r.kind==='order'&&r.commands[0].action==='continue'&&!r.commands[0].grain&&!r.commands[0].relief},
 {name:'抽回部分',state:mid,route:'sha',text:'抽回两百人，剩下的继续接人。',check:r=>r.kind==='order'&&r.commands[0].count===500},
 {name:'未支持不部分执行',route:'fu',text:'派五百人接傅肜，放火烧掉追兵。',check:r=>r.unsupported.length>0&&!r.commands.length}
];
const results=[];for(let i=0;i<cases.length;i+=1){results.push(...await Promise.all(cases.slice(i,i+1).map(async c=>{const state=c.state||fresh(),before=JSON.stringify(state);try{const result=await handle({state,route:c.route,text:c.text},AbortSignal.timeout(60000));return {name:c.name,text:c.text,passed:!!c.check(result)&&JSON.stringify(state)===before,result};}catch(e){return {name:c.name,text:c.text,passed:false,error:e.message};}})));}
await writeFile(new URL('../checks/live.json',import.meta.url),JSON.stringify({date:'2026-11-15',results,note:'Real configured API, isolated data; not user approval.'},null,2));console.log(JSON.stringify(results.map(({result,...r})=>({...r,kind:result?.kind,reply:result?.reply,commands:result?.commands})),null,2));if(results.some(r=>!r.passed))process.exitCode=1;
