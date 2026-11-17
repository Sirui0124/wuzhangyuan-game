import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,restore,tick as rawTick,deploy,ask,tactic,recall,sendBoat,IDS,rates} from '../.build/engine.js';
import {chooseStory} from '../.build/story.js';
function tick(s,n){for(let i=0;i<n;i++){if(s.story.pending)chooseStory(s,{fu:'carry',huang:'batches',sha:'search'}[s.story.pending]);rawTick(s,1);}}

function strategy(mode){const s=fresh();s.started=true;for(const id of IDS)tactic(s,id);sendBoat(s);
 if(mode==='hold-first'){deploy(s,[0],'fu','hold','safe');deploy(s,[1,2],'huang','rescue','direct');deploy(s,[3,4],'sha','rescue','safe');}
 else if(mode==='rush'){deploy(s,[0,1,2,3,4],'fu','rescue','direct');}
 else{deploy(s,[0,1],'fu','rescue','direct');deploy(s,[2],'huang','rescue','direct');deploy(s,[3,4],'sha','rescue','direct');}
 while(!s.ended){if(mode!=='static'){const free=s.units.filter(u=>u.state==='camp'),target=IDS.find(id=>s.routes[id].status==='active');if(target&&free.length)deploy(s,free.map(u=>u.id),target,'rescue','direct');if(mode==='hold-first'&&s.time===221)deploy(s,[0],'fu','rescue','safe');}tick(s,1);}
 return s;
}
test('未开始、问讯与传令不会推进战局，重复问讯不刷收益',()=>{const s=fresh();tick(s,80);const before=s.routes.fu.health;ask(s,'fu',0);ask(s,'fu',0);tactic(s,'fu');assert.equal(s.time,0);assert.equal(s.routes.fu.health,before);assert.equal(s.routes.fu.progress,0);assert.deepEqual(s.routes.fu.asked,[0]);});
test('坚守保防线而不推进接应，改令后才推进',()=>{const s=fresh();s.started=true;deploy(s,[0,1],'fu','hold','direct');tick(s,80);assert.equal(s.routes.fu.progress,0);assert.ok(rates(s,'fu').health<=0);deploy(s,[0,1],'fu','rescue','direct');tick(s,10);assert.ok(s.routes.fu.progress>0);});
test('佯攻调动唯一援队，并提前20秒预告',()=>{const s=fresh();s.started=true;deploy(s,[3],'sha','feint','direct');tick(s,65);assert.equal(s.reserve,'fu');assert.equal(s.nextReserve,'sha');tick(s,19);assert.equal(s.reserve,'fu');tick(s,1);assert.equal(s.reserve,'sha');assert.equal(s.nextReserve,null);});
test('跨路不能瞬移，召回行军队按已走路程返回',()=>{const s=fresh();s.started=true;deploy(s,[1],'fu','rescue','direct');tick(s,10);assert.match(deploy(s,[1],'sha','rescue','direct'),/跨路/);recall(s,1);assert.equal(s.units[1].state,'return');assert.ok(s.units[1].remaining<=11);tick(s,12);assert.equal(s.units[1].state,'camp');});
test('绕行损失较低，但到达更晚',()=>{const runs=['direct','safe'].map(a=>{const s=fresh();s.started=true;deploy(s,[1],'fu','hold',a);const eta=s.units[1].remaining;tick(s,150);return {eta,loss:s.units[1].loss};});assert.ok(runs[1].eta>runs[0].eta);assert.ok(runs[1].loss<runs[0].loss);});
test('黄权集结完成也不会无船自动获救',()=>{const s=fresh();s.started=true;deploy(s,[0,1,2],'huang','rescue','direct');tick(s,230);assert.equal(s.routes.huang.progress,100);assert.equal(s.routes.huang.status,'active');sendBoat(s);tick(s,100);assert.equal(s.routes.huang.status,'saved');});
test('存档恢复保留军令、行军和船运；损坏版本拒绝',()=>{const s=fresh();s.started=true;deploy(s,[0],'huang','hold','safe');sendBoat(s);tick(s,12);assert.deepEqual(restore(JSON.stringify(s)),s);assert.equal(restore('{bad'),null);assert.equal(restore(JSON.stringify({...s,version:999})),null);});
test('无干预会真实失利，结束后不再推进',()=>{const s=fresh();s.started=true;tick(s,480);assert.ok(IDS.every(id=>s.routes[id].status==='lost'));const end=s.time;tick(s,50);assert.equal(s.time,end);});
test('至少两种主动分兵方案全救，常速战局落在5–10分钟',()=>{for(const mode of ['hold-first','spread']){const s=strategy(mode);assert.ok(IDS.every(id=>s.routes[id].status==='saved'),JSON.stringify({mode,time:s.time,routes:s.routes}));assert.ok(s.time>=300&&s.time<=600);}});
test('堆兵逐路清扫与不再调整，结果劣于主动转调',()=>{const rush=strategy('rush'),staticRun=strategy('static'),good=strategy('spread');assert.ok(IDS.filter(id=>rush.routes[id].status==='saved').length<3);assert.ok(IDS.filter(id=>staticRun.routes[id].status==='saved').length<3);assert.equal(IDS.filter(id=>good.routes[id].status==='saved').length,3);});
test('归营只恢复疲劳，不凭空恢复死伤',()=>{const s=fresh();s.started=true;s.units[0].strength=350;s.units[0].fatigue=60;tick(s,30);assert.equal(s.units[0].strength,350);assert.ok(s.units[0].fatigue<60);});
test('问讯不是通关锁，没有问讯也可完成接应',()=>{const s=fresh();s.started=true;deploy(s,[0,1,2,3,4],'fu','rescue','direct');tick(s,200);assert.equal(s.routes.fu.status,'saved');assert.equal(s.routes.fu.asked.length,0);});

for(const mode of ['hold-first','spread','rush','static']){const s=strategy(mode);console.log(JSON.stringify({strategy:mode,seconds:s.time,saved:IDS.filter(id=>s.routes[id].status==='saved').length,loss:Math.round(s.units.reduce((n,u)=>n+u.loss,0)),health:IDS.map(id=>Math.round(s.routes[id].health))}));}
