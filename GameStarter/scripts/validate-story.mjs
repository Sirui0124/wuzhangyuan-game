import { runTsc } from './run-tsc.mjs';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export function validateStory(chapter, { typecheck = true } = {}) {
  if (typecheck) {
    const dir = mkdtempSync(join(tmpdir(), 'narrative-type-'));
    try {
      writeFileSync(join(dir, 'check.ts'), `import type { Chapter } from ${JSON.stringify(join(root, 'content/schema/narrative'))};\nconst chapter: Chapter = ${JSON.stringify(chapter)};\n`);
      runTsc(['--noEmit', '--strict', '--target', 'ES2020', '--moduleResolution', 'node', join(dir, 'check.ts')], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) { throw new Error(`Canonical Chapter type check failed:\n${e.stdout || e.message}`); }
    finally { rmSync(dir, { recursive: true, force: true }); }
  }
  const errors = [], fail = m => errors.push(m);
  if (!chapter || chapter.schemaVersion !== 1) throw new Error('Unsupported chapter schema');
  const registries = {};
  for (const category of ['initialFlags','scenes','characters','evidence','dialogues','actions','promises','judges','events']) {
    if (!Array.isArray(chapter[category])) throw new Error(`Missing ${category}`);
    registries[category] = new Map();
    for (const value of chapter[category]) {
      if (!value.id || registries[category].has(value.id)) fail(`Duplicate/empty ${category} ID: ${value.id}`);
      registries[category].set(value.id, value);
    }
  }
  const ref = (category, id, where) => { if (!registries[category].has(id)) fail(`${where}: unknown ${category} ${id}`); };
  const validValue = (f,v) => typeof v === typeof f.initial && (!f.allowedValues || f.allowedValues.includes(v));
  const intents = new Set(chapter.judges.flatMap(j => j.acceptedIntentIds));
  for (const d of chapter.dialogues) { d.choices.forEach(c => intents.add(c.intentId)); d.freeInput?.intentOptions.forEach(i => intents.add(i.id)); }
  const condition = (c, where) => {
    if (!c || typeof c !== 'object') return fail(`${where}: invalid condition`);
    if ('all' in c || 'any' in c) {
      const list = c.all ?? c.any;
      if (!Array.isArray(list) || ('any' in c && !list.length)) return fail(`${where}: empty/invalid any`);
      list.forEach(x => condition(x,where));
    } else if ('not' in c) condition(c.not, where);
    else if ('flag' in c) { ref('initialFlags',c.flag,where); const f = registries.initialFlags.get(c.flag); if (f && !validValue(f,c.equals)) fail(`${where}: invalid flag comparison ${c.flag}`); }
    else if ('evidence' in c) { ref('evidence',c.evidence,where); if (!['held','presented'].includes(c.mode)) fail(`${where}: invalid evidence mode`); }
    else if ('intent' in c) { if (!intents.has(c.intent)) fail(`${where}: unknown intent ${c.intent}`); }
    else fail(`${where}: unknown condition`);
  };
  const effects = (list,where) => list.forEach(e => {
    if (e.type === 'setFlag') { ref('initialFlags',e.flag,where); const f = registries.initialFlags.get(e.flag); if (f && !validValue(f,e.value)) fail(`${where}: invalid flag value ${e.flag}`); }
    else if (e.type === 'grantEvidence') ref('evidence',e.evidenceId,where);
    else if (['startPromise','fulfillPromise','breakPromise'].includes(e.type)) ref('promises',e.promiseId,where);
    else fail(`${where}: unknown effect ${e.type}`);
  });
  const next = (id,where) => { if (id !== null) ref('dialogues',id,where); };
  // IDs may repeat only when identical lines are deliberately shared between fixed outcomes.
  const lineDefinitions = new Map();
  const lines = (list,where) => list.forEach(l => {
    const prior = lineDefinitions.get(l.id), serialized = JSON.stringify(l);
    if (prior && prior !== serialized) fail(`${where}: conflicting line ID ${l.id}`);
    lineDefinitions.set(l.id,serialized); ref('characters',l.speakerId,where);
    if (l.when) condition(l.when,where); effects(l.effects,where);
  });
  const outcome = (o,where) => { lines(o.reply,where); effects(o.effects,where); next(o.next,where); };
  ref('scenes',chapter.entrySceneId,'entry');
  if (chapter.restart) {
    for (const id of chapter.restart.preserveFlagIds) {
      ref('initialFlags',id,'restart');
      if (registries.initialFlags.get(id)?.scope !== 'progress') fail(`Restart can preserve only progress flags: ${id}`);
    }
    for (const key of ['afterNodeId','restartNodeId','revivalNodeId']) ref('dialogues',chapter.restart[key],'restart');
  }
  for (const id of chapter.readOnlyCheckpointNodeIds ?? []) {
    ref('dialogues',id,'read-only checkpoint');
    const d = registries.dialogues.get(id);
    if (d && (d.freeInput || d.onComplete.length || d.next || d.lines.some(l => l.effects.length) ||
        d.choices.some(c => c.actionId || c.outcome.effects.length || c.outcome.next || c.outcome.reply.some(l => l.effects.length))))
      fail(`Checkpoint must be read-only: ${id}`);
  }
  for (const f of chapter.initialFlags) {
    if (!f.id.startsWith(`${f.scope}.`) || !validValue(f,f.initial)) fail(`Invalid flag registration ${f.id}`);
    if (f.scope === 'memory' && f.owner !== 'player') fail(`NPC memory cannot survive rewind: ${f.id}`);
    if (f.owner !== 'player') ref('characters',f.owner,f.id);
  }
  for (const s of chapter.scenes) { condition(s.visibleWhen,s.id); condition(s.enterWhen,s.id); }
  for (const a of chapter.characters) {
    condition(a.visibleWhen,a.id); condition(a.talkWhen,a.id);
    for (const p of a.placements) { ref('scenes',p.sceneId,a.id); condition(p.when,a.id); }
  }
  for (const d of chapter.dialogues) {
    ref('scenes',d.sceneId,d.id); ref('characters',d.characterId,d.id); condition(d.availableWhen,d.id);
    const actor = registries.characters.get(d.characterId);
    if (d.trigger !== 'event' && actor && !actor.placements.some(p => p.sceneId === d.sceneId)) fail(`${d.id}: actor never placed in scene`);
    if (d.choices.length && d.freeInput) fail(`${d.id}: choose either choices or freeInput`);
    if ((d.choices.length || d.freeInput) && (d.onComplete.length || d.next)) fail(`${d.id}: branching node cannot have linear completion`);
    lines(d.lines,d.id); effects(d.onComplete,d.id); next(d.next,d.id);
    const choiceIds = new Set();
    for (const c of d.choices) {
      if (choiceIds.has(c.id)) fail(`${d.id}: duplicate choice ${c.id}`); choiceIds.add(c.id);
      condition(c.visibleWhen,d.id); condition(c.enabledWhen,d.id);
      if (c.actionId) ref('actions',c.actionId,d.id); outcome(c.outcome,d.id);
    }
    if (d.freeInput) {
      const input = d.freeInput; ref('judges',input.judgeId,d.id);
      if (!Number.isInteger(input.maxLength) || input.maxLength < 1) fail(`${d.id}: invalid maxLength`);
      for (const o of Object.values(input.outcomes)) outcome(o,d.id);
      const judge = registries.judges.get(input.judgeId);
      if (judge && input.intentOptions.some(i => !judge.acceptedIntentIds.includes(i.id))) fail(`${d.id}: unaccepted intent option`);
    }
  }
  for (const a of chapter.actions) { condition(a.availableWhen,a.id); effects(a.effects,a.id); next(a.next,a.id); }
  for (const p of chapter.promises) {
    p.requiredActionIds.forEach(id => ref('actions',id,p.id)); condition(p.completedWhen,p.id); effects(p.brokenEffects,p.id);
    if (!Number.isInteger(p.delayBudget) || p.delayBudget < 1) fail(`${p.id}: invalid delayBudget`);
  }
  // Recursive breakPromise effects would recurse even though world events are once per loop.
  const breaking = new Set(), done = new Set();
  const checkBreak = id => {
    if (breaking.has(id)) return fail(`Recursive brokenEffects ${id}`);
    if (done.has(id)) return;
    breaking.add(id);
    registries.promises.get(id)?.brokenEffects.filter(e => e.type === 'breakPromise').forEach(e => checkBreak(e.promiseId));
    breaking.delete(id); done.add(id);
  };
  chapter.promises.forEach(p => checkBreak(p.id));
  for (const j of chapter.judges) for (const c of j.acceptanceCases) { condition(c.when,j.id); outcome(c.outcome,j.id); }
  for (const e of chapter.events) { condition(e.when,e.id); effects(e.effects,e.id); next(e.next,e.id); }
  // Exact duplicate gates with equal priorities are deterministic authoring errors.
  const gates = new Set();
  for (const d of chapter.dialogues) {
    const key = JSON.stringify([d.sceneId,d.characterId,d.topicId,d.trigger,d.priority,d.availableWhen]);
    if (gates.has(key)) fail(`${d.id}: identical competing topic gate`); gates.add(key);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { chapterId: chapter.id, nodes: chapter.dialogues.length, actions: chapter.actions.length,
    note: 'Structure/references validated; dynamic reachability and authority require route tests.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = resolve(process.argv[2] || join(root,'content/chapters/wuzhang/chapter.json'));
  try { console.log(JSON.stringify(validateStory(JSON.parse(readFileSync(file,'utf8'))),null,2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
