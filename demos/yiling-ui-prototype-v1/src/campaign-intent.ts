export type Front='sha'|'camp'|'fu'|'ma'|'cheng'|'du'|'wang'|'huang';
export type Action='rescue'|'relieve'|'suppress'|'scout'|'verify'|'signal'|'retreat'|'hold'|'rest';
export type Order={unit:string;action:Action;target:Front|null;men?:number;unitName?:string;via:'normal'|'side'};
export type Address={unit:string;target:Front|'auto'};
export const names:Record<Front,string>={sha:'沙摩柯',camp:'冯习 · 张南',fu:'傅肜',ma:'马良',cheng:'程畿',du:'杜路 · 刘宁',wang:'王甫',huang:'黄权'};
export const tasks:Record<Action,string>={rescue:'接应护送',relieve:'接替断后',suppress:'压制追兵',scout:'探查撤路',verify:'核实刘备消息',signal:'传撤离信号',retreat:'撤回接应营',hold:'原地待命',rest:'原地休整'};
export function batchName(front:Front,stage:{id:string;name:string},verified?:boolean|null){
 return front==='sha'&&stage.id==='clans'&&verified===false?'失散的部众':stage.name;
}
export function numeral(text:string):number{
 if(/^\d+$/.test(text))return Number(text);
 const digits:Record<string,number>={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
 let total=0,current=0;for(const c of text){if(c in digits)current=digits[c];else if('十百千'.includes(c)){total+=(current||1)*({'十':10,'百':100,'千':1000}[c]!);current=0;}else throw Error('人数未能识别。');}return total+current;
}
export function resolveCampaignOrders(text:string,address:Address,units:Record<string,{men:number;name?:string}>):Order[]{
 if(!text.trim())throw Error('请写明人数和任务，例如：派400人接应沙摩柯。');
 if(/[?？]|能否|是否|可否|要不要|不(?:要|必|派|撤|接)|别|如果|假如|等到|若|或者|还是/.test(text))throw Error('这句包含问询、否定或条件，请写明要执行的军令，再点“预览军令”。');
 if(/补员|补充兵|增援第|合并|拆分|分兵|粮|兵器|弓箭|骑兵|步兵|骑马|一半|全部兵/.test(text))throw Error('此处支持整队改令或从营中百人编队；补员、拆并与兵种配置尚未开放。');
 // Semicolons delimit full orders; commas only start a new order when a new count/unit follows.
 const clauses=text.replace(/[。\n；;]/g,';').replace(/[,，]\s*(?=(?:再|另)?(?:派|遣|拨|出动)?\s*[\d一二两三四五六七八九十百千]+\s*(?:人|名|兵)|第?[\d一二两三四五六七八九十]+(?:队|支)|队伍|甲队)/g,';').split(';').map(x=>x.trim()).filter(Boolean);
 if(!clauses.length)throw Error('请写明人数和任务，例如：派400人接应沙摩柯。');
 if(clauses.length>5)throw Error('一批最多安排5支队伍。');
 return clauses.map((clause,index)=>{
  try{return parseClause(clause,address,units);}
  catch(error){throw Error((clauses.length>1?'第'+(index+1)+'道军令「'+clause+'」：':'')+(error as Error).message);}
 });
}
function parseClause(c:string,address:Address,units:Record<string,{men:number;name?:string}>):Order{
  const matches=[...c.matchAll(/(?:第\s*([\d一二两三四五六七八九十百]+)\s*(?:支)?队|队伍?\s*([\d一二两三四五六七八九十百]+)|([\d一二两三四五六七八九十百]+)队)/g)];
  const named=/甲队/.test(c)?Object.entries(units).find(([,u])=>u.name==='甲队')?.[0]:undefined;if(/甲队/.test(c)&&!named)throw Error('当前没有甲队；旧局可按原队号调度，新开营救使用甲队500人配置。');
  // A count after 队伍 (队伍100人) describes headcount, not unit 100.
  const unitMatches=matches.filter(m=>!m[2]||!/^\s*(?:人|名|兵)/.test(c.slice(m.index!+m[0].length)));
  const newUnit=/(?:新增|新建|新编|新组建|组建)(?:一支|一队)?(?:队伍|队)?/.test(c);
  const ids=[...new Set([...unitMatches.map(m=>String(numeral(m[1]||m[2]||m[3]))),...(named?[named]:[]),...(newUnit?['new']:[])])];if(ids.length>1)throw Error('每句话请只安排一队，多个队伍用分号分开。');
  let unit=ids[0]||address.unit;if(unit==='auto')unit='new';
  if(ids.length&&address.unit!=='auto'&&address.unit!==unit)throw Error('队伍不一致：手选的是'+(address.unit==='new'?'新编队':units[address.unit]?.name||'第'+address.unit+'队')+'，文字写的是'+(unit==='new'?'新编队':units[unit]?.name||'第'+unit+'队')+'。可将派遣队伍改为“自动识别”。');
  if(unit!=='new'&&!units[unit])throw Error(`第${unit}队当前不在军情中。`);
  const counts=[...c.matchAll(/([\d一二两三四五六七八九十百千]+)\s*(?:人|名|兵)/g)];
  if(counts.length>1)throw Error('本句有多个兵力数，请分开写明。');
  const men=counts.length?numeral(counts[0][1]):undefined;
  if(unit==='new'&&(!men||men%100))throw Error('新编队请写明100的整数倍人数，例如400人。');
  if(unit!=='new'&&men!==undefined&&men!==units[unit].men)throw Error('现有队伍按当前实兵整队调遣；新派兵请选择“新编队”。');
  const found:Front[]=[];if(/沙摩柯|沙摩|东沟|西沟/.test(c))found.push('sha');if(/冯习|冯習|张南|張南|旧营/.test(c))found.push('camp');if(/傅肜|傅彤|傅将军|后阵/.test(c))found.push('fu');if(/马良|馬良/.test(c))found.push('ma');if(/程畿/.test(c))found.push('cheng');if(/杜路|刘宁|劉寧/.test(c))found.push('du');if(/王甫/.test(c))found.push('wang');if(/黄权|黃權/.test(c))found.push('huang');
  if(found.length>1)throw Error('本句有多个方向，请分别安排队伍。');
  if(found[0]&&address.target!=='auto'&&found[0]!==address.target)throw Error('手选对象与文字不一致，请修改一处。');
  const explicit=found[0]||(address.target==='auto'?null:address.target);
  // A person's destination is not an instruction for the escort itself to return.
  const mission=c.replace(/(?:带|护送|接应|接回)((?:(?!然后|随后|并|再|同时|召回)[^，。；;]){0,15}?)(?:撤回营中|撤回|回营)/g,'护送$1')
    .replace(/(?:传信|送信|带信)[，、 ]*(?=核实|查明|查证)/g,'')
    .replace(/接应(?:这一路|前线)?[，、 ]*(?=接替断后|掩护|断后)/g,'');
  const actions:Action[]=[];
  if(/撤回|回营|召回|取消/.test(mission))actions.push('retreat');
  if(/休整|休息/.test(mission))actions.push('rest');
  if(/待命|驻守/.test(mission))actions.push('hold');
  const escortFindsParty=explicit&&['sha','ma','wang'].includes(explicit)
    &&/接应|接回|护送|救援|营救/.test(mission)
    &&!/先.{0,12}(?:再|然后)|侦察|探路|核实/.test(mission);
  const searching=!escortFindsParty&&!!explicit&&explicit!=='fu'&&/搜索|搜寻|寻找|查找|核实.*(?:部众|去向|位置|退路)|联络两岸/.test(mission);
  if(!searching&&/核实|查明.*(?:刘备|陛下)|查证/.test(mission))actions.push('verify');
  if(/信号|传信|传撤离/.test(mission))actions.push('signal');
  if(searching||/探路|侦察|探查|探明/.test(mission))actions.push('scout');
  if(/压制|攻打|牵制敌/.test(mission))actions.push('suppress');
  if(/断后|掩护|换防/.test(mission))actions.push('relieve');
  if(/接应|护送|接回|救援|营救|渡运|接渡|派船/.test(mission.replace(/接应营/g,'')))actions.push('rescue');
  if(actions.length!==1)throw Error(actions.length?'同时识别到“'+actions.map(a=>tasks[a]).join('”和“')+'”。一队一次只领一项，请分别写给各队。':'请说明接应、断后、探路、核实消息或撤回等任务。');
  const action=actions[0];let target=explicit;
  if(['verify','signal'].includes(action)){if(target&&target!=='fu')throw Error('核实刘备消息和撤离信号用于傅肜一路。');target='fu';}
  if(!target&&!['retreat','rest','hold'].includes(action))throw Error('请写明要接应的人物，也可用下拉菜单选择已联络的路线。');
  return {unit,unitName:unit!=='new'?units[unit].name:undefined,action,target,...(men!==undefined?{men}:unit!=='new'?{men:units[unit].men}:{}),via:/南侧|绕行|小路/.test(c)?'side':'normal'};
}
export function describe(o:Order){return `${o.unit==='new'?'新编队':o.unitName||'第'+o.unit+'队'}${o.men?' · '+o.men+'人':''} · ${tasks[o.action]}${o.target?' → '+names[o.target]:''}${o.via==='side'?' · 南侧路':''}`;}
