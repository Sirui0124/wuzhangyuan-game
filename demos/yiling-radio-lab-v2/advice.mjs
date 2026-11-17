import {IDS,META,budget,preview,stage,conflictText} from './.build/engine.js';
import {display,status} from './.build/presentation.js';
const NUM='[0-9]+|[零〇一二两三四五六七八九十百千万]+';
export function quotedAmount(text,unit,parse){const m=String(text).match(new RegExp(`(${NUM})\\s*${unit}`));return m?parse(m[1]):null;}
export function wantsAdvice(text){return /需要多少|多少兵粮|怎么分|如何分|建议|推荐|有什么难|有什么危|什么危险|敌情|路险|部众人数|多少人要接|要接多少|地形|追兵情况/.test(text);}
export function grainKind(text,quote){const at=text.indexOf(quote),before=at<0?'':text.slice(Math.max(0,at-24),at).split(/[，。；,;\n]/).at(-1);const phrase=(before||'')+quote;return /带|携|总共|一共|共计|合计/.test(phrase)&&!/(?:另|再|补|追加)/.test(phrase)?'total':'add';}
export function advice(s,route,text){
 const w=s.world,b=budget(s),all=/三路|各路|分别|分配|怎么分|如何分/.test(text),ids=all?IDS:[route];
 const funds=`营中尚未出发${w.camp}人、${w.stock}斤，已预留${b.people}人、${b.grain}斤；现在还能调${w.camp-b.people}人、${w.stock-b.grain}斤。`;
 const fronts=ids.map(id=>{const f=w.fronts[id];return `${META[id].name}：${META[id].brief}第${META[id].deadline}时段末关闭。${f.men?`现有${f.men}人，粮${f.food}斤，每时段需${Math.ceil(f.men/2)}斤。`:''}${s.queued[id]?`待执行${s.queued[id].count}人，尚未出发。`:''}`;}).join('\n');
 let plan='';
 if(IDS.every(id=>!s.missions[id]&&!s.queued[id])){
  const proposed=IDS.map((id,i)=>({route:id,action:'rescue',count:[500,800,700][i],countMode:'set',goal:'all',grain:0,relief:0,waitFor:'now'}));
  try{const p=preview(s,proposed);plan=`可先以傅肜500、旧营800、山林700人起步，新兵自带粮共${p.cost}斤，留${w.camp-p.newTroops}人应急；这些口粮只够2时段，后续仍需补给。更多兵能加快工作，也更耗粮。这是可调整的起步方案，不保证接齐，我没有替你下令。`;}catch{}
 }else if(s.conflict&&!s.conflict.resolved){plan=display(conflictText(s));}
 else{plan='新兵每人自带1斤，在外每人每时段吃半斤。留预备兵可及时增援；全派出后要等归营或抽回，也可用粮与重整时间应对。';}
 const unknown=/多少人要接|要接多少|部众人数/.test(text)?'待接部众总人数尚无确报；按当前已知批次接应，不编造人数。':'';
 return [funds,unknown,fronts,plan].filter(Boolean).join('\n');
}
