import {GOALS,NAMES,NODES,type State} from './engine.js';

export const FRONTS = {
  sha: {name:'沙摩柯',place:'东沟、西沟',node:'east',keys:['east','west'],need:'先接东沟的人，再到西沟接出担架。',reason:'部众散在两沟。东沟找到了人，西沟的伤兵还得有人去抬。'},
  camp: {name:'冯习、张南',place:'旧营',node:'campfire',keys:['zhang','feng'],need:'先接张南的前队，再收冯习带的后队伤兵。',reason:'前后队尚未撤齐。张南带前队，冯习留下收最后一批伤兵，不能只接走前队就算完。'},
  fu: {name:'傅肜',place:'后阵',node:'rear',keys:['fu'],need:'接替断后，打通撤路，再把换防的人一同带回。',reason:'后阵仍要有人守退路。接替的人到了，也要等最后一队退过隘口，才能一起撤。'}
} as const;
export type Front = keyof typeof FRONTS;
export const FRONT_IDS=Object.keys(FRONTS) as Front[];
export const TOPICS=['status','position','needs','reason','timing','enemy','progress','numbers','unknown'] as const;
export type FrontTopic=typeof TOPICS[number];
export const isFront=(v:unknown):v is Front=>typeof v==='string'&&v in FRONTS;
const clock=(t:number)=>`${Math.floor(t/60)}分${t%60?`${t%60}秒`:''}`;

// Uses only mission information and events that have already produced reports.
// Enemy strength, live unit coordinates, work counters and hidden stamina stay out.
export function frontlineFacts(s:State,front:Front){
  const f=FRONTS[front],keys=[...f.keys];
  const progress=keys.map(key=>{const g=s.goals[key],name=GOALS[key].name;
    if(g.safe)return `${name}已归营。`;
    if(g.carrier)return `${name}已与${NAMES[g.carrier]}会合，尚未报归营。`;
    if(g.lost)return `${name}未能在窗口关闭前接上，目前已失去联络。`;
    return `${name}最后回报在${NODES[GOALS[key].node].name}，尚未接上。`;
  }).join('');
  const allSafe=keys.every(key=>s.goals[key].safe),disconnected=keys.every(key=>s.goals[key].lost);
  const pending=keys.filter(key=>!s.goals[key].safe&&!s.goals[key].carrier&&!s.goals[key].lost);
  const returning=keys.some(key=>!!s.goals[key].carrier&&!s.goals[key].safe);
  let needs=f.need as string,reason=f.reason as string;
  if(!pending.length&&returning){needs='已接上的人正在随接应队撤回，先护送他们归营。';reason='已经与接应队会合，正在撤离，还没有报到营门。';}
  else if(front==='camp'&&(s.goals.zhang.carrier||s.goals.zhang.safe)&&pending.includes('feng')){needs='前队已经接上，冯习带的后队伤兵还要接。';reason='张南的前队已接上，冯习仍在收后队，接应还没有结束。';}
  else if(front==='sha'&&(s.goals.east.carrier||s.goals.east.safe)&&pending.includes('west')){needs='东沟的人已经接上，西沟的担架还需要有人去接。';reason='沙摩柯已与接应队会合，西沟仍有伤兵没有接上。';}
  if(keys.some(key=>s.goals[key].lost)){needs=pending.length?'仍可接应的是'+pending.map(key=>GOALS[key].name).join('、')+'；失联的人目前无法承诺接回。':returning?'先护送已经接上的人归营，失联的人目前无法承诺接回。':'已接上的人已经归营，余下人员失联。';reason='本路有人失去联络。'+progress;}
  const e=front==='sha'?undefined:s.enemy[f.node as 'rear'|'campfire'];
  const enemy=e?.known?(e.hp>0?'接应队报告遭到射击，接应受阻。':'接应队已报告该处敌军退开。'):'尚无已确认的敌军位置和兵力报告，不能据此认定道路安全。';
  const deadline=Math.min(...keys.map(key=>s.goals[key].deadline));
  return {name:f.name,place:f.place,progress,allSafe,disconnected,enemy,
    needs:allSafe?'这一路已归营，不再需要派兵接应。':disconnected?'这一路已经失去联络，不能再承诺接应成功。':needs,
    reason:allSafe?'已经随接应队回到营中。':disconnected?'已经超过接应窗口，目前未能重新取得联络。':reason,
    timing:allSafe?'本路已归营。':s.time>deadline?'本路接应窗口已经关闭；已经接上的人仍需护送归营。':`需要在战场用时${clock(deadline)}前接上；接上后仍要护送回营。`,
    lastReports:s.logs.filter(l=>l.node===f.node||l.text.includes(f.name)||keys.some(key=>l.text.includes(GOALS[key].name))).slice(-4).map(l=>({time:l.time,speaker:l.speaker,text:l.text}))};
}
export function frontlineReply(s:State,front:Front,topic:FrontTopic){
  const f=frontlineFacts(s,front);
  if(topic==='reason')return f.reason+' '+f.progress;
  if(topic==='needs')return f.needs+' '+f.enemy;
  if(topic==='timing')return f.timing;
  if(topic==='enemy')return f.enemy;
  if(topic==='numbers')return '这一路尚未报留守部众和伤兵的确切人数，不能拿接应队的人数代替。'+f.needs;
  if(topic==='unknown')return '这件事目前没有确切回报。可以问本路位置、接应进展、退路或最需要的支援。';
  if(topic==='position'||topic==='progress')return f.progress;
  return f.progress+' '+f.needs+' '+f.enemy;
}
