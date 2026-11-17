import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export async function dialogueFixtures(buildRoot) {
 const {ChapterSession}=await import(pathToFileURL(resolve(buildRoot,'GameStarter/web-demo/src/chapter-session.js')));
 const content=JSON.parse(readFileSync(resolve(buildRoot,'story/chapter-one.script.json'))),flow=JSON.parse(readFileSync(resolve(buildRoot,'story/chapter-one.flow.json')));
 const version=JSON.parse(readFileSync(resolve(buildRoot,'story/session-manifest.json'))).contentVersion;
 const read=s=>{let n=0;while(s.snapshot().phase==='dialogue'&&n++<200)s.nextLine();assert.ok(n<200);};
 const act=(s,id)=>{const a=flow.actions.find(a=>a.id===id);if(s.snapshot().scene!==a.scene)s.move(a.scene);assert.ok(s.act(id));read(s);};
 function first(judge,generate,branch='a') {const s=new ChapterSession(content,flow,version,judge,generate);s.finishCinematic();read(s);act(s,'read-notice');act(s,'meet-first-scout');s.chooseScout(branch);read(s);act(s,'intercept-first');return s;}
 // Setup judgments are explicit fixtures; the caller's judge only handles the requested stage.
 const setupJudge=async input=>({schemaVersion:1,npcId:'weiyan',stage:input.stage,classification:{code:'ok',disposition:'accept',reason:'测试准备：已明确立即转呈。',evidenceIds:[]},reply:{speaker:'魏延',text:'好，你即刻转呈，莫误军情。'}});
 async function thoughts(){const s=first(setupJudge);s.setDraft('将军，敌军尚未攻营，还不必强闯。帐内确实不许进入，我现在替您转呈，绝不耽误军情。');assert.ok(await s.confirmExpression());assert.ok(s.acknowledgeReply());read(s);act(s,'deliver-first');act(s,'stand-watch');s.finishCinematic();read(s);assert.ok(s.rewind());read(s);['ask-guard','ask-relay','ask-scout'].forEach(id=>act(s,id));assert.ok(s.beginThinking());return s;}
 async function authorized(judge,generate){const s=await thoughts();s.think();s.continueThought();s.placeThought('C06');s.placeThought('C07');s.think();assert.ok(s.followPlan());read(s);act(s,'intercept-weiyan');const ready=new ChapterSession(content,flow,version,judge,generate);ready.restore(s.serialize());return ready;}
 async function polishInput(stage,selected,focus,branch='a') {let input;const generator=async data=>{input=data;return {text:'测试预览',evidenceIds:[data.brief.selectedEvidence[0].id]};};const s=stage==='first'?first(undefined,generator,branch):await authorized(undefined,generator);for(const id of [...s.snapshot().story.selected])s.selectEvidence(id);selected.forEach(id=>s.selectEvidence(id));s.setFocus(focus);await s.generateExpression();return input;}
 return {ChapterSession,content,flow,version,first,thoughts,authorized,polishInput,read,act};
}
