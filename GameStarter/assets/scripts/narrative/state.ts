import type { Chapter, Value, JudgeResult } from '../../../../content/schema/narrative';
export interface PromiseState {
    id: string; actorId: string; startedEvent: string;
    status: 'pending' | 'fulfilled' | 'broken'; actions: string[]; delays: number;
}
export interface HistoryEvent {
    id: string; loopId: string; revision: number; actorId: string | null;
    kind: string; target: string; evidenceIds: string[]; changes: Record<string, Value>;
}
export interface RuntimeState {
    schemaVersion: 1; chapterId: string; contentVersion: string; loopId: string; revision: number;
    checkpointNodeId?: string;
    presentation?: { actorId: string; sceneId: string; evidenceIds: string[] };
    sceneId: string; flags: Record<string, Value>;
    evidence: Record<string, { loopId: string; nodeId: string; sourceEvent: string }>;
    promises: Record<string, PromiseState>; visited: string[]; visitedEver: string[];
    committed: string[]; actions: string[]; firedEvents: string[];
    history: HistoryEvent[]; feedback: Record<string, JudgeResult>; seenMedia: string[]; drafts: Record<string, string>;
}
let serial = 0;
export function uniqueId(prefix: string): string { return `${prefix}-${Date.now()}-${++serial}`; }
export function createState(chapter: Chapter, contentVersion: string): RuntimeState {
    return { schemaVersion: 1, chapterId: chapter.id, contentVersion, loopId: uniqueId('loop'), revision: 0,
        sceneId: chapter.entrySceneId, flags: Object.fromEntries(chapter.initialFlags.map(f => [f.id, f.initial])),
        evidence: {}, promises: {}, visited: [], visitedEver: [], committed: [], actions: [], firedEvents: [],
        history: [], feedback: {}, seenMedia: [], drafts: {} };
}
export function cloneState(state: RuntimeState): RuntimeState { return JSON.parse(JSON.stringify(state)); }
export function rewindState(chapter: Chapter, old: RuntimeState): RuntimeState {
    const fresh = createState(chapter, old.contentVersion);
    if (chapter.restart) {
        for (const id of chapter.restart.preserveFlagIds) fresh.flags[id] = old.flags[id];
        fresh.revision = old.revision + 1;
        return fresh;
    }
    for (const f of chapter.initialFlags) if (f.scope === 'memory') fresh.flags[f.id] = old.flags[f.id];
    fresh.history = old.history; fresh.visitedEver = old.visitedEver; fresh.seenMedia = old.seenMedia;
    fresh.drafts = old.drafts; fresh.revision = old.revision + 1;
    return fresh;
}
export function validateState(chapter: Chapter, contentVersion: string, value: unknown): RuntimeState {
    if (!value || typeof value !== 'object') throw new Error('Invalid save');
    const s = value as RuntimeState;
    // Retire the prototype's NPC memory, including when loading an older stable save.
    delete (s as RuntimeState & { npcIssues?: unknown }).npcIssues;
    if (s.schemaVersion !== 1 || s.chapterId !== chapter.id || s.contentVersion !== contentVersion) throw new Error('Incompatible save version');
    if (!Number.isInteger(s.revision) || s.revision < 0 || typeof s.loopId !== 'string' || !s.loopId ||
        !chapter.scenes.some(x => x.id === s.sceneId)) throw new Error('Invalid save identity');
    if (s.checkpointNodeId !== undefined && (!([...(chapter.readOnlyCheckpointNodeIds ?? []), 'weiyan.negotiate', 'tutorial.weiyan.negotiate'].includes(s.checkpointNodeId)) ||
        !chapter.dialogues.some(n => n.id === s.checkpointNodeId && n.sceneId === s.sceneId))) throw new Error('Invalid saved checkpoint');
    for (const key of ['visited', 'visitedEver', 'committed', 'actions', 'firedEvents', 'seenMedia']) {
        const list = s[key as keyof RuntimeState];
        if (!Array.isArray(list) || list.some(x => typeof x !== 'string')) throw new Error(`Invalid save ${key}`);
    }
    if (!Array.isArray(s.history) || !s.flags || !s.evidence || !s.promises || !s.drafts || !s.feedback) throw new Error('Invalid save records');
    if (Object.keys(s.flags).length !== chapter.initialFlags.length) throw new Error('Unknown saved flags');
    for (const f of chapter.initialFlags) {
        const v = s.flags[f.id];
        if (typeof v !== typeof f.initial || (f.allowedValues && !f.allowedValues.includes(v))) throw new Error(`Invalid saved flag ${f.id}`);
    }
    for (const [id, e] of Object.entries(s.evidence)) {
        if (!chapter.evidence.some(x => x.id === id) || e.loopId !== s.loopId || typeof e.nodeId !== 'string' || typeof e.sourceEvent !== 'string') throw new Error('Invalid saved evidence');
    }
    if (s.presentation) {
        const p = s.presentation;
        if (!chapter.characters.some(a => a.id === p.actorId) || p.sceneId !== s.sceneId ||
            !Array.isArray(p.evidenceIds) || !p.evidenceIds.length || new Set(p.evidenceIds).size !== p.evidenceIds.length ||
            p.evidenceIds.some(id => s.evidence[id]?.loopId !== s.loopId)) throw new Error('Invalid saved presentation');
    }
    for (const [id, p] of Object.entries(s.promises)) {
        const def = chapter.promises.find(x => x.id === id);
        if (!def || p.id !== id || !['pending', 'fulfilled', 'broken'].includes(p.status) ||
            !Array.isArray(p.actions) || p.actions.some(a => !chapter.actions.some(x => x.id === a)) ||
            !Number.isInteger(p.delays) || p.delays < 0 || typeof p.actorId !== 'string') throw new Error('Invalid saved promise');
    }
    for (const [key, ids, registered] of [
        ['visited', s.visited, chapter.dialogues], ['visitedEver', s.visitedEver, chapter.dialogues],
        ['actions', s.actions, chapter.actions], ['firedEvents', s.firedEvents, chapter.events],
    ] as const) if (ids.some(id => !registered.some(x => x.id === id))) throw new Error(`Unknown saved ${key}`);
    if (Object.values(s.drafts).some(x => typeof x !== 'string') || s.history.some(e =>
        !e || typeof e.id !== 'string' || typeof e.loopId !== 'string' || !Number.isInteger(e.revision) ||
        !Array.isArray(e.evidenceIds) || !e.changes || typeof e.kind !== 'string')) throw new Error('Invalid save history');
    return cloneState(s);
}
