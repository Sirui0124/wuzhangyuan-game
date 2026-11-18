import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const build=resolve(process.env.GAME_BUILD||'GameStarter/web-demo/.build');
const module=path=>import(pathToFileURL(resolve(build,'GameStarter/web-demo/src',path)));
const {PangtongSession}=await module('chapters/chapter-seven/session.js');
const {emptyResult,priorChapters,campaignEvidence,publishChapterResult,RESULT_KEY}=await module('campaign/results.js');
const {collectCampaign}=await module('campaign/collect.js');
const {commandResult,commandSource,EIGHT_ROUTE_VERSION,YILING_CAMPAIGN_KEY}=await module('campaign/yiling-result.js');
const {JingzhouSession}=await module('chapters/chapter-five/session.js');
const {chapterAccess}=await module('chapters/progression.js');
const {recordPangtongEnding}=await module('chapters/chapter-seven/achievements.js');
const {readAchievements,ACHIEVEMENTS_KEY}=await module('achievements/storage.js');
const {pangtongAchievementCatalog}=await module('achievements/catalog.js');
const read=url=>JSON.parse(readFileSync(resolve(build,url.slice(1))));
const story=read('/story/chapter-seven.story.json');
const history=()=>({version:1,capturedAt:'2026-10-28T00:00:00Z',results:priorChapters.map(id=>emptyResult(id))});
const store=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};
globalThis.localStorage=store();
test('主线营救结果跟随当前轮次，新开一轮不沿用上一轮获救名单',async()=>{
 const st=store(),id='12345678-1234-1234-1234-123456789abc';
 st.setItem(YILING_CAMPAIGN_KEY,JSON.stringify({id}));
 const result={...emptyResult('yiling'),status:'completed',ending:'eight-front-deadline',source:commandSource(id)+'20',people:[{name:'傅肜',fate:'saved',detail:'本轮已脱险。'}]};
 publishChapterResult(result,st);assert.equal((await collectCampaign(st,read)).results[3].people[0].name,'傅肜');
 st.setItem(YILING_CAMPAIGN_KEY,JSON.stringify({id:'22345678-1234-1234-1234-123456789abc'}));
 const next=(await collectCampaign(st,read)).results[3];assert.equal(next.status,'in-progress');assert.deepEqual(next.people,[]);
});
test('八路结算按批次记下脱险，时限未撤的将士去向未明',()=>{
 const id='12345678-1234-1234-1234-123456789abc';
 const fronts=Object.fromEntries(['sha','camp','fu','ma','cheng','du','wang','huang'].map(key=>[key,{status:'holding'}]));
 fronts.fu.status='home';fronts.ma.stages=[{name:'马良',status:'safe'},{name:'随员',status:'holding'}];
 const session={scenarioId:id,revision:15,round:8,roundLimit:8,routeVersion:EIGHT_ROUTE_VERSION,ended:true,dead:3,fronts};
 const result=commandResult(session);
 assert.equal(result.ending,'eight-front-deadline');assert.equal(result.dead,3);assert.equal(result.rescued,null);
 assert.equal(result.people.find(p=>p.name==='马良').fate,'saved');assert.equal(result.people.find(p=>p.name==='随员').fate,'unknown');
 assert.deepEqual(commandResult({...session,ended:false}).people,[]);
 assert.throws(()=>commandResult({...session,roundLimit:6}));
});
const correct={'PT-Q1':'when','PT-Q2':'trace','PT-Q3':'letter','PT-Q4':'living','PT-Q5':'alive','PT-Q6':'truth','PT-S0':'loss','PT-LOSS-CHOICE':'release','PT-RETREAT-CONFIRM':'confirm'};
function play(overrides={},h=history()){
 const s=new PangtongSession(story,h);let guard=0;
 while(!s.ending&&guard++<250){const n=s.current;assert.ok(s.advance(n.kind==='choice'?({...correct,...overrides}[n.id]??n.options[0].id):undefined),n.id);}
 assert.ok(s.ending);return s;
}
test('终章卡册只收录完整正式结局，重载/回读不重复计数，损坏卡册不覆盖',()=>{
 const st=store(),h=history(),first=play({},h);
 assert.equal(pangtongAchievementCatalog(story).length,4);
 recordPangtongEnding(first,true,st);assert.equal(st.getItem(ACHIEVEMENTS_KEY),null);
 recordPangtongEnding(play({'PT-Q2':'accuse'},h),false,st);assert.equal(st.getItem(ACHIEVEMENTS_KEY),null);
 recordPangtongEnding(first,false,st);recordPangtongEnding(first,false,st);
 recordPangtongEnding(play({'PT-S0':'feign'},h),false,st);
 assert.equal(readAchievements(st).unlocked['luofengpo-retreat'].times,1);assert.equal(Object.keys(readAchievements(st).unlocked).length,2);
 recordPangtongEnding(play({},{...h,capturedAt:'2026-10-29T00:00:00.000Z'}),false,st);assert.equal(readAchievements(st).unlocked['luofengpo-retreat'].times,2);
 st.setItem(ACHIEVEMENTS_KEY,'{broken');assert.equal(recordPangtongEnding(first,false,st),false);assert.equal(st.getItem(ACHIEVEMENTS_KEY),'{broken');
});
test('六个主调查节点、三处重要判断，各轻分支都可到达四个结局',()=>{
 assert.deepEqual(story.nodes.filter(n=>n.question).map(n=>n.question),[1,2,3,4,5,6]);
 for(const q1 of ['when','word','order'])for(const q3 of ['letter','courier','ask-pang'])for(const q5 of ['alive','sunk','revenge']){
  const base={'PT-Q1':q1,'PT-Q3':q3,'PT-Q5':q5};
  assert.equal(play(base).ending.id,'retreat');
  assert.equal(play({...base,'PT-LOSS-CHOICE':'blame'}).ending.id,'sacrifice');
  assert.equal(play({...base,'PT-S0':'feign'}).ending.id,'feign');
  assert.equal(play({...base,'PT-S0':'hope','PT-HOPE-CHOICE':'modest'}).ending.id,'future');
 }
});
test('调查失败就近重试，保留此前事实并清除失败发言；完整结局可重谈说服',()=>{
 for(const [options,target]of [[{'PT-Q2':'accuse'},'PT-Q2'],[{'PT-Q2':'dismiss'},'PT-Q2'],[{'PT-Q4':'suicide','PT-Q4-REPAIR':'insist'},'PT-Q4'],[{'PT-Q6':'rival'},'PT-Q6']]){
  const s=play(options),r=s.retry();assert.equal(s.ending.kind,'investigation');assert.equal(r.current.id,target);assert.ok(r.transcript.length<s.transcript.length);assert.deepEqual(r.history,s.history);
 }
 const s=play();assert.equal(s.retry().current.id,'PT-S0');
 assert.equal(play({'PT-Q4':'routine','PT-Q4-REPAIR':'repair'}).ending.id,'retreat');
 assert.equal(play({'PT-S0':'hope','PT-HOPE-CHOICE':'perfect','PT-PROMISE-CHOICE':'withdraw'}).ending.id,'future');
 assert.equal(play({'PT-S0':'hope','PT-HOPE-CHOICE':'perfect','PT-PROMISE-CHOICE':'insist'}).ending.id,'sacrifice');
});
test('快照重演稳定，篡改路线或错误版本被拒绝，调用方修改历史不影响本轮',()=>{
 const h=history(),s=play({},h),save=s.snapshot();h.results[0].detail='changed';
 assert.notEqual(s.history.results[0].detail,'changed');assert.deepEqual(new PangtongSession(story,history(),save).snapshot(),save);
 assert.throws(()=>new PangtongSession(story,history(),{...save,node:'PT-END-FUTURE'}));
 assert.throws(()=>new PangtongSession(story,history(),{...save,contentVersion:'wrong'}));
 assert.throws(()=>new PangtongSession(story,history(),{...save,actions:[{node:story.start,option:'truth'}]}));
});
test('缺失/损坏记录不会伪造死亡，未归不等于死亡，正负经历改变实际对白',()=>{
 const h=history();assert.equal(campaignEvidence(h).saved.length,0);assert.equal(campaignEvidence(h).lost.length,0);
 h.results[3]={...emptyResult('yiling'),status:'completed',ending:'reception',source:'yiling',rescued:45,missing:20,detail:'接应已完成'};
 h.results[2]={...emptyResult('jieting'),status:'completed',ending:'hold-masu-dies',source:'jieting',people:[{name:'马谡',fate:'dead',detail:'马谡战死。'}],detail:'守住街亭'};
 assert.equal(campaignEvidence(h).lost.length,1);assert.match(campaignEvidence(h).savedText,/45/);
 assert.ok(play({},h).transcript.some(l=>l.text.includes('马谡战死')));
 assert.ok(play({'PT-S0':'hope','PT-HOPE-CHOICE':'modest'},h).transcript.some(l=>l.text.includes('45')));
 assert.equal(play({'PT-S0':'hope','PT-HOPE-CHOICE':'modest'},history()).ending.id,'future');
});
test('前五章只读正式自动档，真实荆州动作重演后按六条判断确认生死',async()=>{
 const st=store(),jstory=read('/story/chapter-five.reports.json');
 const j=new JingzhouSession(jstory,123);j.apply({type:'begin'});for(const id of j.order)j.apply({type:'judge',id,verdict:j.report(id).truth?'true':'false'});for(const id of j.candidates)j.apply({type:'select',id});j.apply({type:'finish'});
 st.setItem('jingzhou-chapter-five-v1:playtest:reports',JSON.stringify(j.snapshot()));assert.equal((await collectCampaign(st,read)).results[4].status,'missing');
 st.setItem('jingzhou-chapter-five-v1',JSON.stringify(j.snapshot()));let h=await collectCampaign(st,read);assert.equal(h.results[4].people[0].fate,'saved');
 const access=chapterAccess(st,read('/story/chapter-access.json'));
 assert.equal(access.jingzhou.completed,true);
 assert.equal(access.luofengpo.unlocked,false);
 const bad=new JingzhouSession(jstory,1);bad.apply({type:'begin'});for(const id of bad.order)bad.apply({type:'judge',id,verdict:'false'});bad.apply({type:'finish'});st.setItem('jingzhou-chapter-five-v1',JSON.stringify(bad.snapshot()));h=await collectCampaign(st,read);assert.equal(h.results[4].people[0].fate,'saved');
 st.setItem('jingzhou-chapter-five-v1','{broken');assert.equal((await collectCampaign(st,read)).results[4].status,'invalid');
});
test('第四章旧接应记录不再生成经历，仅采用多路营救结果；第六章接口不强迫补玩',async()=>{
 const st=store();st.setItem('yiling-chapter-four-completed-v1','true');assert.equal((await collectCampaign(st,read)).results[3].status,'missing');
 const legacy=JSON.stringify({game:{schemaVersion:1,chapterId:'yiling',nodeId:'YL-END-COMPLETE',summary:{received:240},actions:[]}});
 st.setItem('yiling-chapter-four-v1',legacy);const result=(await collectCampaign(st,read)).results[3];assert.equal(result.status,'missing');assert.equal(result.rescued,null);assert.equal(result.dead,null);assert.equal(st.getItem('yiling-chapter-four-v1'),legacy);
 const sixth={...emptyResult('chapter-six'),status:'completed',ending:'saved',source:'chapter-six-final',people:[{name:'归人',fate:'saved',detail:'归人已回家。'}],detail:'交接完成'};
 publishChapterResult(sixth,st);assert.equal((await collectCampaign(st,read)).results[5].people[0].name,'归人');assert.throws(()=>publishChapterResult({...sixth,source:'playtest'},st));
 assert.ok(st.getItem(RESULT_KEY));
});
