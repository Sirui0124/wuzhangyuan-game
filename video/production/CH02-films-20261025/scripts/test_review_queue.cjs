const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
(async()=>{
 let release;const gate=new Promise(r=>release=r),requests=[];
 const ctx={notes:{V1:'初'},approvals:{},load:()=>({}),save:()=>true,localStorage:{setItem(){}},window:{addEventListener(){}},$:()=>({textContent:''}),console,
 fetch:async(url,opts)=>{const p=JSON.parse(opts.body);requests.push(p);if(requests.length===1)await gate;return {ok:true,json:async()=>({record:{revision:requests.length}})}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/review-sync.js','utf8'),ctx);
 const label={textContent:''},clip={id:'V1',file:'v1.mp4'};ctx.diskSave(clip,label);
 ctx.notes.V1='中间拼音';ctx.diskSave(clip,label);ctx.notes.V1='完整中文评论';ctx.diskSave(clip,label);
 assert.equal(vm.runInContext('pending.has("V1")',ctx),true);release();await vm.runInContext('saveChain',ctx);
 assert.equal(requests.length,2);assert.equal(requests[1].note,'完整中文评论');assert.equal(requests[1].baseRevision,1);
 assert.equal(vm.runInContext('pending.size',ctx),0);assert.equal(label.textContent,'已保存到本机文件');
 console.log('Save queue coalesces typing, preserves latest text, and waits for final acknowledgement');
})().catch(e=>{console.error(e);process.exitCode=1});
