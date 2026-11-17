import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {inquiryPrompt,understandInquiry}=await import(pathToFileURL(resolve('GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-five/inquiry.js')));
const story=JSON.parse(readFileSync('content/chapters/jingzhou/chapter-five.reports.json','utf8'));
const report=story.reports.find(r=>r.id==='yu'),entry={asked:[],questions:{},verdict:null};
const call=(text,e=entry,signal=new AbortController().signal)=>understandInquiry(report,e,'那边的人原话怎么说？',signal,{respond:async()=>({text})});
test('AI sees authored testimony and actual conversation but never truth, motives or solution annotations',()=>{
 const prompt=inquiryPrompt(report,{...entry,asked:['time'],questions:{time:'你几时走的？'}},'那回札呢？');
 assert.ok(prompt.includes('你几时走的？'));assert.ok(prompt.includes(report.answers.time));
 for(const hidden of [report.motive,report.explanation,'flawDimensions','"truth"'])assert.equal(prompt.includes(hidden),false);
});
test('only one valid authored dimension is accepted; invented model dialogue is discarded',async()=>{
 assert.deepEqual(await call('{"kind":"answer","dimension":"source","reply":"我全是在骗人，援军没了"}'),{kind:'answer',dimension:'source'});
 for(const text of ['garbage','{"kind":"answer","dimension":"truth"}','{"kind":"answer","dimension":["time","source"]}'])await assert.rejects(call(text));
 for(const kind of ['multiple','unknown'])assert.deepEqual(await call(JSON.stringify({kind})),{kind});
 assert.deepEqual(await call('{"kind":"answer","dimension":"source"}',{...entry,asked:['source']}),{kind:'answer',dimension:'source'});
});
test('cancellation after a late model response cannot produce a usable answer',async()=>{
 const c=new AbortController();
 await assert.rejects(understandInquiry(report,entry,'什么时候？',c.signal,{respond:async()=>{c.abort();return{text:'{"kind":"answer","dimension":"time"}'};}}));
});
