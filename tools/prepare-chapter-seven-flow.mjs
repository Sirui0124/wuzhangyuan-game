import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {reviseStory, endingGroups, historyRows} from './chapter-seven-flow-revision.mjs';
const root=process.cwd(),dir=resolve(root,'outputs/chapter-seven-flow-20261029');
const story=JSON.parse(readFileSync(resolve(root,'content/chapters/luofengpo/chapter-seven.story.json'),'utf8'));
const sourceVersion=story.contentVersion;
reviseStory(story);
const byId=new Map(story.nodes.map(n=>[n.id,n]));
function destination(id){const lines=[];while(byId.get(id).kind==='line'){const n=byId.get(id);lines.push({speaker:n.speaker,text:n.text});id=n.next;}return {id,lines};}
const meta={
 'PT-Q1':['01 · 先问哪一处','送出时辰／改字的人／交稿的人'],
 'PT-Q2':['02 · 如何查下去 ★','核交稿经过，还是先下定论？'],
 'PT-Q3':['03 · 核实孔明来信','看全文／核递送／当面问'],
 'PT-Q4':['04 · 怎样追问动机 ★','问活着回来怎么办，还是直接断言？'],
 'PT-Q4-REPAIR':['允许改口一次','接受纠正，还是坚持原结论？'],
 'PT-Q5':['05 · 问清放不下什么','活着劝／沉没代价／报仇对象'],
 'PT-Q6':['06 · 复盘真正原因 ★','看懂死讯要让刘备承担什么'],
 'PT-S0':['从哪件事说起','战争代价／真实获救／假死办法'],
 'PT-LOSS-CHOICE':['谈战争的代价','承认责任边界，还是把一切归罪于他？'],
 'PT-HOPE-CHOICE':['谈真正救回的人','承诺另一种尝试，还是保证天下？'],
 'PT-PROMISE-CHOICE':['许诺过头后，能否改口','收回保证／继续逼迫／转谈假死'],
 'PT-RETREAT-CONFIRM':['真实退出，亲见刘备','承认大业可能不成，承担离开的后果'],
 'PT-FEIGN-CONFIRM':['保命，留下死讯','不编凶手、不让随行者陪葬'],
 'PT-FUTURE-CONFIRM':['完成交接，回五丈原','与孔明相见，再商量进退'],
 'PT-DEATH-ACT':['庞统仍要出营','完成家属交接／再追劝一次'],
};
const short={when:'问送出时辰',word:'问谁改字',order:'问谁交稿',trace:'核交稿经过',accuse:'直接告发刘备',dismiss:'不查，送走文书',letter:'看完整来信',courier:'核送信经过','ask-pang':'当面问庞统',suicide:'断言他早已求死',routine:'当作普通后事',living:'问活着回来怎么办',repair:'改口，重新追问',insist:'坚持逼迫／原结论',alive:'问活着劝哪里不够',sunk:'问退兵是否白死',revenge:'问会找谁报仇',duty:'只说预备后事',truth:'死讯绑住刘备，自己也难回头',rival:'只说与孔明争功',loss:'谈战争代价',hope:'谈实际获救',feign:'转向假死',blame:'全部后果归罪于他',release:'承认责任边界',compromise:'留下信，人离开',modest:'不保证天下，去尝试',perfect:'保证两人改变天下',leave:'不许诺后世，先活下来',withdraw:'收回过度保证',confirm:'确认执行',back:'返回重新谈',family:'完成家属交接',last:'再追劝，陈简交接'};
const nodes=story.nodes.filter(n=>n.kind!=='line').map(n=>({id:n.id,kind:n.kind==='ending'?'end':'choice',title:meta[n.id]?.[0]??story.endings.find(e=>e.id===n.ending).title,
 sub:meta[n.id]?.[1]??story.endings.find(e=>e.id===n.ending).description,text:n.text,options:(n.options??[]).map(o=>({...o,target:destination(o.next).id,lines:destination(o.next).lines})),
 ending:story.endings.find(e=>e.id===n.ending),retry:n.retry??(n.kind==='ending'?'PT-S0':null)}));
const edges=[];
for(const n of nodes){const groups=new Map();for(const o of n.options){const key=o.target;const g=groups.get(key)??[];g.push(o);groups.set(key,g);}for(const [to,options]of groups)edges.push({from:n.id,to,label:options.length===3?'三种追问均汇合':options.map(o=>o.id==='insist'?(n.id==='PT-Q4-REPAIR'?'坚持原结论':'坚持必须改变天下'):(short[o.id]??o.text)).join(' / '),type:options[0].id==='back'?'back':'forward',options:options.map(o=>o.id)});
 if(n.kind==='end')edges.push({from:n.id,to:n.retry,label:n.ending.kind==='complete'?'重谈最后一场':'就近重试',type:'retry'});
}
const investigation={
 'PT-Q1':[60,390],'PT-Q2':[460,390],'PT-Q3':[860,390],'PT-Q4':[1260,390],'PT-Q4-REPAIR':[1640,100],
 'PT-Q5':[2020,390],'PT-Q6':[2420,390],'PT-S0':[2820,390],
 'PT-END-INV2':[460,800],'PT-END-INV4':[2020,100],'PT-END-INV6':[2420,800],
};
const persuasion={
 'PT-S0':[60,580],'PT-LOSS-CHOICE':[450,180],'PT-HOPE-CHOICE':[450,790],'PT-PROMISE-CHOICE':[870,1040],
 'PT-RETREAT-CONFIRM':[1340,70],'PT-FEIGN-CONFIRM':[1340,450],'PT-FUTURE-CONFIRM':[1340,830],'PT-DEATH-ACT':[1340,1210],
 'PT-END-RETREAT':[1850,70],'PT-END-FEIGN':[1850,450],'PT-END-FUTURE':[1850,830],'PT-END-DEATH':[1850,1210],
};
const overview=[
 {id:'intro',kind:'story',title:'发现提前写好的死讯',sub:'庞统还活着，陈简已在誊写“阵亡”',x:60,y:70,w:350,h:135},
 {id:'inquiry',kind:'choice',title:'六处调查，三处重要判断',sub:'第 2、4、6 处可能失败；失败就近重试',x:515,y:35,w:350,h:205,go:'investigation'},
 {id:'truth',kind:'story',title:'查明用途，再开始说服',sub:'他想让刘备难以回头，自己也放不下代价',x:970,y:70,w:350,h:135},
 {id:'route-retreat',kind:'choice',title:'承认责任边界，真实退出',sub:'可从战争代价谈起，也可从救人转入',x:35,y:350,w:300,h:150},
 {id:'route-sacrifice',kind:'choice',title:'坚持归罪或强求保证',sub:'责令他承担所有死亡，或必须改变天下',x:380,y:350,w:300,h:150},
 {id:'route-feign',kind:'choice',title:'接受假死的代价',sub:'可直接提出，也可从两种劝说转入',x:725,y:350,w:300,h:150},
 {id:'route-future',kind:'choice',title:'给出另一种尝试',sub:'不承诺解决天下；允许收回过度保证',x:1070,y:350,w:300,h:150},
 ...['RETREAT','DEATH','FEIGN','FUTURE'].map((id,i)=>({...nodes.find(n=>n.id==='PT-END-'+id),x:35+i*345,y:655,w:300,h:165})),
];
const overviewEdges=[{from:'intro',to:'inquiry',label:'核实交稿与来信'},{from:'inquiry',to:'truth',label:'成功查明动机'},...['retreat','sacrifice','feign','future'].map(id=>({from:'truth',to:'route-'+id,label:''})),...['RETREAT','DEATH','FEIGN','FUTURE'].map((id,i)=>({from:['route-retreat','route-sacrifice','route-feign','route-future'][i],to:'PT-END-'+id,label:i===1?'仍出营，未能劝回':'确认并完成交接'}))];
const data={storyVersion:story.contentVersion,sourceVersion,endingGroups,historyRows,nodes,edges,investigation,persuasion,overview,overviewEdges,counts:{choices:nodes.filter(n=>n.kind==='choice').length,complete:nodes.filter(n=>n.ending?.kind==='complete').length,failures:nodes.filter(n=>n.ending?.kind==='investigation').length}};
const template=readFileSync(resolve(root,'tools/chapter-seven-flow.template.html'),'utf8');
mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,'pangtong-endings.html'),template.replace('/*__DATA__*/',JSON.stringify(data).replaceAll('<','\\u003c')));
const expectedChoices=story.nodes.filter(n=>n.kind==='choice');if(expectedChoices.some(n=>!investigation[n.id]&&!persuasion[n.id]))throw new Error('有选择未进入分支图');
writeFileSync(resolve(dir,'source-check.json'),JSON.stringify({source:'content/chapters/luofengpo/chapter-seven.story.json',version:story.contentVersion,generatedAt:new Date().toISOString(),...data.counts,options:expectedChoices.reduce((v,n)=>v+n.options.length,0),allChoicesMapped:true,edges:edges.length},null,2));
console.log(resolve(dir,'pangtong-endings.html'));
