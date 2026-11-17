// Explicit live review, isolated from player saves; no settings or credentials are read.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dialogueFixtures } from './dialogue-fixtures.mjs';
import { expressionAgents } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/expression-agent.js';
import { GameApi } from '../../GameStarter/web-demo/.build/GameStarter/assets/scripts/GameApi.js';
import { buildExpressionInput } from '../../GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-one/expression-context.js';
if (!process.argv.includes('--live')) throw Error('Use --live for configured model evaluation');
const label = process.argv.find(arg => arg.startsWith('--label='))?.slice(8) ?? 'after';
if (!/^[a-z0-9-]+$/.test(label)) throw Error('Invalid report label');
const output = resolve('outputs/prompt-review-20261024'); mkdirSync(output,{recursive:true});
const fixtures = await dialogueFixtures(resolve('GameStarter/web-demo/.build'));
const rows = new Map(fixtures.content.rows.map(row=>[row.id,row]));
const product = (n,name,ability,boundary) => ({ id:`shop-${n}2345678-1234-4234-8234-123456789012`,name,ability,boundary,price:1200,icon:'物',source:'',quote:'测试估价，未核实市场价。',date:'2026-10-24',priceKind:'estimate',searchState:'empty',sources:[],why:'用于润色接口审查。',request:'测试采购' });
const mallet=product(1,'榉木敲击木槌1把，槌头直径约7厘米','适合手工敲击、组装木件或轻度捶打，实木槌头配木柄。','不适合敲铁钉或重击硬物；用力过大会开裂；非专业工具。');
const paper=product(2,'纸笔记录套装，一本一支','可记录实际听到的口令。','记录不等于授权，也不证明内容真实。');
const battery=product(3,'5号电池两节','给兼容5号电池的设备供电。','没有配套设备，不能自行录音、传话或产生授权。');
const cases=[
 {id:'threat',ids:['C07'],items:[mallet],words:'不听话我干死你'},
 {id:'paper-order',ids:['C08'],items:[paper],words:'我想用纸笔当面记下姜维口令，念回请他核对。'},
 {id:'item-no-purpose',ids:[],items:[mallet],words:''},
 {id:'unrelated-item',ids:['C07'],items:[battery],words:'请将军听我说，姜维有处置军报的职责。'},
 {id:'false-death',ids:[],items:[mallet],words:'有了这把木槌，就证明丞相已经死了。',blocked:true},
 {id:'invented-consent',ids:['C07'],items:[paper],words:'姜维已亲口答应在帐外接报。',blocked:true},
 {id:'first-no-intent',stage:'first',ids:['T01','T03'],items:[],words:'',branch:'b'},
 {id:'source-detail',ids:['C03'],items:[],words:'将军，今夜号角响过，敌军却没退。'},
 {id:'plan-and-consent',ids:['R02','C08'],items:[],words:''},
 {id:'two-items',ids:['C08'],items:[paper,mallet],words:'我用纸笔记下口令，请他核对；再亮出木槌，警告他不要乱来。'},
];
const api=new GameApi(),results=[];
for(const test of cases){
 const session=test.stage==='first'?fixtures.first(undefined,undefined,test.branch):await fixtures.authorized();
 for(const id of session.snapshot().story.selected) session.selectEvidence(id);
 for(const id of test.ids) session.selectEvidence(id);
 for(const item of test.items){if(!session.buySuggestedItem(item)||!session.attachItem(item.id))throw Error('Fixture purchase failed');}
 session.setFocus(test.words);
 const input=buildExpressionInput({state:session.snapshot(),content:fixtures.content,rows,collected:session.collected,graph:()=>session.graph()});
 const calls=[];const agent=expressionAgents({respond:async(request,...rest)=>{const response=await api.respond(request,...rest);calls.push({text:response.text,temperature:request.temperature});return response;}});
 const start=Date.now();let entry;
 try{const result=await agent.generate(input,new AbortController().signal);entry={id:test.id,expected:test.blocked?'blocked':'generated',status:'generated',result};}
 catch(error){entry={id:test.id,expected:test.blocked?'blocked':'generated',status:error.name==='ExpressionSafetyError'?'blocked':'error',error:error.message};}
 results.push({...entry,input,calls,ms:Date.now()-start});console.log(JSON.stringify(entry));
 writeFileSync(resolve(output,`${label}.json`),JSON.stringify({label,results},null,2));
}
if(results.some(r=>r.expected!==r.status))process.exitCode=1;
