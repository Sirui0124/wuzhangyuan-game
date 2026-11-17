import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOrders} from '../.build/dispatch-intent.js';
const capacity={甲:700,乙:800,丙:600,丁:400};
const parse=(text,unit='auto',target='auto')=>resolveOrders(text,{address:{unit,target},capacity});

test('队伍编号、序数和中文人数可解析，自动识别接应方向',()=>{
  for(const name of ['队伍1','第一队','1队','队伍１'])assert.equal(parse(name+'接应傅肜')[0].unit,'甲');
  assert.equal(parse('队伍二出动三百五十人接应傅将军，急行军')[0].men,350);
  assert.equal(parse('队伍二出动三百五十人接应傅将军，急行军')[0].target,'fu');
  assert.equal(parse('第三队支援旧营')[0].target,'camp');
  assert.equal(parse('第四队去东沟')[0].target,'sha');
});
test('手选补足缺失字段，支持只选择队伍和对象进行复诵',()=>{
  assert.equal(parse('去接应傅肜','乙')[0].unit,'乙');
  assert.equal(parse('丙队出动300人接应','auto','sha')[0].target,'sha');
  assert.equal(parse('急行军','丁','fu')[0].rush,true);
  assert.deepEqual(parse('','甲','fu').map(o=>[o.unit,o.target]),[['甲','fu']]);
});
test('手选与文字冲突时阻止复诵，不能静默覆盖',()=>{
  assert.throws(()=>parse('乙队接应傅肜','甲'),/手选的是甲队/);
  assert.throws(()=>parse('甲队接应沙摩柯','auto','fu'),/手选的是傅肜/);
});
test('缺队伍、方向不明与多方向不擅自补猜',()=>{
  assert.throws(()=>parse('去接应傅肜'),/要派遣哪支队伍/);
  assert.throws(()=>parse('甲队去接伤兵'),/要接应哪一路/);
  assert.throws(()=>parse('甲队接应傅肜和沙摩柯'),/多个接应方向/);
});
test('一条军令支持多队，保留各队独立任务与人数',()=>{
  assert.deepEqual(parse('甲队出动300人接应傅肜，急行军，乙队留营待命').map(o=>[o.unit,o.action,o.men,o.rush]),[['甲','rescue',300,true],['乙','hold',undefined,false]]);
  assert.deepEqual(parse('甲乙两队支援傅肜').map(o=>o.unit),['甲','乙']);
  assert.throws(()=>parse('甲队接应傅肜，甲队休整'),/两种安排/);
});
test('兵力、条件和含糊句不自动变成有效军令',()=>{
  for(const n of ['701','0','-1','3.5'])assert.throws(()=>parse(`甲队出动${n}人接应傅肜`),/出动人数/);
  assert.throws(()=>parse('甲队出动三百五人接应傅肜'),/人数请写完整/);
  assert.throws(()=>parse('帮我处理一下','甲','fu'),/不能确定任务/);
  assert.throws(()=>parse('如果前路安全，甲队接应傅肜'),/条件军令/);
  assert.throws(()=>parse('甲队接应傅肜吗？'),/问询/);
  assert.throws(()=>parse('甲队去接应傅肜，急行军，正常行军'),/行军方式有冲突/);
});
test('傅肜营救岗位解析为独立行动，不能让同队兼任多项任务',()=>{
  const roles=[['探查撤路','scout'],['接替断后','relieve'],['压制追兵','suppress'],['核实刘备消息','verify'],['传撤离信号','signal'],['护送傅肜','rescue']];
  for(const [text,action] of roles){const [order]=resolveOrders('甲队出动300人'+text,{address:{unit:'auto',target:'auto'},capacity,fuMode:true});assert.equal(order.action,action);assert.equal(order.target,'fu');}
  assert.equal(resolveOrders('甲队探查撤路，绕行南侧路',{address:{unit:'auto',target:'fu'},capacity,fuMode:true})[0].via,'side');
  assert.throws(()=>resolveOrders('甲队接替断后并护送傅肜',{address:{unit:'auto',target:'fu'},capacity,fuMode:true}),/多个任务/);
  assert.throws(()=>resolveOrders('甲队压制追兵，支援沙摩柯',{address:{unit:'auto',target:'auto'},capacity,fuMode:true}),/当前用于傅肜营救/);
});
