import {modelConfig,parseJSON} from '../yiling-rescue/ai.mjs';
import {callModel} from '../../GameStarter/server/model-transport.mjs';
import {restore,IDS,NAMES,NODES,GOALS,info,confirm,clone} from './.build/engine.js';
export const PROMPT_VERSION='yiling-radio-command-v4-20261116';
const SYSTEM=`你是夷陵接应营的传令军侯。玩家通过自然语言指挥四支固定部队，不配粮、不调士气。只根据facts中已回报信息回答；不能看见未侦察的敌军或真实位置。text是唯一的新军令，过去对话不自动重发。询问是answer/query，明确行动才order。只回JSON。
格式：{kind:'answer'|'query'|'order'|'clarify',reply:string,topic:'status'|'position'|'story',units:['a'],commands:[{units:['a'],action:'rescue'|'move'|'attack'|'hold'|'retreat'|'rest',target:'camp'|'cross'|'rear'|'campfire'|'side'|'ridge'|'east'|'west',via:'normal'|'side'|'ridge',rush:boolean,slow:boolean,seconds:整数,quote:string}],unsupported:[]}。
甲队a700人、乙队b800人、丙队c600人、丁队d400人。玩家说派700人可选甲、派400选丁；人数不能任意拆分。没说队伍用selected；明确名字、人数、全队伍/剩余待命队，可据facts选择。一份军令可含多队多目标，最多4条，每队一次。quote必须来自当前text，引用完整对应分句。军令的参数要忠实，不擅自添加玩家未说的赶路、休整、绕行或撤退。
地点：傅肜/后阵rear，冯习张南/旧营campfire，沙摩柯/山林/东沟east，西沟west，隘口/岔口cross，东岭/高地ridge，南侧路side，接应营camp。
接应/把人带回来是rescue，抵达后自动接人回营。东沟接上后，默认继续西沟，可接上后另下撤回令，不支持未确认的任意条件脚本。支援某队/某地可rescue到对应地，若在交战中会协助作战，但不会凭空消敌；主动冲擊/进攻是attack，击退后自动恢复接应。接触敌军被压制时，普通move不能离开，应attack或retreat；rest不消敌。
正常行军rush=false，慢行/缓行军slow=true；赶路/急行军rush=true；明确恢复正常false；没提节奏也填false但后处理在未要求改节奏时沿用原节奏。休息rest默认45秒，之后自动恢复原任务。hold原地掩护。撤回/收队retreat回camp，携带已接上的人一起撤。只撤某些队不等于全线撤军。
绕南侧路campfire用via side，绕东岭侧击rear用via ridge。没提绕行normal。明确跟踪、放火、改造地形等未制作动作列unsupported，整令不执行。后勤已自动保障，配粮或加餐请求只解释不作为战场操作。
问“情况/位置/各队都报情况”返回query并列units，让部队回报；只依据前线回复更新位置，不凭空知道未接触敌军。“为什么不走/傅肜为什么留下”等剧情问题query topic=story。问规则/有哪些命令/建议怎么调兵/比较方案是answer，解释固定编成、已知地形、三路截止、行军和敌军接触的差别，不报隐藏数值与必胜打法。reply自然简短，不超过200字，不编造执行结果。`;
const aliases={a:/甲队|甲军|甲部/,b:/乙队|乙军|乙部/,c:/丙队|丙军|丙部/,d:/丁队|丁军|丁部/};
const explicit=(text)=>IDS.filter(id=>aliases[id].test(text));
function cnNumber(t){const words={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};const m=t.match(/[0-9]+|[一二两三四五六七八九十百千]+/);if(!m)return null;if(/^\d+$/.test(m[0]))return +m[0];let n=0,v=0;for(const k of m[0]){if(k in words)v=words[k];else{n+=(v||1)*({十:10,百:100,千:1000}[k]||1);v=0;}}return n+v;}
function grounded(raw,body,s){if(['answer','clarify'].includes(raw?.kind)&&/现在.*(哪|位置)|目前.*(哪|位置)|报.*位置|现在哪里|在哪儿/.test(body.text)&&!/建议|应该|怎么安排/.test(body.text)){raw={...raw,kind:'query',topic:'position',units:/各队|全军|所有队/.test(body.text)?IDS:explicit(body.text).length?explicit(body.text):[body.selected]};}
 if(!raw||!['answer','query','order','clarify'].includes(raw.kind))throw Error('请重新说明你要询问还是下令。');
 if(raw.unsupported?.length)return {kind:'clarify',reply:raw.unsupported.join('；'),commands:[]};
 if(raw.kind!=='order'){if(raw.kind==='query'&&(!Array.isArray(raw.units)||raw.units.some(id=>!IDS.includes(id))))throw Error('请选择可联络的部队。');}if(raw.kind!=='order')return {kind:raw.kind,reply:raw.reply||'请说明部队和要执行的事。',topic:raw.topic||'status',units:Array.isArray(raw.units)&&raw.units.length?raw.units:[body.selected],commands:[]};
 if(!Array.isArray(raw.commands)||!raw.commands.length)throw Error('请说明要调哪队、去哪里、做什么。');
 const used=new Set(),commands=[];
 for(const rawCmd of raw.commands){
 const c={...rawCmd};if(!Array.isArray(c.units)||!c.units.length||c.units.some(id=>!IDS.includes(id)||used.has(id)))throw Error('部队重复或无法辨认。');
 if(typeof c.quote!=='string'||!c.quote.trim()||!body.text.includes(c.quote))throw Error('请按本次原话核对军令。');
 const mentioned=explicit(body.text),quoted=explicit(c.quote);for(const id of c.units){
 if(s.units[id].men<=0)throw Error('这队已失联，不能接令。');
 if(mentioned.length&&!mentioned.includes(id))throw Error('请选择原话提到的部队。');
 if(quoted.length&&!quoted.includes(id))throw Error('这段军令的对象未说清。');used.add(id);}
 const amount=c.quote.match(/([0-9零一二两三四五六七八九十百千]+)\s*(?:人|名|兵)/)||c.quote.match(/(?:派|调)([0-9零一二两三四五六七八九十百千]+)/);
 const count=amount?cnNumber(amount[1]):null,initial=c.units.reduce((n,id)=>n+({a:700,b:800,c:600,d:400}[id]),0),reported=c.units.reduce((n,id)=>n+Math.ceil(s.units[id].reported.men),0);
 if(count!==null&&count!==initial&&count!==reported)throw Error('本版以整队调动，人数与当前队伍不符。请按甲、乙、丙、丁队下令。');
 if(!quoted.length&&!mentioned.length&&count===null&&c.units.some(id=>id!==body.selected)&&!/全军|全部队|所有队|各队|三队|剩余|待命/.test(c.quote))throw Error('请明确要调哪支队伍。');
 if(c.action==='hold'&&c.target!==s.units[c.units[0]].at&&!/原地|停下|停止|别走|不要移动/.test(c.quote))c.action='move';if(c.action==='rest'){c.target=s.units[c.units[0]].at;const m=c.quote.match(/([0-9一二两三四五六七八九十百]+)\s*(秒|分钟|分)/);c.seconds=m?cnNumber(m[1])*(m[2]==='秒'?1:60):45;}
 if(c.action==='retreat')c.target='camp';if(!c.via)c.via='normal';if(!['side','ridge','normal'].includes(c.via))throw Error('行军路线未辨认。');
 if(c.action==='attack'&&/别突击|不要进攻|不突击|先不进攻/.test(c.quote))throw Error('原话要求不突击，尚未传令。');if(c.rush&&!/赶|急行|加速|快行|快点|加紧/.test(c.quote))throw Error('急行军需明确下令。');
 if(!/赶|急行|急走|快行|慢|缓|正常|恢复/.test(c.quote)){delete c.rush;delete c.slow;}commands.push(c);
 }
 const copy=clone(s);confirm(copy,commands);return {kind:'order',reply:'请核对后传令。',commands};
}
export async function handle(body,signal,model){const s=restore(JSON.stringify(body?.state));if(!s||!IDS.includes(body.selected)||typeof body.text!=='string'||!body.text.trim()||body.text.length>1000)throw Error('请在当前军情下说明安排。');
 const facts={units:IDS.map(id=>({id,name:NAMES[id],initial:{a:700,b:800,c:600,d:400}[id],...s.units[id].reported,stamina:undefined,condition:s.units[id].reported.stamina>=70?'尚有余力':'疲惫',lastOrder:(s.units[id].task||s.units[id].resume)&&{action:(s.units[id].task||s.units[id].resume).action,target:(s.units[id].task||s.units[id].resume).target},at:s.units[id].reported.location||NODES[s.units[id].reported.at].name})),map:Object.entries(NODES).map(([id,n])=>({id,name:n.name})),knownEnemy:Object.entries(s.enemy).filter(([id,e])=>e.known).map(([id,e])=>({place:NODES[id].name,cleared:e.hp<=0})),elapsed:s.time,objectives:Object.entries(GOALS).map(([id,g])=>({name:g.name,deadline:g.deadline,returned:s.goals[id].safe,missed:s.goals[id].lost})),rules:'正常军令持续执行，到位、接敌、接齐、归营分别回报；自然语言输入时暂停思考。'};
 const config=model?null:await modelConfig();if(!model&&!config.apiKey)throw Error('模型尚未配置，原话已保留。');let correction='';
 for(let attempt=0;attempt<2;attempt++){try{const input=JSON.stringify({text:body.text,selected:body.selected,facts,correction});const r=await(model?model({system:SYSTEM,text:input},signal):callModel(config,{system:SYSTEM,text:input,temperature:.1},signal));return {...grounded(parseJSON(r.text),body,s),promptVersion:PROMPT_VERSION};}catch(e){if(signal?.aborted)throw e;correction=e.message;if(attempt)throw Error(e.message+' 原话保留，尚未执行。');}}
}
