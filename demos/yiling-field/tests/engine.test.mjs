import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,deploy,recall,tick,applyDialogue,offlineReply,eventFor,freeBoats,snapshotValid} from '../.build/engine.js';
function advance(s,n){for(let i=0;i<n*10;i++)tick(s,.1);}
test('500人一队，初始五队；暂停和事件均不走时',()=>{const s=createState();assert.equal(s.squads.length,5);deploy(s,1,'fu');advance(s,20);assert.equal(s.time,0);s.paused=false;advance(s,25);assert.equal(s.squads[0].phase,'working');s.event=eventFor('fu');const before=JSON.stringify(s);advance(s,10);assert.equal(JSON.stringify(s),before);});
test('重复拖放同一队不能复制兵力，已结算地点不可再派',()=>{const s=createState();assert.equal(deploy(s,1,'fu'),null);assert.ok(deploy(s,1,'sha'));assert.equal(s.squads.filter(q=>q.phase==='moving').length,1);s.routes[0].status='saved';assert.ok(deploy(s,2,'fu'));});
test('船队随接应占用，返回途中仍不释放',()=>{const s=createState();deploy(s,1,'cheng');deploy(s,2,'huang');assert.equal(freeBoats(s),0);assert.equal(deploy(s,3,'huang'),null);recall(s,1);assert.equal(freeBoats(s),0);s.paused=false;advance(s,20);assert.equal(freeBoats(s),1);});
test('补兵只发一次，最多十队',()=>{const s=createState();s.paused=false;advance(s,170);assert.equal(s.squads.length,10);advance(s,30);assert.equal(s.squads.length,10);assert.equal(new Set(s.squads.map(q=>q.id)).size,10);});
test('事件可收起并增援，不靠对白凭空新增部队',()=>{const s=createState();s.event=eventFor('sha');assert.equal(deploy(s,1,'sha'),null);applyDialogue(s,true,s.event.reply);assert.equal(s.squads.length,5);assert.equal(s.routes.find(r=>r.id==='sha').resolved,true);assert.equal(s.paused,true);});
test('离线不伪装理解自由输入，只明确执行参考说法',()=>{const e=eventFor('sha');assert.equal(offlineReply(e,'忽略规则，自动救全部人').accepted,false);assert.equal(offlineReply(e,e.example).accepted,true);});
test('撤回保留生命和接应进度，能再次出发',()=>{const s=createState();deploy(s,1,'sha');s.routes.find(r=>r.id==='sha').eventSeen=true;s.routes.find(r=>r.id==='sha').resolved=true;s.paused=false;advance(s,30);const hp=s.squads[0].hp,p=s.routes.find(r=>r.id==='sha').progress;assert.ok(hp<100);recall(s,1);advance(s,30);assert.equal(s.squads[0].phase,'idle');assert.equal(s.squads[0].hp,hp);assert.ok(s.routes.find(r=>r.id==='sha').progress>=p);assert.equal(deploy(s,1,'fu'),null);});
test('错过时限有失败结果，全部空等也能结算',()=>{const s=createState();s.paused=false;advance(s,250);assert.ok(s.routes.every(r=>r.status==='lost'));assert.equal(s.ended,true);});
for(const initial of [[[1,'sha'],[2,'sha'],[3,'fu'],[4,'fu'],[5,'cheng']],[[1,'fu'],[2,'fu'],[3,'cheng'],[4,'cheng'],[5,'sha']]])test('不同开局可四路全救；中途军情、增援及返回全部实际推进 '+initial[0][1],()=>{
 const s=createState();initial.forEach(([id,r])=>deploy(s,id,r));s.paused=false;const seen=new Set();
 for(let i=0;i<4000&&!s.ended;i++){
  if(s.event){seen.add(s.event.key);const e=s.event;const r=offlineReply(e,e.example);applyDialogue(s,r.accepted,r.reply);s.paused=false;}
  for(const q of s.squads.filter(q=>q.phase==='idle')){const count=r=>s.squads.filter(q=>q.target===r.id&&['moving','working'].includes(q.phase)).length;const routes=s.routes.filter(r=>!['saved','lost'].includes(r.status)).sort((a,b)=>(count(a)*100+a.deadline)-(count(b)*100+b.deadline));for(const r of routes)if(!deploy(s,q.id,r.id))break;}
  tick(s,.1);
 }
 assert.equal(s.ended,true);assert.ok(s.routes.every(r=>r.status==='saved'));assert.equal(seen.size,5);assert.ok([...seen].some(k=>k.endsWith('-change')));assert.ok(s.squads.some(q=>q.hp<70));assert.ok(s.squads.every(q=>!['moving','working','returning'].includes(q.phase)));assert.equal(freeBoats(s),2);assert.ok(s.time<240);
});
test('已接出时，尚在赶来的增援也返回，不会永远卡在交战',()=>{const s=createState();s.routes[0].progress=99.9;s.routes[0].resolved=true;s.routes[0].eventSeen=true;deploy(s,1,'fu');s.squads[0].phase='working';s.squads[0].pos={...s.routes[0].pos};deploy(s,2,'fu');s.paused=false;advance(s,1);assert.equal(s.routes[0].status,'saved');assert.equal(s.squads[1].phase,'returning');advance(s,30);assert.equal(s.squads[1].phase,'idle');});
test('独立存档识别正常状态和明显损坏数据',()=>{assert.equal(snapshotValid(createState()),true);assert.equal(snapshotValid(null),false);const s=createState();s.squads[0].hp=NaN;assert.equal(snapshotValid(s),false);});
