import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
let state;const results=[];
const post=async(path,data={})=>{const response=await fetch('http://127.0.0.1:8828/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:state?.id,revision:state?.revision,...data})});const result=await response.json();if(!response.ok)throw new Error(result.error);if(result.state)state=result.state;results.push({path,reply:result.reply,...(result.entries?{entries:result.entries}:{})});return result;};
await post('start');await post('camp-choice',{target:'attendant',subject:'huang',choice:'motive'});await post('talk',{target:'huang',question:'两岸接应需要落实什么？'});await post('talk',{target:'huang',question:'最后一批掩护的人怎样回来？'});await post('think',{id:'huang',facts:['huang-1','huang-2']});await post('talk',{target:'huang',question:'请组织将士分批归蜀。我会落实南岸接收救护和两岸回号，给最后一批掩护的人留船；通道变化及时通知对岸停下，不逼大家冒险。'});assert.equal(state.routes.find(r=>r.id==='huang').agreed,true);const risk=state.routes.find(r=>r.id==='huang').risk;
await post('talk',{target:'huang',question:'刚才的安排照办，再确认一次。'});assert.equal(state.routes.find(r=>r.id==='huang').risk,risk);
const p=await post('preview',{orders:[{id:'huang',troops:1500,text:'恢复两岸联络，向全体将士说明接应安排。落实回号，分批渡运，南岸接收救护。留下最后一批的接应船，通道有变及时通知停止。'}]});assert.equal(p.entries[0].matched.length,3);assert.equal(p.entries[0].after,0);
await writeFile('outputs/yiling-rescue-demo-20261028/huang-live.json',JSON.stringify(results,null,2));console.log('黄权真实AI：两条情报、整理思绪、说服通过、重复确认不刷分、军令三项匹配。');
