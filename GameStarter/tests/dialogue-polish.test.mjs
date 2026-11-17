import {test} from 'node:test';
import assert from 'node:assert/strict';
import {polishFixtures} from '../../tools/ai/dialogue-polish-fixtures.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const build=process.env.POLISH_BUILD??'GameStarter/web-demo/.build';
const {polishDialogue,checkDialoguePolishAudit,dialoguePolishPrompt,dialoguePolishAuditPrompt}=await import(pathToFileURL(resolve(build,'GameStarter/web-demo/src/dialogue-polish.js')));
const cases=await polishFixtures(build);
const writerData=t=>JSON.parse(t.slice(t.lastIndexOf('本次资料：\n')+'本次资料：\n'.length));

test('all nine entrances use distinct scene directions and actual selected clues',()=>{
 assert.equal(cases.length,9);assert.equal(new Set(cases.map(c=>c.input.direction)).size,9);
 for(const c of cases){assert.deepEqual(c.input.evidence.map(e=>e.id),c.session.state.selected);assert.ok(c.input.evidence.every(e=>c.session.clues.some(x=>x.id===e.id)));}
});

test('one writer request returns an editable draft without runtime audit or game-state changes',async()=>{
 for(const c of cases){
  const before=structuredClone(c.session.state),requests=[],text=c.input.words;
  assert.equal(await polishDialogue(c.input,new AbortController().signal,{respond:async request=>{requests.push(request.text);return{text:JSON.stringify({status:'ok',text})};}}),text);
  assert.equal(requests.length,1);assert.ok(requests.every(p=>p.startsWith('你帮助玩家')));assert.deepEqual(c.session.state,before);
 }
});

test('semantic doubts and incomplete evidence metadata do not gate an otherwise readable draft',async()=>{
 const input=structuredClone(cases[0].input),before=structuredClone(input),text='这就是我准备说的，后果由对方回应。';let calls=0;
 const result=await polishDialogue(input,new AbortController().signal,{respond:async()=>{calls++;return{text:JSON.stringify({status:'needs_revision',text,evidenceIds:['unknown'],reason:'内容可能不成立'})};}});
 assert.equal(result,text);assert.equal(calls,1);assert.deepEqual(input,before);
});

test('an empty needs_revision preserves the original wording as an editable draft',async()=>{
 const input={...cases[0].input,words:'我先试着用手里的电池隔空传话。'};let calls=0;
 assert.equal(await polishDialogue(input,new AbortController().signal,{respond:async()=>{calls++;return{text:JSON.stringify({status:'needs_revision',text:'',reason:'物品不具备这项能力'})};}}),input.words);
 assert.equal(calls,1);
});

test('empty generation without words retries once then composes only selected cores and neutral item display',async()=>{
 const input={...cases[0].input,words:'',evidence:[{id:'A',text:'帐内禁入。'}],items:[{id:'item',name:'小本子',ability:'可记事',boundary:'不含笔'}]};let calls=0;
 const result=await polishDialogue(input,new AbortController().signal,{respond:async()=>{calls++;return{text:JSON.stringify({status:'needs_revision',text:''})};}});
 assert.equal(calls,2);assert.equal(result,'帐内禁入。 我带着小本子。');assert.doesNotMatch(result,/写下|送给|已经|同意/);
});

test('the writer gets core meanings and role metadata while original source prose stays verification-only',()=>{
 const input={...cases[0].input,words:'我想帮你。我陪你送报。',evidence:[{id:'A',text:'六月领粮。',sources:[{speaker:'文书',text:'六月初二领粮，纸角沾了雨。'}]}]};
 const prompt=dialoguePolishPrompt(input),writer=writerData(prompt);
 assert.equal(writer.speaker,'我（玩家）');assert.equal(writer.questionSpeaker,input.listener);assert.equal(writer.question,input.question);
 assert.deepEqual(writer.evidence,[{id:'A',text:'六月领粮。'}]);assert.doesNotMatch(prompt,/纸角沾了雨/);
 const audit=dialoguePolishAuditPrompt(input,'六月领粮，我陪你送报。');const data=JSON.parse(audit.slice(audit.lastIndexOf('资料：')+3));
 assert.deepEqual(data.input.evidence[0].sources,input.evidence[0].sources);
});

test('oversize repair carries the entire earlier candidate and original words, without an audit call',async()=>{
 const input=structuredClone(cases[0].input),before=structuredClone(input),long='重复说明。'.repeat(100),short='请先留下，我查清后回来告诉你。',calls=[];
 const values=[long,short];
 assert.equal(await polishDialogue(input,new AbortController().signal,{respond:async request=>{calls.push(request.text);return{text:JSON.stringify({text:values.shift()})};}}),short);
 assert.equal(calls.length,2);assert.equal(writerData(calls[1]).repair.candidate,long);assert.equal(writerData(calls[1]).words,input.words);assert.match(writerData(calls[1]).repair.reason,/正文超过/);assert.deepEqual(input,before);
});

test('a second oversized candidate remains complete and editable instead of blocking or truncating',async()=>{
 const input=cases[0].input,long='完整但偏长的表达。'.repeat(60);let calls=0;
 assert.equal(await polishDialogue(input,new AbortController().signal,{respond:async()=>{calls++;return{text:JSON.stringify({text:long})};}}),long);
 assert.equal(calls,2);
});

test('invalid JSON gets one structural retry and repeated malformed responses preserve the input',async()=>{
 const input=structuredClone(cases[0].input),before=structuredClone(input);let calls=0;
 assert.equal(await polishDialogue(input,new AbortController().signal,{respond:async()=>({text:++calls===1?'bad JSON':JSON.stringify({text:'可以编辑的句子。'})})}),'可以编辑的句子。');assert.equal(calls,2);
 calls=0;await assert.rejects(polishDialogue(input,new AbortController().signal,{respond:async()=>{calls++;return{text:'not JSON'};}}),/生成服务.*原稿已保留/);assert.equal(calls,2);assert.deepEqual(input,before);
});

test('cancellation after generation returns prevents any replacement draft or further request',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(polishDialogue(cases[0].input,controller.signal,{respond:async()=>{calls++;controller.abort();return{text:JSON.stringify({text:'迟到稿'})};}}),{name:'AbortError'});assert.equal(calls,1);
});

test('semantic citation checking remains available only as an offline quality check',()=>{
 const input={...cases[0].input,words:'我想帮你。我陪你送报。',evidence:[{id:'A',text:'六月领粮。',sources:[{speaker:'文书',text:'纸角沾了雨。'}]}]},candidate='六月领粮，我陪你送报。';
 const record={facts:true,intent:true,coverage:true,logic:true,items:true,reason:'',intentComparison:[{id:'0',quote:'我陪你送报',styleOnly:false},{id:'1',quote:'我陪你送报',styleOnly:false}],evidenceMatches:[{id:'A',points:[{sourceQuote:'六月领粮',quote:'六月领粮'}]}]};
 assert.doesNotThrow(()=>checkDialoguePolishAudit(record,input,candidate));
 const invalid=structuredClone(record);invalid.evidenceMatches[0].points[0].sourceQuote='纸角沾了雨';assert.throws(()=>checkDialoguePolishAudit(invalid,input,candidate),/审核未逐条/);
});
