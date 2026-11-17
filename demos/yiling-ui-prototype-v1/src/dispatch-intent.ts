export type Front='sha'|'camp'|'fu';
export type Unit='甲'|'乙'|'丙'|'丁';
export type Order={unit:Unit;action:'rescue'|'scout'|'relieve'|'suppress'|'verify'|'signal'|'hold'|'rest'|'retreat';target:Front|null;rush:boolean;via?:'side'|'normal';men?:number};
export type Address={unit:Unit|'auto';target:Front|'auto'};
type Context={address:Address;capacity:Record<Unit,number>;fuMode?:boolean};
const UNITS:Unit[]=['甲','乙','丙','丁'];
const NAMES:Record<Front,string>={sha:'沙摩柯',camp:'冯习·张南',fu:'傅肜'};
function chineseCount(text:string){let sum=0,n=0;for(const c of text){const digit='零一二三四五六七八九'.indexOf(c==='两'?'二':c==='〇'?'零':c);if(digit>=0)n=digit;else{sum+=(n||1)*({十:10,百:100,千:1000,万:10000} as Record<string,number>)[c];n=0;}}return sum+n;}

function normalize(text:string){
  return text.replace(/[１２３４]/g,c=>String('１２３４'.indexOf(c)+1))
    .replace(/(?:队伍\s*([1-4一二三四])|第\s*([1-4一二三四])\s*(?:支部队|支队伍|队)|([1-4])\s*队)/g,(_,a,b,c)=>{
      const n=a||b||c;return UNITS[/\d/.test(n)?Number(n)-1:'一二三四'.indexOf(n)]+'队';
    })
    .replace(/([甲乙丙丁]{2,4})(?:两|三|四|各)?队/g,(_,group:string)=>[...group].map(u=>u+'队').join('、'))
    .replace(/([零〇一二两三四五六七八九十百千万]+)\s*(?=人)/g,(_,n:string)=>{
      const tail=n.split(/[百千]/).at(-1)||'';
      if(/[百千]/.test(n)&&/^[一二两三四五六七八九]$/.test(tail))throw Error('人数请写完整，如“350人”或“三百五十人”。');
      return String(chineseCount(n));
    });
}

/** Resolve only the demo's established orders. Never guess a unit or silently override explicit selectors. */
export function resolveOrders(source:string,{address,capacity,fuMode=false}:Context):Order[]{
  const text=normalize(source.trim());
  if(/不要|别让|不许|取消|别去|粮|银两/.test(text))throw Error('本稿暂不演示否定军令或粮草配置。请直接说明要执行的任务；未发出任何军令。');
  if(/如果|假如|要是|等.+再/.test(text))throw Error('这是一道条件军令，请先改为当前要执行的明确任务。');
  if(/[?？]|怎么|如何|是否|能否|要不要|是不是/.test(text))throw Error('这句是在问询，请改为明确军令；向前线问话可切回人物标签。');
  // A new named unit begins another order; unlabelled fragments belong to the preceding one.
  const clauses:string[]=[];
  for(const part of text.split(/[，,。；;\n]+/).map(s=>s.trim()).filter(Boolean)){
    if(clauses.length&&!/[甲乙丙丁]队/.test(part))clauses[clauses.length-1]+=' '+part;
    else clauses.push(part);
  }
  if(!clauses.length){
    if(address.unit==='auto'||address.target==='auto')throw Error('先写下军令，或手选派遣队伍和接应对象。');
    clauses.push('接应');
  }
  const orders:Order[]=[];
  for(const clause of clauses){
    const namedUnits=UNITS.filter(u=>clause.includes(u+'队'));
    if(address.unit!=='auto'&&namedUnits.some(u=>u!==address.unit))throw Error(`手选的是${address.unit}队，文字中还有${namedUnits.filter(u=>u!==address.unit).join('、')}队。请统一内容，或将队伍改为“自动识别”。`);
    const units=namedUnits.length?namedUnits:address.unit==='auto'?[]:[address.unit];
    const targets:Front[]=[];
    if(/傅肜|傅将军|后阵/.test(clause))targets.push('fu');
    if(/冯习|张南|旧营/.test(clause))targets.push('camp');
    if(/沙摩柯|沙将军|东沟|西沟/.test(clause))targets.push('sha');
    // Generic wounded troops alone do not identify one of three fronts.
    if(targets.length>1)throw Error('同一道任务写了多个接应方向，请按队伍分句，或只选一个接应对象。');
    if(address.target!=='auto'&&targets.length&&targets[0]!==address.target)throw Error(`手选的是${NAMES[address.target]}，文字中写的是${NAMES[targets[0]]}。请统一内容，或将接应对象改为“自动识别”。`);
    let target=targets[0]||(address.target==='auto'?null:address.target);
    const specific:Order['action'][]=[];
    if(/探查|探明|侦察|探路|开辟.*(?:撤路|绕行)|打通.*(?:撤路|绕行)/.test(clause))specific.push('scout');
    if(/接替.*断后|换防|替.*断后/.test(clause))specific.push('relieve');
    if(/压制|压住.*追兵|牵制.*追兵/.test(clause))specific.push('suppress');
    if(/核实|核验|查证|确认.*(?:刘备|陛下)|探明.*(?:刘备|陛下)/.test(clause))specific.push('verify');
    if(/撤离信号|传.*信号|约定.*撤离时机/.test(clause))specific.push('signal');
    if(specific.length&&fuMode&&!target)target='fu';
    const rest=/休整|休息/.test(clause),hold=/待命|留营|留守|原地等/.test(clause),retreat=/撤回|回营|撤退/.test(clause);
    const rescue=(!specific.length&&/接应(?!营)|接回|救|支援|前往|去|赶到|绕行/.test(clause))||/护送|救出/.test(clause);
    if([rest,hold,retreat,rescue].filter(Boolean).length+specific.length>1)throw Error('同一句里有多个任务，请用逗号分开各队安排；尚未发出军令。');
    const paceOnly=/^(?:正常行军|急行军|快些|加快|快速|赶过去|赶路)$/.test(clause);
    const action:Order['action']|null=specific[0]||(rest?'rest':hold?'hold':retreat?'retreat':rescue||targets.length||(target&&paceOnly)?'rescue':null);
    if(!action)throw Error('这句还不能确定任务。可以写“甲队接应傅肜”“乙队原地休整”或“丙队撤回营中”。');
    if(!units.length)throw Error('要派遣哪支队伍？请写明甲乙丙丁队或队伍1至4，也可在下拉菜单手选。');
    const stationed=!['hold','rest','retreat'].includes(action);
    if(stationed&&!target)throw Error('要接应哪一路？请写傅肜、旧营或沙摩柯，也可手选接应对象。');
    if(specific.length&&target!=='fu')throw Error('这类接应岗位当前用于傅肜营救，请选择傅肜。');
    if(/急行/.test(clause)&&/正常行军/.test(clause))throw Error('同一队的行军方式有冲突，请保留一种。');
    const counts=[...clause.matchAll(/(-?\d+(?:\.\d+)?)\s*人/g)];
    if(counts.length>1)throw Error('每队只写一个出动人数，不同队伍请分句安排。');
    const men=counts.length?Number(counts[0][1]):undefined;
    for(const unit of units){
      if(orders.some(o=>o.unit===unit))throw Error(`${unit}队收到两种安排，请合并成一个明确任务。`);
      if(men!==undefined&&(!stationed||!Number.isInteger(men)||men<1||men>capacity[unit]))throw Error(`${unit}队出动人数须为1至${capacity[unit]}之间的整数，且只用于接应任务。`);
      orders.push({unit,action,target:stationed?target:null,rush:/急行|赶|加快|快速|快些/.test(clause),via:/绕行|南侧/.test(clause)?'side':'normal',...(men===undefined?{}:{men})});
    }
  }
  return orders;
}
