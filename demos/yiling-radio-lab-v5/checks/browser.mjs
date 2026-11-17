import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],api=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',async r=>{if(r.url().endsWith('/api/message'))api.push({request:r.request().postDataJSON(),status:r.status(),response:await r.json()});});
const state=()=>page.evaluate(()=>window.radioQA.state);
const ui=()=>page.evaluate(()=>window.radioQA.ui);
const shot=name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',import.meta.url)),fullPage:true});
async function say(text){await page.locator('#words').fill(text);await page.locator('#send').click();await page.waitForFunction(()=>!document.querySelector('#send')?.disabled,{},{timeout:65000});if(await page.locator('.toast').count())throw Error(await page.locator('.toast').innerText());}
async function order(text){await page.getByRole('link',{name:'出兵调遣',exact:true}).click();await say(text);await page.locator('#confirm').click();assert.equal((await ui()).page,'frontline');await page.locator('[data-speed="0"]').click();}
try{
 await page.goto('http://127.0.0.1:8954/?qa=1');await page.locator('#begin').click();
 assert.equal(await page.locator('[data-front]').count(),3);assert.equal(await page.locator('.squads').count(),0);await shot('frontline-opening');
 const before=await state();
 for(const [front,text,expected] of [['fu','你为什么还不撤回来？最担心的是什么？','退路'],['sha','你在东沟，西沟那边还有人要接吗？','西沟'],['camp','张南先回来以后，冯习那边还要怎么接？','冯习']]){
  await page.locator(`[data-front="${front}"]`).click();await say(text);const s=await state();assert.equal(s.time,before.time);assert.deepEqual(s.units,before.units);assert.ok(s.logs.at(-1).text.includes(expected));assert.equal(await page.locator('#confirm').count(),0);
 }
 await say('派甲队去接傅肜。');assert.equal((await state()).started,false);await page.locator('#to-dispatch').click();assert.equal((await ui()).page,'dispatch');assert.equal(await page.locator('#words').inputValue(),'派甲队去接傅肜。');
 await shot('dispatch');
 await say('甲队接应傅肜，乙队走南侧路接冯习张南，丙队搜东沟，丁队留营待命。');
 assert.equal((await state()).started,false);await page.locator('#confirm').click();assert.equal((await ui()).page,'frontline');await page.locator('[data-speed="0"]').click();
 for(let i=0;i<3;i++)await page.locator('#next').click();
 await order('甲队突击后阵敌军，击退后继续接应傅肜。');
 for(let i=0;i<18;i++){await page.locator('#next').click();if((await state()).ended)break;}
 const final=await state();assert.ok(final.ended);assert.ok(['fu','zhang','feng','east','west'].every(k=>final.goals[k].safe));await shot('result');
 await page.locator('#close-result').click();await page.locator('[data-front="fu"]').click();await say('傅肜现在回营了吗？');assert.match((await state()).logs.at(-1).text,/已归营/);
 await page.locator('#words').fill('沙将军还有谁没有接回来？');await page.getByRole('link',{name:'出兵调遣',exact:true}).click();await page.locator('#words').fill('丁队原地待命。');const paused=(await state()).time;await page.waitForTimeout(3500);assert.equal((await state()).time,paused);await page.reload();assert.equal((await ui()).page,'dispatch');assert.equal(await page.locator('#words').inputValue(),'丁队原地待命。');if(await page.locator('#close-result').count())await page.locator('#close-result').click();await page.getByRole('link',{name:'前线联络',exact:true}).click();assert.equal(await page.locator('#words').inputValue(),'沙将军还有谁没有接回来？');
 assert.equal(errors.length,0);assert.ok(api.every(r=>r.status===200));
 // Store compact request records; do not duplicate raw whole states in evidence.
 await fs.writeFile(new URL('browser.json',import.meta.url),JSON.stringify({errors,api:api.map(r=>({mode:r.request.mode,front:r.request.front,text:r.request.text,status:r.status,response:r.response})),checks:['three named contacts','questions do not deploy or advance time','contact-page order redirects','dispatch confirmation required','confirm returns to frontline','full rescue','returned contact report','per-page drafts survive navigation and refresh'],final},null,2));
 console.log(JSON.stringify({errors,realApiRequests:api.length,returnedGenerals:4,returnedGroups:5,time:final.time}));
}finally{await browser.close();}
