import { personalityNamespace } from './config.js';
import { coordinates, effectiveEvents, matchCharacters, validVector } from './model.js';
import type { AssessmentToken, ChapterId, ChapterLedger, DeathArchive, PersonalityCheckpoint, PersonalityConfig,
  PersonalityEvent, PersonalityState, PersonalityViewModel, RecordOutcome, StoreOptions, Vector } from './types.js';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const emptyVector = (): Vector => [null, null, null, null];
// A few observed directions may be shown, but one or two axes cannot name a whole personality.
const minimumResultAxes = 3;
const labels: Record<string, string> = { wuzhang: '第一章', grain: '第二章', jieting: '第三章' };
const outcome = (accepted: boolean, reason: string): RecordOutcome => ({ accepted, reason });
const safeId = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(s)
  && !['constructor', 'prototype', '__proto__'].includes(s);
const safeText = (s: unknown, limit = 8000): s is string => typeof s === 'string' && s.length <= limit
  && !/\bBearer\s+[A-Za-z0-9._~-]{12,}|\bsk-[A-Za-z0-9_-]{16,}|\bAKIA[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s);
const validInt = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
const blankState = (): PersonalityState => ({ schemaVersion: 1, ruleVersion: '', unlocked: false, chapters: {}, deaths: [], latestResult: null });

function readEvent(raw: any): PersonalityEvent | null {
  if (!raw || !safeId(raw.decisionId) || !safeId(raw.nodeId) || !validVector(raw.vector) || ![1, 2].includes(raw.weight)
    || !safeText(raw.text) || !safeText(raw.explanation) || !safeText(raw.at, 80) || !validInt(raw.version) || !validInt(raw.attempt)
    || !['choice', 'open'].includes(raw.kind) || !['pending', 'failed', 'ready', 'cancelled'].includes(raw.status)
    || !Array.isArray(raw.quotes) || raw.quotes.length !== 4
    || raw.quotes.some((q: unknown) => q !== null && (!safeText(q) || !raw.text.includes(q)))) return null;
  if (raw.kind === 'open' && raw.status === 'ready' && raw.vector.some((v: number | null, i: number) => v !== null && !raw.quotes[i])) return null;
  if (raw.status !== 'ready' && raw.vector.some((v: unknown) => v !== null)) return null;
  return { decisionId: raw.decisionId, nodeId: raw.nodeId,
    ...(safeId(raw.optionId) ? { optionId: raw.optionId } : {}), text: raw.text, explanation: raw.explanation,
    vector: [...raw.vector] as Vector, weight: raw.weight, quotes: [...raw.quotes], at: raw.at, assisted: raw.assisted === true,
    version: raw.version, attempt: raw.attempt, kind: raw.kind, status: raw.status };
}

function readChapter(raw: any): ChapterLedger | null {
  if (!raw || !validInt(raw.epoch) || !safeId(raw.runId) || !validInt(raw.revision) || !validInt(raw.attempt)
    || !validInt(raw.nextVersion) || typeof raw.tutorial !== 'boolean' || !['playing', 'finished'].includes(raw.status)
    || !(raw.endingId === null || safeId(raw.endingId)) || !Array.isArray(raw.events)) return null;
  const events = raw.events.map(readEvent);
  if (events.some((e: PersonalityEvent | null) => !e) || new Set(events.map((e: PersonalityEvent) => e.decisionId)).size !== events.length
    || events.some((e: PersonalityEvent) => e.version >= raw.nextVersion)) return null;
  return { epoch: raw.epoch, runId: raw.runId, revision: raw.revision, attempt: raw.attempt, nextVersion: raw.nextVersion,
    tutorial: raw.tutorial, status: raw.status, endingId: raw.endingId, events: raw.tutorial ? [] : events };
}

/** A separate player-level store. Never replace it with an embedded narrative save. */
export class PersonalityStore {
  private data: PersonalityState = blankState();
  private config: PersonalityConfig | null = null;
  private readonly namespace: string;
  private readonly storage: StoreOptions['storage'];
  private readonly now: () => string;
  private readonly newRunId: () => string;
  private storageAvailable = true;
  private readonly listeners = new Set<() => void>();

  constructor(options: StoreOptions = {}) {
    this.namespace = options.namespace ?? personalityNamespace();
    let storage = options.storage;
    if (storage === undefined) { try { storage = typeof localStorage === 'undefined' ? null : localStorage; } catch { storage = null; } }
    this.storage = storage;
    this.storageAvailable = storage !== null;
    this.now = options.now ?? (() => new Date().toISOString());
    this.newRunId = options.newRunId ?? (() => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID() : `run-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    try {
      const stored = storage?.getItem(this.namespace);
      if (stored) this.load(JSON.parse(stored));
    } catch { this.storageAvailable = false; }
  }

  private load(raw: any) {
    if (!raw || raw.schemaVersion !== 1 || typeof raw.ruleVersion !== 'string') return;
    const next = blankState(); next.ruleVersion = raw.ruleVersion; next.unlocked = raw.unlocked === true;
    for (const [key, value] of Object.entries(raw.chapters ?? {})) {
      const chapter = readChapter(value); if (safeId(key) && chapter) next.chapters[key] = chapter;
    }
    for (const d of Array.isArray(raw.deaths) ? raw.deaths : []) {
      const chapter = readChapter(d?.snapshot);
      if (!chapter || !safeId(d.chapterId) || !safeId(d.endingId) || !safeText(d.id, 600)
        || !safeText(d.title) || !safeText(d.text) || !safeText(d.at, 80) || !safeText(d.nodeId, 200)
        || d.snapshot.purpose !== 'death-history' || typeof d.snapshot.ruleVersion !== 'string') continue;
      next.deaths.push({ id: d.id, chapterId: d.chapterId, endingId: d.endingId, title: d.title,
        nodeId: d.nodeId, text: d.text, at: d.at, forced: d.endingId === 'tutorial-sacrifice',
        ...(safeText(d.characterName, 80) ? { characterName: d.characterName } : {}),
        snapshot: { ...chapter, schemaVersion: 1, purpose: 'death-history', ruleVersion: d.snapshot.ruleVersion, chapterId: d.chapterId } });
    }
    this.data = next;
  }

  configure(config: PersonalityConfig): void {
    this.config = copy(config);
    if (this.data.ruleVersion && this.data.ruleVersion !== config.version) {
      // Keep the unlock and read-only histories; old rules cannot seed new scores.
      for (const c of Object.values(this.data.chapters)) { c.events = []; c.revision++; c.nextVersion++; }
    }
    this.data.ruleVersion = config.version; this.changed();
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  getState(): PersonalityState { return copy(this.data); }

  private changed(): void {
    this.data.latestResult = null;
    if (this.config) {
      const profile = coordinates(this.data.chapters, this.config.model), first = matchCharacters(profile, this.config.characters)[0];
      if (first && profile.filter(a => a.observed).length >= minimumResultAxes)
        this.data.latestResult = { characterId: first.id, coordinates: profile.map(a => a.value) };
    }
    try { this.storage?.setItem(this.namespace, JSON.stringify(this.data)); } catch { this.storageAvailable = false; }
    for (const listener of this.listeners) { try { listener(); } catch { /* Rendering must not interrupt a confirmed game action. */ } }
  }

  startChapter(chapterId: ChapterId, options: { runId?: string; round?: number; tutorial?: boolean; legacy?: boolean } = {}): void {
    if (this.data.chapters[chapterId]) {
      if (chapterId === 'wuzhang' && options.round !== undefined && options.round > 1) this.finishTutorial(chapterId);
      return;
    }
    this.restartChapter(chapterId, options);
  }

  restartChapter(chapterId: ChapterId, options: { runId?: string; round?: number; tutorial?: boolean; legacy?: boolean } = {}): void {
    if (!safeId(chapterId)) throw new Error('Invalid chapter id');
    const old = this.data.chapters[chapterId], runId = options.runId ?? this.newRunId();
    if (!safeId(runId)) throw new Error('Invalid run id');
    this.data.chapters[chapterId] = { epoch: (old?.epoch ?? 0) + 1, runId, revision: 0, attempt: 1, nextVersion: 1,
      tutorial: options.tutorial ?? (chapterId === 'wuzhang' && options.round === 1), status: 'playing', endingId: null, events: [] };
    this.changed();
  }

  finishTutorial(chapterId = 'wuzhang'): void {
    const c = this.data.chapters[chapterId];
    if (c?.tutorial) { c.tutorial = false; c.events = []; c.revision++; c.attempt++; c.status = 'playing'; c.endingId = null; this.changed(); }
  }

  private chapter(chapterId: string): ChapterLedger {
    if (!safeId(chapterId)) throw new Error('Invalid chapter id');
    if (!this.data.chapters[chapterId]) this.startChapter(chapterId);
    return this.data.chapters[chapterId];
  }

  private put(chapterId: string, event: PersonalityEvent): void {
    const c = this.chapter(chapterId), index = c.events.findIndex(e => e.decisionId === event.decisionId);
    if (index >= 0) c.events[index] = event; else c.events.push(event);
    c.revision++; this.changed();
  }

  recordChoice(input: { chapterId: ChapterId; optionId: string; nodeId?: string; round?: number }): RecordOutcome {
    if (!this.config) return outcome(false, 'not-configured');
    const definition = this.config.choices.find(c => c.chapterId === input.chapterId && c.optionId === input.optionId
      && (input.nodeId === undefined || c.nodeId === input.nodeId));
    if (!definition) return outcome(false, 'unmapped-choice');
    const c = this.chapter(input.chapterId);
    if (c.tutorial || definition.tutorial || input.chapterId === 'wuzhang' && input.round === 1) return outcome(false, 'tutorial-excluded');
    if (c.status === 'finished') return outcome(false, 'chapter-finished');
    const previous = c.events.find(e => e.decisionId === definition.decisionId);
    if (previous?.optionId === input.optionId) return outcome(false, 'already-recorded');
    if (!definition.weight) {
      if (previous) { c.events = c.events.filter(e => e !== previous); c.revision++; this.changed(); }
      return outcome(false, 'unobserved');
    }
    this.put(input.chapterId, { decisionId: definition.decisionId, nodeId: definition.nodeId, optionId: input.optionId,
      text: definition.text, explanation: definition.reason, vector: [...definition.vector], weight: definition.weight,
      quotes: definition.vector.map(v => v === null ? null : definition.text), at: this.now(), assisted: false,
      version: c.nextVersion++, attempt: c.attempt, kind: 'choice', status: 'ready' });
    return outcome(true, 'recorded');
  }

  /** Persists the confirmed utterance before starting asynchronous assessment. */
  makeOpenToken(input: { chapterId: ChapterId; nodeId: string; input: string; round?: number; assisted?: boolean }): AssessmentToken | null {
    const definition = this.config?.openQuestions.find(o => o.chapterId === input.chapterId && o.nodeId === input.nodeId);
    if (!definition || !safeText(input.input) || !input.input.trim()) return null;
    const c = this.chapter(input.chapterId);
    if (c.tutorial || definition.tutorial || input.chapterId === 'wuzhang' && input.round === 1 || c.status === 'finished') return null;
    const event: PersonalityEvent = { decisionId: definition.decisionId, nodeId: definition.nodeId, text: input.input,
      explanation: '', vector: emptyVector(), weight: 2, quotes: [null, null, null, null], at: this.now(),
      assisted: input.assisted === true, version: c.nextVersion++, attempt: c.attempt, kind: 'open', status: 'pending' };
    this.put(input.chapterId, event);
    return this.tokenFor(input.chapterId, event);
  }

  private tokenFor(chapterId: string, event: PersonalityEvent): AssessmentToken {
    const c = this.data.chapters[chapterId];
    return { ruleVersion: this.data.ruleVersion, chapterId, nodeId: event.nodeId, decisionId: event.decisionId,
      epoch: c.epoch, runId: c.runId, decisionVersion: event.version, attempt: event.attempt, input: event.text };
  }

  private tokenEvent(token: AssessmentToken): PersonalityEvent | undefined {
    const c = this.data.chapters[token.chapterId];
    if (!c || c.tutorial || token.ruleVersion !== this.data.ruleVersion || token.epoch !== c.epoch || token.runId !== c.runId) return;
    return c.events.find(e => e.kind === 'open' && e.status !== 'cancelled' && e.decisionId === token.decisionId
      && e.nodeId === token.nodeId && e.version === token.decisionVersion && e.attempt === token.attempt && e.text === token.input);
  }

  recordOpen(input: { token: AssessmentToken; vector: Vector; quotes: (string | null)[]; assisted?: boolean }): RecordOutcome {
    const event = this.tokenEvent(input.token);
    if (!event) return outcome(false, 'stale-assessment');
    if (event.status === 'ready') return outcome(false, 'already-assessed');
    if (!validVector(input.vector) || !Array.isArray(input.quotes) || input.quotes.length !== 4
      || input.vector.some((v, i) => v !== null && (!safeText(input.quotes[i]) || !input.quotes[i] || !event.text.includes(input.quotes[i]!)))
      || input.quotes.some((q, i) => input.vector[i] === null && q !== null)) return outcome(false, 'unsupported-evidence');
    event.vector = [...input.vector]; event.quotes = [...input.quotes];
    // System-authored wording cannot stand as autonomous expression-style evidence.
    if (event.assisted || input.assisted) { event.assisted = true; event.vector[1] = null; event.quotes[1] = null; }
    event.status = 'ready'; this.data.chapters[input.token.chapterId].revision++; this.changed();
    return outcome(true, 'assessed');
  }

  markOpenFailure(token: AssessmentToken): RecordOutcome {
    const event = this.tokenEvent(token); if (!event || event.status === 'ready') return outcome(false, 'stale-assessment');
    event.status = 'failed'; this.changed(); return outcome(true, 'assessment-failed');
  }

  getPendingOpen(chapterId?: string): { token: AssessmentToken; input: string; nodeId: string; status: 'pending' | 'failed'; assisted: boolean }[] {
    return Object.entries(this.data.chapters).flatMap(([id, c]) => chapterId && chapterId !== id ? [] : c.events.flatMap(e =>
      e.kind === 'open' && (e.status === 'pending' || e.status === 'failed')
        ? [{ token: this.tokenFor(id, e), input: e.text, nodeId: e.nodeId, status: e.status, assisted: e.assisted }] : []));
  }

  invalidatePending(chapterId: string, decisionId?: string): void {
    const c = this.data.chapters[chapterId]; if (!c) return;
    let dirty = false;
    for (const e of c.events) if (e.kind === 'open' && e.status !== 'ready' && (!decisionId || e.decisionId === decisionId || e.nodeId === decisionId)) {
      e.status = 'cancelled'; e.vector = emptyVector(); e.quotes = [null, null, null, null]; dirty = true;
    }
    if (dirty) { c.revision++; this.changed(); }
  }

  createCheckpoint(chapterId: ChapterId): PersonalityCheckpoint {
    return { schemaVersion: 1, purpose: 'checkpoint', ruleVersion: this.data.ruleVersion, chapterId, ...copy(this.chapter(chapterId)) };
  }

  restoreCheckpoint(raw: unknown, chapterId?: ChapterId): RecordOutcome {
    const p = raw as PersonalityCheckpoint | undefined;
    if (!p || p.schemaVersion !== 1 || p.purpose !== 'checkpoint') {
      if (p?.purpose === 'death-history') return outcome(false, 'history-read-only');
      if (chapterId) this.restartChapter(chapterId);
      return outcome(false, 'legacy-without-personality');
    }
    const saved = readChapter(p), c = this.data.chapters[p.chapterId];
    if (!saved || !c || p.ruleVersion !== this.data.ruleVersion) return outcome(false, 'incompatible-checkpoint');
    if (p.epoch !== c.epoch || p.runId !== c.runId) return outcome(false, 'old-epoch');
    if (p.tutorial !== c.tutorial) return outcome(false, 'phase-mismatch');
    // Assessment fills a placeholder without changing its identity. Keep any newer answer assessment.
    if (p.events.length > c.events.length || p.events.some((e, i) => e.version !== c.events[i].version || e.decisionId !== c.events[i].decisionId
      || e.text !== c.events[i].text || e.optionId !== c.events[i].optionId)) return outcome(false, 'not-current-prefix');
    const rewound = p.events.length < c.events.length || c.status !== saved.status || c.endingId !== saved.endingId;
    c.events = c.events.slice(0, p.events.length); c.status = saved.status; c.endingId = saved.endingId;
    c.revision++; if (rewound) c.attempt++;
    this.changed(); return outcome(true, 'restored-prefix');
  }

  retryFromDecision(chapterId: ChapterId, decisionId: string): RecordOutcome {
    const c = this.chapter(chapterId), index = c.events.findIndex(e => e.decisionId === decisionId || e.nodeId === decisionId);
    if (index < 0) return outcome(false, 'decision-not-recorded');
    c.events = c.events.slice(0, index); c.revision++; c.attempt++; c.status = 'playing'; c.endingId = null;
    this.changed(); return outcome(true, 'retried');
  }

  completeChapter(chapterId: ChapterId, endingId: string): void {
    if (!safeId(endingId)) return;
    const c = this.chapter(chapterId);
    if (chapterId === 'grain') this.data.unlocked = true;
    if (c.status === 'finished' && c.endingId === endingId) return;
    c.status = 'finished'; c.endingId = endingId; c.revision++; this.changed();
  }

  /** Read-only historical record. Call when the ending is committed, before asynchronous video work. */
  archiveDeath(input: { chapterId: ChapterId; endingId: string; nodeId?: string; title?: string; text?: string }): RecordOutcome {
    if (!safeId(input.endingId) || !safeText(input.title ?? '') || !safeText(input.text ?? '') || !safeText(input.nodeId ?? '', 200)) return outcome(false, 'invalid-history');
    const c = this.chapter(input.chapterId), id = JSON.stringify([input.chapterId, c.epoch, c.runId, c.attempt, input.endingId]);
    if (this.data.deaths.some(d => d.id === id)) return outcome(false, 'already-archived');
    const matched = this.data.unlocked ? this.config?.characters.find(ch => ch.id === this.data.latestResult?.characterId) : undefined;
    const entry: DeathArchive = { id, chapterId: input.chapterId, endingId: input.endingId, title: input.title ?? input.endingId,
      nodeId: input.nodeId ?? '', text: input.text ?? '', at: this.now(), forced: input.endingId === 'tutorial-sacrifice',
      ...(matched ? { characterName: matched.name } : {}), snapshot: { ...this.createCheckpoint(input.chapterId), purpose: 'death-history' } };
    this.data.deaths.push(entry); this.changed(); return outcome(true, 'archived');
  }

  getView(): PersonalityViewModel {
    const config = this.config, profile = config ? coordinates(this.data.chapters, config.model) : [];
    const candidates = config ? matchCharacters(profile, config.characters) : [];
    const observedAxes = profile.filter(a => a.observed).length;
    const character = observedAxes >= minimumResultAxes ? config?.characters.find(c => c.id === candidates[0]?.id) : undefined;
    const unlocked = this.data.unlocked;
    const evidence = Object.entries(this.data.chapters).flatMap(([chapterId, c]) => effectiveEvents(c.events).filter(e => e.status === 'ready' && e.vector.some(v => v !== null)).map(e => {
      const active = e.vector.flatMap((v, i) => v === null ? [] : [i]);
      const quotes = [...new Set(active.map(i => e.quotes[i]).filter((q): q is string => !!q))];
      const definition = e.kind === 'choice'
        ? config?.choices.find(d => d.chapterId === chapterId && d.nodeId === e.nodeId && d.optionId === e.optionId)
        : config?.openQuestions.find(d => d.chapterId === chapterId && d.nodeId === e.nodeId);
      return { chapterId, chapterLabel: labels[chapterId] ?? chapterId, decisionId: e.decisionId, quote: quotes.join('；') || e.text,
        explanation: e.explanation || active.map(i => `${config?.axes[i].left}／${config?.axes[i].right}：${e.vector[i] === 0 ? '明确兼顾' : e.vector[i]! < 0 ? config?.axes[i].left : config?.axes[i].right}`).join('，'),
        axes: active.map(i => ['A', 'B', 'C', 'D'][i]),
        tendencies: active.map(i => e.vector[i] === 0 ? `${config?.axes[i].left}／${config?.axes[i].right}兼顾`
          : e.vector[i]! < 0 ? config?.axes[i].left ?? '' : config?.axes[i].right ?? ''),
        source: { kind: e.kind, nodeId: e.nodeId, ...(e.optionId ? { optionId: e.optionId } : {}),
          prompt: definition?.prompt ?? '', text: e.text, path: definition?.sourcePath } };
    })).reverse();
    return copy({ status: !unlocked ? 'locked' : character ? 'ready' : 'insufficient', unlocked, ready: unlocked && !!character,
      ...(unlocked && character ? { character } : {}), axes: (config?.axes ?? []).map((a, i) => ({ ...a,
        value: profile[i].observed ? profile[i].value : null, evidenceCount: profile[i].observations })),
      evidence, deathHistory: [...this.data.deaths].reverse().map(d => ({ id: d.id, chapterLabel: labels[d.chapterId] ?? d.chapterId,
        endingTitle: d.title, at: d.at, forced: d.forced, ...(d.characterName ? { characterName: d.characterName } : {}) })),
      candidates, completedChapters: Object.values(this.data.chapters).filter(c => c.status === 'finished').length,
      observedAxes, pendingCount: this.getPendingOpen().length, storageAvailable: this.storageAvailable });
  }
}

export const createPersonalityStore = (options: StoreOptions = {}): PersonalityStore => new PersonalityStore(options);
let defaultStore: PersonalityStore | undefined;
export const getPersonalityStore = (): PersonalityStore => defaultStore ??= createPersonalityStore();
export const getPersonalityViewModel = (): PersonalityViewModel => getPersonalityStore().getView();
