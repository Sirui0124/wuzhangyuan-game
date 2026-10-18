import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {freshCampaign,completeSafe,advancePresentation,parseCampaign,markPlayed,levelStatus,levels}=createRequire(import.meta.url)('../../.narrative-build/GameStarter/web-demo/src/campaign.js');
const state=result=>({loopId:'one',flags:{'loop.result':result,'loop.completed_wuzhang':true,'progress.tutorial_completed':true,'loop.player_alive':true,'loop.lamp_lit':true}});
test('campaign progress only accepts a fully confirmed safe clear, never teaching/death/unfinished video boundary',()=>{
 const c=freshCampaign();for(const result of ['none','execution','tutorial_execution','lamp_failure'])assert.deepEqual(completeSafe(c,state(result),true),c);
 assert.deepEqual(completeSafe(c,state('safe'),false),c);
 const won=completeSafe(c,state('safe'),true);assert.deepEqual(won.unlocked,['wuzhang','grain']);assert.deepEqual(won.completed,['wuzhang']);assert.equal(won.presentation.stage,'video');assert.deepEqual(completeSafe(won,state('safe'),true),won);
 const ending=advancePresentation(won);assert.equal(ending.presentation.stage,'ending');assert.deepEqual(parseCampaign(JSON.stringify(ending)),ending);const rewind=advancePresentation(ending),map=advancePresentation(rewind);assert.equal(rewind.presentation.stage,'rewind');assert.equal(map.presentation.stage,'map');assert.deepEqual(advancePresentation(map),map);assert.deepEqual(parseCampaign(JSON.stringify(map)),map);
});
test('map progress survives replay without leaking evidence or permission; preparing/locked levels never become played',()=>{
 const won=completeSafe(freshCampaign(),state('safe'),true),replay={...won,presentation:null};
 assert.deepEqual(markPlayed(replay,'grain'),replay);assert.deepEqual(markPlayed(replay,'valley'),replay);
 assert.deepEqual(levels.map(l=>levelStatus(replay,l)),['history','preparing','locked']);assert(!('evidence' in replay));assert(!('flags' in replay));assert(!('drafts' in replay));
 assert.deepEqual(parseCampaign(JSON.stringify(replay)),replay);assert.throws(()=>parseCampaign('{"schemaVersion":99}'));
 const old={...freshCampaign(),played:['grain'],unlocked:['wuzhang','grain']};const cleaned=parseCampaign(JSON.stringify(old));assert.deepEqual(cleaned.played,[]);assert.deepEqual(cleaned.unlocked,['wuzhang']);
});
