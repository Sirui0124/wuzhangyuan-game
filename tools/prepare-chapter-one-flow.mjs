// Explicit source-row ranges keep dialogue authoring separate from game navigation.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const directory=resolve(root,'content/chapters/wuzhang');
const script=JSON.parse(readFileSync(resolve(directory,'chapter-one.script.json'),'utf8'));
const ids=script.rows.map(row=>row.id);
const range=(from,to)=>{const a=ids.indexOf(from),b=ids.indexOf(to);if(a<0||b<a)throw Error(`${from}..${to}`);return ids.slice(a,b+1);};
const phase=id=>({kind:'phase',id});const section=id=>({kind:'section',id});const film=id=>({kind:'cinematic',id});
const sections=[
 ['awakening','第六夜 · 醒来','camp_gate',1,'A-06','A-16',phase('explore')],
 ['notice','帐前的禁令','camp_gate',1,'A-17','A-18',phase('explore')],
 ['first-scout','急报将至','report_post',1,'A-19','A-27',phase('explore')],
 ['first-weiyan','拦住魏延','report_post',1,'A-28','A-40',phase('explore')],
 ['first-handoff','转呈未竟','camp_gate',1,'A-41','A-46',phase('explore')],
 ['first-night','等到天明','camp_gate',1,'A-47','A-49',film('accountability')],
 ['first-judgment','清晨问责','camp_gate',1,'A-50','A-60',phase('death')],
 ['rewind','还是那一片夕阳','camp_gate',2,'A-61','A-END',phase('explore')],
 ['guard-investigation','先问清禁令','camp_gate',2,'D01','D06',phase('explore')],
 ['relay-investigation','谁能接报作主','jiangwei_tent_front',2,'D07','D16',phase('explore')],
 ['scout-investigation','今夜为何不同','report_post',2,'D17','D26',phase('thoughts')],
 ['jiang-commitment','亲自问准','camp_gate',2,'J01','J14',phase('explore')],
 ['weiyan-approach','禀将军……','report_post',2,'W02','W01A',phase('expression')],
 ['weiyan-cooperation','把来报者带回来','report_post',2,'W03','W09',section('formal-report')],
 ['formal-report','军情交到有权者手中','camp_gate',2,'E01','E04C',section('order-delivery')],
 ['order-delivery','等到回令','camp_gate',2,'E05','E11',section('after-report')],
 ['after-report','天亮，无人来收矛','camp_gate',2,'B-01','B-08',film('seven-days')],
 ['seven-days','主灯未灭','camp_gate',2,'B-09','B-11',film('opportunity')],
 ['reflection','守住灯之后','camp_gate',2,'B-12','B-18',phase('ending')],
].map(([id,title,scene,round,from,to,next])=>({id,title,scene,round,rows:range(from,to),next}));
sections.find(s=>s.id==='jiang-commitment').rowScenes={J03:'jiangwei_tent_front',J05:'camp_gate',J14:'report_post'};
sections.find(s=>s.id==='weiyan-cooperation').rowScenes={W08:'camp_gate'};
// W02 intentionally precedes W01/W01A; source table already uses this order.
const actions=[
 ['read-notice','查看告示','','camp_gate',1,'notice',['awakening'],71,40],
 ['meet-first-scout','询问斥候','营前有人带回急报。','report_post',1,'first-scout',['notice'],30,46],
 ['intercept-first','迎上魏延','魏延正要向中军帐走去。','report_post',1,'first-weiyan',['first-scout'],72,45],
 ['deliver-first','把急报交给甲','先将魏将军的话送到帐前。','camp_gate',1,'first-handoff',['first-weiyan'],37,48],
 ['stand-watch','回到值守处','这一夜，灯还亮着。','camp_gate',1,'first-night',['first-handoff'],62,68],
 ['ask-guard','向甲问清禁令','这一次，要听清后半句话。','camp_gate',2,'guard-investigation',['rewind'],35,48],
 ['ask-relay','向乙打听当值','谁能接报，谁能决定？','jiangwei_tent_front',2,'relay-investigation',['guard-investigation'],55,49],
 ['ask-scout','核实今夜敌情','把今夜与前几夜对照。','report_post',2,'scout-investigation',['relay-investigation'],30,46],
 ['meet-jiang','请亲兵通传','当面问准，不能替将军作主。','camp_gate',2,'jiang-commitment',['scout-investigation'],60,42],
 ['intercept-weiyan','迎上魏延','带着姜维的真实答复回去。','report_post',2,'weiyan-approach',['jiang-commitment'],72,45],
].map(([id,label,description,scene,round,section,requires,x,y])=>({id,label,description,scene,round,section,requires,x,y}));
const flow={schemaVersion:1,id:'wuzhang',title:'五丈原：守住灯之后',version:'ch1-flow-20261022-v1',scriptVersion:script.version,entry:film('opening'),sections,actions,
 cinematics:[
  {id:'opening',group:'opening',title:'若能早一步',coveredRows:range('A-01','A-05'),next:section('awakening')},
  {id:'accountability',group:'sacrifice',title:'清晨问责',coveredRows:[],next:section('first-judgment')},
  {id:'seven-days',group:'safe',title:'七日期满',clipIds:['ending-en01-20261016'],coveredRows:[],next:section('seven-days')},
  {id:'opportunity',group:'safe',title:'借不回战机',clipIds:['EN03-EN04'],coveredRows:[],next:section('reflection')},
 ],
 scenes:[
  {id:'camp_gate',title:'中军帐前',description:'帐帘垂着，里面仍有灯光。',routes:['report_post','jiangwei_tent_front']},
  {id:'report_post',title:'营前传报处',description:'号角声落了，远处仍有马蹄。',routes:['camp_gate','jiangwei_tent_front']},
  {id:'jiangwei_tent_front',title:'姜维将军帐前',description:'亲兵识得通传规矩，乙正整理军中文书。',routes:['camp_gate','report_post']},
 ],
 endings:[
  {id:'tutorial-sacrifice',number:'001',phase:'首轮 · 转呈未竟',result:'tutorial_execution',title:'诸葛亮活了，但你挂了。',description:script.rows.find(r=>r.id==='A-58').text,hint:'再来一次，问清谁能接报、作决定，并等到军令传回。',kind:'转呈未竟'},
  {id:'safe',number:'002',phase:'五丈原 · 守住灯之后',result:'safe',title:'灯没灭，你也活下来了。',description:'姜维亲自听清军报并作出决定，回令已传至魏延与前营。你守住了这一夜。',hint:'保住这一夜，还借不回此前错过的战机。',kind:'灯火未灭'},
 ]};
writeFileSync(resolve(directory,'chapter-one.script.json'),JSON.stringify(script,null,2)+'\n');
writeFileSync(resolve(directory,'chapter-one.flow.json'),JSON.stringify(flow,null,2)+'\n');
console.log(`${sections.length} sections, ${actions.length} scene interactions, ${flow.cinematics.length} cinematic transitions`);
