import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dialogueFixtures } from '../../tools/ai/dialogue-fixtures.mjs';
import { freshWorldInventory, acquireWorldItem, sellWorldItem, ownedWorldItems, restoreWorldInventory } from '../web-demo/.build/GameStarter/web-demo/src/inventory/world-items.js';
import { balance } from '../web-demo/.build/GameStarter/web-demo/src/phone/supplies.js';
import { GrainSession } from '../web-demo/.build/GameStarter/web-demo/src/chapters/chapter-two/session.js';
const f = await dialogueFixtures(fileURLToPath(new URL('../web-demo/.build/', import.meta.url)));
const story = JSON.parse(readFileSync(new URL('../../content/chapters/grain/chapter-two.playable.json', import.meta.url)));
const reach = (s,id) => { for(let i=0;i<100 && s.current.id!==id;i++) assert.ok(s.advance(s.current.options?.[0]?.id)); assert.equal(s.current.id,id); };
const copy = x => JSON.parse(JSON.stringify(x));
const modes = await import('../web-demo/.build/GameStarter/web-demo/src/runtime-mode.js');

test('combined switch blocks acquisition and phone and restores both when enabled', async () => {
    const old = globalThis.localStorage, values = new Map();
    globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value) };
    try {
        const gift=await f.thoughts();gift.think();gift.continueThought();gift.placeThought('C06');gift.placeThought('C07');gift.think();gift.followPlan();
        const checkpoint=gift.serialize();
        const cup=await f.thoughts();cup.closeNotes();cup.move('camp_gate');
        const tent=new GrainSession(story);reach(tent,'CH2-LY02-ACT01');
        modes.saveRuntimeMode('ai-phone');modes.saveItemSystemEnabled(false);
        assert.equal(modes.readRuntimeMode(),'ai');assert.equal(modes.phoneEnabled('ai-phone'),false);
        assert.equal(modes.readPhonePreference(),false);
        assert.equal(cup.pickUpCup(),false);assert.equal(tent.takeCandlestick(),false);
        f.read(gift);assert.equal(gift.snapshot().supplies.worldItems.acquired.length,0);
        modes.saveItemSystemEnabled(true);modes.saveRuntimeMode('ai');
        assert.equal(modes.phoneEnabled('ai'),false);assert.ok(cup.pickUpCup());assert.ok(tent.takeCandlestick());
        gift.restore(checkpoint);f.read(gift);assert.ok(gift.snapshot().supplies.worldItems.acquired.includes('jiang-headscarf'));
        modes.saveItemSystemEnabled(false);modes.saveItemSystemEnabled(true);
        assert.equal(modes.readPhonePreference(),true);assert.equal(modes.readRuntimeMode(),'ai-phone');
    } finally { globalThis.localStorage=old; }
});

test('disabling the system and loading a save retains items, purchases, balance and phone chat', async () => {
    const old=globalThis.localStorage,values=new Map();
    globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
    try {
        const s=await f.authorized();assert.ok(s.buyItem('batteries'));
        s.rememberPhone({...s.snapshot().phone,messages:[{role:'assistant',text:'保留的手机记录'}]});
        const before=s.snapshot();
        modes.saveItemSystemEnabled(false);
        const restored=new f.ChapterSession(f.content,f.flow,f.version);restored.restore(s.serialize());
        assert.equal(restored.canPrepareSupplies(),false);
        assert.deepEqual(restored.snapshot().supplies.purchases,before.supplies.purchases);
        assert.deepEqual(restored.snapshot().supplies.worldItems,before.supplies.worldItems);
        assert.deepEqual(restored.snapshot().phone.messages,before.phone.messages);
        assert.equal(balance(restored.snapshot().supplies),balance(before.supplies));
        modes.saveItemSystemEnabled(true);restored.setRuntimeMode('ai');restored.setRuntimeMode('ai-phone');
        assert.ok(restored.canPrepareSupplies());assert.equal(balance(restored.snapshot().supplies),balance(before.supplies));
        assert.equal(restored.snapshot().supplies.rewards.length,before.supplies.rewards.length);
    } finally {globalThis.localStorage=old;}
});

test('world objects cannot be sold unowned, acquired twice or sold twice; invalid ledgers fail', () => {
    const inv = freshWorldInventory();
    assert.equal(sellWorldItem(inv,'worn-wine-cup'),false);
    assert.ok(acquireWorldItem(inv,'worn-wine-cup')); assert.ok(sellWorldItem(inv,'worn-wine-cup'));
    assert.equal(acquireWorldItem(inv,'worn-wine-cup'),false); assert.equal(sellWorldItem(inv,'worn-wine-cup'),false);
    assert.deepEqual(ownedWorldItems(restoreWorldInventory(inv)),[]);
    for(const invalid of [{acquired:[],sold:['worn-wine-cup']},{acquired:['bad'],sold:[]},{acquired:['worn-wine-cup','worn-wine-cup'],sold:[]}]) assert.throws(()=>restoreWorldInventory(invalid));
    assert.deepEqual(restoreWorldInventory(undefined),freshWorldInventory());
});

test('camp pickup and Jiang gift occur in their actual scenes in all three modes; sales survive reload',async()=>{
    for(const mode of ['offline','ai','ai-phone']) {
        const s=await f.thoughts();s.setRuntimeMode(mode);
        assert.equal(s.snapshot().supplies.worldItems.acquired.length,0);
        s.closeNotes();assert.ok(s.move('camp_gate'));assert.ok(s.canPickUpCup());assert.ok(s.pickUpCup());assert.equal(s.pickUpCup(),false);
        assert.equal(s.sellWorldItem('worn-wine-cup'),false);
        assert.ok(s.openNotes());s.think();s.continueThought();s.placeThought('C06');s.placeThought('C07');s.think();
        assert.ok(s.followPlan());assert.ok(!s.snapshot().supplies.worldItems.acquired.includes('jiang-headscarf'));
        const events=[];s.onChange(e=>events.push(e));f.read(s);
        assert.ok(s.snapshot().supplies.worldItems.acquired.includes('jiang-headscarf'));
        assert.equal(events.filter(e=>e.type==='item'&&e.id==='jiang-headscarf').length,1);
        f.act(s,'intercept-weiyan');assert.equal(s.canPickUpCup(),false);
        assert.equal(s.sellWorldItem('jiang-headscarf'),mode==='ai-phone');
        assert.equal(s.sellWorldItem('worn-wine-cup'),mode==='ai-phone');
        assert.equal(balance(s.snapshot().supplies),mode==='ai-phone'?7500:0);
        const restored=new f.ChapterSession(f.content,f.flow,f.version,undefined,undefined,mode);restored.restore(s.serialize());
        assert.equal(balance(restored.snapshot().supplies),mode==='ai-phone'?7500:0);
        assert.equal(ownedWorldItems(restored.snapshot().supplies.worldItems).length,mode==='ai-phone'?0:2);
        if(mode==='ai-phone') {assert.equal(restored.sellWorldItem('jiang-headscarf'),false);assert.ok(restored.buyItem('batteries'));assert.equal(balance(restored.snapshot().supplies),6110);}
    }
});

test('old first chapter saves have empty inventory; unsupported acquisitions cannot be restored',async()=>{
    const s=await f.authorized(),raw=JSON.parse(s.serialize());delete raw.supplies.worldItems;s.restore(JSON.stringify(raw));
    assert.deepEqual(s.snapshot().supplies.worldItems,freshWorldInventory());
    raw.supplies.worldItems={acquired:['tent-candlestick'],sold:[]};assert.throws(()=>s.restore(JSON.stringify(raw)),/物品/);
});

test('own tent pickup is optional and precedes first Gou An persuasion; phone alone allows its 10 yuan sale',()=>{
    for(const phone of [false,true]) {
        const s=new GrainSession(story,undefined,undefined,phone);
        assert.equal(s.takeCandlestick(),false);reach(s,'CH2-LY02-ACT01');assert.ok(s.takeCandlestick());assert.equal(s.takeCandlestick(),false);
        assert.equal(s.sellWorldItem('tent-candlestick'),false);
        const checkpoint=new GrainSession(story,copy(s.state),undefined,phone);assert.equal(ownedWorldItems(checkpoint.state.supplies.worldItems).length,1);
        reach(checkpoint,'CH2-LY03-018');assert.equal(checkpoint.takeCandlestick(),false);checkpoint.unlockPhone();
        assert.equal(checkpoint.sellWorldItem('tent-candlestick'),phone);assert.equal(checkpoint.sellWorldItem('tent-candlestick'),false);
        const restored=new GrainSession(story,copy(checkpoint.state),undefined,phone);restored.unlockPhone();
        assert.equal(balance(restored.state.supplies),phone?3000:0);
        assert.equal(ownedWorldItems(restored.state.supplies.worldItems).length,phone?0:1);
    }
    const skip=new GrainSession(story);reach(skip,'CH2-LY03-018');assert.equal(skip.takeCandlestick(),false);assert.equal(skip.state.supplies.worldItems.acquired.length,0);
    const bad=new GrainSession(story);bad.state.supplies.worldItems={acquired:['tent-candlestick'],sold:[]};assert.throws(()=>new GrainSession(story,copy(bad.state)),/军帐/);
});


