import test from 'node:test';import assert from 'node:assert/strict';
import {fresh,confirm,tick,nextReport,inquire,restore,clone,savedCount} from '../.build/engine.js';
const cmd=(id,action,target,extra={})=>({units:[id],action,target,...extra});
const advance=(s,n)=>tick(s,n);
const approach=()=>{const s=fresh();confirm(s,[cmd('a','rescue','rear'),cmd('b','rescue','campfire',{via:'side'}),cmd('c','rescue','east')]);return s;};
test('no deployment does not burn battle time',()=>{const s=fresh();tick(s,90);assert.equal(s.time,0);});
test('units move on independent continuous schedules',()=>{const s=approach();tick(s,50);assert.equal(s.units.c.at,'east');assert.notEqual(s.units.b.at,'campfire');assert.ok(s.units.a.pos[0]>17);});
test('rest cannot erase an enemy or free a pinned unit',()=>{const s=approach();tick(s,120);assert.equal(s.units.a.status,'fighting');assert.throws(()=>confirm(s,[cmd('a','rest','rear')]),/休整/);assert.throws(()=>confirm(s,[cmd('a','move','camp')]),/不能普通移动/);assert.ok(s.enemy.rear.hp>0);});
test('active attack resumes the rescue rather than requiring continue',()=>{const s=approach();tick(s,120);confirm(s,[cmd('a','attack','rear')]);tick(s,500);assert.equal(savedCount(s),4);assert.equal(s.goals.west.safe,true);assert.ok(s.ended);});
test('side route avoids the camp gate contact',()=>{const s=approach();tick(s,120);assert.equal(s.enemy.campfire.known,false);assert.equal(s.units.b.status,'working');});
test('rushing only changes movement and consumes stamina',()=>{const a=fresh(),b=fresh();confirm(a,[cmd('c','move','east')]);confirm(b,[cmd('c','move','east',{rush:true})]);tick(a,15);tick(b,15);assert.ok(b.units.c.pos[0]>a.units.c.pos[0]);assert.ok(b.units.c.stamina<a.units.c.stamina);});
test('rest costs time and returns to the interrupted journey',()=>{const s=fresh();confirm(s,[cmd('c','rescue','east')]);tick(s,10);confirm(s,[cmd('c','rest','east')]);const t=s.time,energy=s.enemy.rear.hp;tick(s,45);assert.equal(s.time,t+45);assert.ok(s.units.c.stamina>95);assert.equal(s.enemy.rear.hp,energy);const x=s.units.c.pos[0];tick(s,10);assert.ok(s.units.c.pos[0]>x);});
test('position inquiries update reported markers without moving units',()=>{const s=fresh();confirm(s,[cmd('a','move','rear')]);tick(s,20);const pos=clone(s.units.a.pos),time=s.time;inquire(s,['a'],'position');assert.match(s.logs.at(-1).text,/正向/);assert.deepEqual(s.units.a.pos,pos);assert.equal(s.time,time);assert.deepEqual(s.units.a.reported.pos,pos);});
test('save retains pending movement and troop conservation',()=>{const s=approach(),v=restore(JSON.stringify(s));assert.ok(v);assert.equal(v.time,s.time);assert.equal(v.units.a.status,s.units.a.status);assert.equal(Object.values(v.units).reduce((a,u)=>a+u.men,0)+v.losses,2500);});

test('stop and return do not teleport a travelling unit to its last waypoint',()=>{const s=fresh();confirm(s,[cmd('a','move','rear')]);tick(s,20);const p=clone(s.units.a.pos);confirm(s,[cmd('a','hold','camp')]);assert.deepEqual(s.units.a.pos,p);assert.equal(s.units.a.status,'idle');confirm(s,[cmd('a','retreat','camp')]);assert.equal(s.units.a.status,'moving');tick(s,1);assert.notDeepEqual(s.units.a.pos,[17,83]);});
