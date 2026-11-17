/**
 * Design-only personality persistence model. Nothing here reads browser storage,
 * calls AI, or changes a live game. Callers supply IDs and timestamps so every
 * operation is deterministic and JSON-serializable.
 *
 * Only the latest chapter ledgers contribute to a result. Death snapshots are
 * immutable, read-only history; loading them is deliberately not an API here.
 */
import { createHash } from 'node:crypto';

const AXES = 4;
const forbiddenKey = /api[-_]?key|access[-_]?token|refresh[-_]?token|authorization|cookie|password|secret|credential/i;
const credentialText = /\bBearer\s+[A-Za-z0-9._~-]{12,}|\bsk-[A-Za-z0-9_-]{16,}|\bAKIA[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const hash = value => createHash('sha256').update(value).digest('hex');
const copy = value => structuredClone(value);
const own = (value, key) => Object.hasOwn(value, key);
function frozen(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
function id(value, label = 'id') {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value)
    || ['constructor', 'prototype', '__proto__'].includes(value)) throw new TypeError(`Invalid ${label}`);
  return value;
}
function text(value, label, limit = 4000) {
  if (typeof value !== 'string' || value.length > limit || credentialText.test(value)) throw new TypeError(`Invalid or credential-bearing ${label}`);
  return value;
}
function fields(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid ${label}`);
  for (const key of Object.keys(value)) {
    if (forbiddenKey.test(key) || !allowed.includes(key)) throw new TypeError(`Unsupported ${label} field: ${key}`);
  }
}
function timestamp(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new TypeError('Invalid timestamp');
  return value;
}
function vector(value, coordinates = false) {
  if (!Array.isArray(value) || value.length !== AXES || Array.from(value).some(n => coordinates
    ? typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100
    : n !== null && (!Number.isInteger(n) || n < -2 || n > 2))) throw new TypeError('Invalid four-dimensional vector');
  return [...value];
}
function chapter(store, chapterId) {
  id(chapterId, 'chapterId');
  if (!own(store.chapters, chapterId)) throw new Error(`Chapter has not started: ${chapterId}`);
  return store.chapters[chapterId];
}
function changed(store, chapterId, nextChapter) {
  return frozen({ ...copy(store), chapters: { ...copy(store.chapters), [chapterId]: nextChapter }, latestResult: null });
}
const outcome = (store, accepted, reason) => ({ store, accepted, reason });

export function createStore(ruleVersion = 'personality-design-v1') {
  return frozen({ schemaVersion: 1, ruleVersion: id(ruleVersion, 'ruleVersion'), chapters: {}, latestResult: null, deaths: [] });
}

/** Restart replaces this chapter only. Old manual saves cannot reset its epoch. */
export function restartChapter(store, { chapterId, runId, at = null, tutorial = false }) {
  id(chapterId, 'chapterId'); id(runId, 'runId');
  if (typeof tutorial !== 'boolean') throw new TypeError('Invalid tutorial flag');
  const old = own(store.chapters, chapterId) ? store.chapters[chapterId] : null;
  if (old?.runId === runId) throw new Error('Restart requires a fresh runId');
  return changed(store, chapterId, { epoch: (old?.epoch ?? 0) + 1, runId, revision: 0, attempt: 1,
    tutorial, status: 'playing', endingId: null, events: [], updatedAt: timestamp(at) });
}

/** The forced first death is history only; the following playable phase starts clean. */
export function finishTutorial(store, chapterId, at = null) {
  const old = chapter(store, chapterId);
  if (!old.tutorial) return store;
  return changed(store, chapterId, { ...copy(old), tutorial: false, events: [], revision: old.revision + 1,
    attempt: old.attempt + 1, status: 'playing', endingId: null, updatedAt: timestamp(at) });
}

export function makeAssessmentToken(store, chapterId, { decisionId, input }) {
  const current = chapter(store, chapterId);
  return frozen({ ruleVersion: store.ruleVersion, chapterId, epoch: current.epoch, runId: current.runId, revision: current.revision,
    attempt: current.attempt, decisionId: id(decisionId, 'decisionId'), inputHash: hash(text(input, 'confirmed input')) });
}

/** Editing a submitted answer, cancelling, or switching modes retires pending receipts. */
export function invalidateAssessments(store, chapterId) {
  const current = chapter(store, chapterId);
  return changed(store, chapterId, { ...copy(current), revision: current.revision + 1 });
}

function cleanEvent(event) {
  fields(event, ['decisionId', 'optionId', 'input', 'references', 'vector', 'weight', 'at', 'tutorial'], 'event');
  const result = { decisionId: id(event.decisionId, 'decisionId'), vector: vector(event.vector), weight: event.weight,
    at: timestamp(event.at), references: [] };
  if (![1, 2].includes(result.weight)) throw new TypeError('Invalid event weight');
  if (event.optionId != null) result.optionId = id(event.optionId, 'optionId');
  if (event.input != null) result.input = text(event.input, 'confirmed input');
  if (event.references != null) {
    if (!Array.isArray(event.references) || event.references.length > 20) throw new TypeError('Invalid event references');
    result.references = event.references.map(reference => {
      fields(reference, ['sourceId', 'quote'], 'reference');
      return { sourceId: id(reference.sourceId, 'sourceId'), quote: text(reference.quote, 'source quote') };
    });
  }
  return result;
}

/** A changed answer must first rewind its decision; retries never add a second copy. */
export function commitEvent(store, { chapterId, event, token = null }) {
  const current = chapter(store, chapterId);
  if (current.tutorial || event?.tutorial === true) return outcome(store, false, 'tutorial-excluded');
  const clean = cleanEvent(event);
  if (own(clean, 'input') && !token) return outcome(store, false, 'assessment-token-required');
  if (token && (token.ruleVersion !== store.ruleVersion || token.chapterId !== chapterId || token.epoch !== current.epoch || token.runId !== current.runId
    || token.revision !== current.revision || token.attempt !== current.attempt || token.decisionId !== clean.decisionId
    || token.inputHash !== hash(clean.input ?? ''))) return outcome(store, false, 'stale-assessment');
  if (current.status !== 'playing') return outcome(store, false, 'chapter-finished');
  if (current.events.some(e => e.decisionId === clean.decisionId)) return outcome(store, false, 'decision-already-committed');
  if (clean.vector.every(n => n === null)) return outcome(store, false, 'unobserved');
  return outcome(changed(store, chapterId, { ...copy(current), events: [...copy(current.events), clean],
    revision: current.revision + 1, updatedAt: clean.at }), true, 'committed');
}

export function completeChapter(store, chapterId, endingId, at = null) {
  const current = chapter(store, chapterId); id(endingId, 'endingId');
  if (current.status === 'finished' && current.endingId === endingId) return store;
  return changed(store, chapterId, { ...copy(current), status: 'finished', endingId,
    revision: current.revision + 1, updatedAt: timestamp(at) });
}

export function createCheckpoint(store, chapterId) {
  return frozen({ schemaVersion: 1, purpose: 'checkpoint', ruleVersion: store.ruleVersion, chapterId, ...copy(chapter(store, chapterId)) });
}

/**
 * Restore only a genuine prefix of the current personality run. A legacy/old-run
 * narrative save can still be loaded by an adapter, but it cannot supply scores.
 */
export function restoreCheckpoint(store, checkpoint, at = null) {
  if (checkpoint?.purpose === 'death-history') return outcome(store, false, 'history-read-only');
  if (!checkpoint || checkpoint.schemaVersion !== 1 || !checkpoint.chapterId) return outcome(store, false, 'legacy-without-personality');
  if (checkpoint.purpose !== 'checkpoint') return outcome(store, false, 'legacy-without-personality');
  const current = chapter(store, checkpoint.chapterId);
  if (checkpoint.ruleVersion !== store.ruleVersion) return outcome(store, false, 'rule-version-mismatch');
  if (checkpoint.epoch !== current.epoch || checkpoint.runId !== current.runId) return outcome(store, false, 'old-epoch');
  if (!['playing', 'finished'].includes(checkpoint.status) || typeof checkpoint.tutorial !== 'boolean'
    || (checkpoint.status === 'playing' && checkpoint.endingId !== null)
    || (checkpoint.status === 'finished' && typeof checkpoint.endingId !== 'string')) return outcome(store, false, 'invalid-checkpoint');
  if (checkpoint.endingId !== null) id(checkpoint.endingId, 'endingId');
  if (!Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0 || checkpoint.revision > current.revision
    || !Array.isArray(checkpoint.events) || checkpoint.events.length > current.events.length
    || checkpoint.events.some((e, i) => JSON.stringify(e) !== JSON.stringify(current.events[i]))) return outcome(store, false, 'not-current-prefix');
  if (checkpoint.tutorial !== current.tutorial) return outcome(store, false, 'phase-mismatch');
  const restoredEvents = checkpoint.events.map(cleanEvent);
  return outcome(changed(store, checkpoint.chapterId, { ...copy(current), events: restoredEvents,
    status: checkpoint.status, endingId: checkpoint.endingId, revision: current.revision + 1,
    attempt: current.attempt + 1, updatedAt: timestamp(at) }), true, 'restored-prefix');
}

/** The selected decision and everything after it are replaced on the next attempt. */
export function retryFromDecision(store, chapterId, decisionId, at = null) {
  const current = chapter(store, chapterId); id(decisionId, 'decisionId');
  const index = current.events.findIndex(e => e.decisionId === decisionId);
  if (index < 0) return outcome(store, false, 'decision-not-recorded');
  return outcome(changed(store, chapterId, { ...copy(current), events: copy(current.events.slice(0, index)),
    status: 'playing', endingId: null, revision: current.revision + 1, attempt: current.attempt + 1,
    updatedAt: timestamp(at) }), true, 'retried');
}

function cleanStorySnapshot(value) {
  fields(value, ['nodeId', 'phase', 'round', 'visited', 'chosen', 'transcript'], 'story snapshot');
  const result = { nodeId: id(value.nodeId, 'nodeId') };
  if (value.phase != null) result.phase = id(value.phase, 'phase');
  if (value.round != null) {
    if (!Number.isSafeInteger(value.round) || value.round < 0) throw new TypeError('Invalid round');
    result.round = value.round;
  }
  for (const key of ['visited', 'chosen']) if (value[key] != null) {
    if (!Array.isArray(value[key])) throw new TypeError(`Invalid ${key}`);
    result[key] = value[key].map(item => id(item, key));
  }
  if (value.transcript != null) {
    if (!Array.isArray(value.transcript)) throw new TypeError('Invalid transcript');
    result.transcript = value.transcript.map(line => {
      fields(line, ['speaker', 'text'], 'transcript line');
      return { speaker: text(line.speaker, 'speaker', 80), text: text(line.text, 'dialogue line') };
    });
  }
  return result;
}

/** Death history never invalidates a valid current result or adds a scored event. */
export function archiveDeath(store, { chapterId, endingId, storySnapshot, at = null }) {
  const current = chapter(store, chapterId); id(endingId, 'endingId');
  const deathId = hash(JSON.stringify([chapterId, current.epoch, current.runId, current.attempt, endingId]));
  if (store.deaths.some(d => d.deathId === deathId)) return outcome(store, false, 'already-archived');
  const death = { deathId, chapterId, epoch: current.epoch, runId: current.runId, attempt: current.attempt,
    endingId, forced: endingId === 'tutorial-sacrifice', occurredAt: timestamp(at),
    storySnapshot: cleanStorySnapshot(storySnapshot),
    personalitySnapshot: { ...createCheckpoint(store, chapterId), purpose: 'death-history' } };
  return outcome(frozen({ ...copy(store), deaths: [...copy(store.deaths), death] }), true, 'archived');
}

/** Fingerprint guards the single cached result against restart/read/retry races. */
export function makeResultToken(store) {
  return hash(JSON.stringify({ ruleVersion: store.ruleVersion, chapters: Object.keys(store.chapters).sort().map(key => {
    const c = store.chapters[key]; return [key, c.epoch, c.runId, c.revision, c.attempt];
  }) }));
}

export function setLatestResult(store, result, token) {
  if (token !== makeResultToken(store)) return outcome(store, false, 'stale-result');
  fields(result, ['characterId', 'coordinates', 'evidence', 'computedAt'], 'result');
  const evidence = (result.evidence ?? []).map(reference => {
    fields(reference, ['chapterId', 'decisionId'], 'result evidence');
    const c = chapter(store, reference.chapterId); id(reference.decisionId, 'decisionId');
    if (!c.events.some(e => e.decisionId === reference.decisionId)) throw new Error('Result evidence is not current');
    return { chapterId: reference.chapterId, decisionId: reference.decisionId };
  });
  const latestResult = { characterId: id(result.characterId, 'characterId'), coordinates: vector(result.coordinates, true),
    evidence, computedAt: timestamp(result.computedAt), sourceToken: token };
  return outcome(frozen({ ...copy(store), latestResult }), true, 'result-updated');
}
