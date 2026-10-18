import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const { NarrativeEngine } = require('../../.narrative-build/GameStarter/assets/scripts/narrative/engine.js');
export const chapter = JSON.parse(readFileSync(new URL('../../../content/chapters/wuzhang/chapter.json', import.meta.url)));
export const accepted = r => ({requestId:r.requestId,status:'accept',interpretedIntentId:r.intentId,supportedEvidenceIds:r.evidenceIds,missingPoints:[],explanation:'fixture'});
export const preset = {async judge(r){return accepted(r);}};
export const finish = e => {e.skipCurrentSegment();e.completeSegment();};
export const open = (e,id,evidence) => {const n=chapter.dialogues.find(n=>n.id===id);e.enterScene(n.sceneId);e.selectCharacter(n.characterId);if(evidence)e.presentEvidence(evidence);e.openTopic(n.topicId,n.trigger);};
export const choose = (e,id) => {e.skipCurrentSegment();e.choose(id,`${id}-${e.snapshot().revision}`);finish(e);};
export function readNotice(e, id='notice.read') { open(e,id);finish(e);if(e.interactions().nodeId==='player.notice_plan')finish(e); }
export function scoutEvidence(e, id='scout.report') {
 open(e,id);finish(e);if(!e.tryPresentEvidence(['entry_notice']))throw new Error('Scout rejected notice');
 choose(e,'scout.notice.question');finish(e);
}
export function tutorialInput(e) {
 open(e,'player.intro');finish(e);readNotice(e,'tutorial.notice');scoutEvidence(e,'tutorial.scout');open(e,'tutorial.weiyan');e.skipCurrentSegment();
 if(!e.tryPresentEvidence(['entry_notice']))throw new Error('Tutorial notice rejected');finish(e);
 if(!e.tryPresentEvidence(['scout_statement']))throw new Error('Tutorial scout rejected');e.skipCurrentSegment();
}
export async function tutorial(e, text='帐内有要事，请将军暂候。我马上把急报交给帐门卫士，请他隔帘向帐内通报。') {
 tutorialInput(e);const r=await e.submitFreeInput('propose_wait',['scout_statement'],text);finish(e);finish(e);finish(e);return r;
}
// Normal-route fixtures start after onboarding. Actual tutorial traversal is tested separately.
export function normal(e) {
 if (!e.snapshot().flags['progress.tutorial_completed']) {const s=JSON.parse(e.save());s.flags['progress.tutorial_completed']=true;e.load(JSON.stringify(s));e.rewind();}
 if (['player.investigation','player.revival'].includes(e.interactions().nodeId)) finish(e);
}
export function permit(e) {
 normal(e);open(e,'guard.gossip');finish(e);finish(e);open(e,'relay.jiangwei_line');finish(e);
 open(e,'jiangwei_guard.arrival');finish(e);e.skipCurrentSegment();choose(e,'v07.request.good');finish(e);
}
export function collect(e) {permit(e);scoutEvidence(e);}
export const finishSuccess = e => {finish(e);finish(e);finish(e);};
export async function prepared(ignored=false, port=preset) {
 const e=new NarrativeEngine(chapter,'weiyan-test',preset);collect(e);
 e.enterScene('report_post');e.selectCharacter('weiyan');
 if(!e.tryPresentEvidence(['entry_notice']))throw Error('Second notice rejected');finish(e);
 const saved=e.save();const target=new NarrativeEngine(chapter,'weiyan-test',port);target.load(saved);return target;
}
export function input(e, ids=['scout_statement','jiangwei_authorization']) {
 for(const [i,id] of ids.entries()){if(!e.tryPresentEvidence([id]))throw Error(`Second evidence rejected: ${id}`);if(i<ids.length-1)finish(e);else e.skipCurrentSegment();}
}
