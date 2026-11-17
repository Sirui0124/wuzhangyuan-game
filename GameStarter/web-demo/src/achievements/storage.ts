import { freshCollection, unlockEnding, type EndingCollection } from '../endings';
import { extraAchievementIds } from './catalog';

export const ACHIEVEMENTS_KEY = 'wuzhang-achievements-v1';
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;
export function readAchievements(storage: StorageAccess = localStorage): EndingCollection {
    const raw = storage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return freshCollection();
    const saved = JSON.parse(raw) as EndingCollection;
    if (saved?.schemaVersion !== 1 || !saved.unlocked || typeof saved.unlocked !== 'object' || Array.isArray(saved.unlocked)) throw new Error('成就记录暂不可读');
    for (const [id, row] of Object.entries(saved.unlocked)) {
        if (!extraAchievementIds.has(id) || !row || !Number.isFinite(Date.parse(row.firstUnlockedAt)) || typeof row.lastLoopId !== 'string' || !Number.isInteger(row.times) || row.times < 1
            || (row.runs !== undefined && (!Array.isArray(row.runs) || row.runs.some(run => typeof run !== 'string')))) throw new Error('成就记录暂不可读');
    }
    return saved;
}
/** Call only after local gameplay has committed. Looking at a card never awards it. */
export function recordAchievements(ids: string[], run: string, storage: StorageAccess = localStorage, earnedAt?: string): boolean {
    try {
        let collection = readAchievements(storage), changed = false;
        for (const id of ids) {
            const previous = collection.unlocked[id];
            if (!extraAchievementIds.has(id) || previous?.lastLoopId === run || previous?.runs?.includes(run)) continue;
            const existed = !!previous;
            collection = unlockEnding(collection, { id }, run);
            collection.unlocked[id].runs = [...(previous?.runs ?? (previous ? [previous.lastLoopId] : [])), run];
            if (!existed && earnedAt && Number.isFinite(Date.parse(earnedAt))) collection.unlocked[id].firstUnlockedAt = earnedAt;
            changed = true;
        }
        if (changed) storage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(collection));
        return true;
    } catch { return false; } // A broken archive never blocks narrative saving or overwrites its original record.
}

export function mergeAchievements(legacy: EndingCollection, storage: StorageAccess = localStorage): EndingCollection {
    return { schemaVersion: 1, unlocked: { ...legacy.unlocked, ...readAchievements(storage).unlocked } };
}

/** Recover only recorded terminal outcomes, not guesses from chapter completion flags. */
export function recoverLegacyAchievements(grain: { version: string; nodes: { id: string; kind: string; ending?: string }[] }, storage: StorageAccess = localStorage) {
    try {
        const saved = JSON.parse(storage.getItem('grain-chapter-two-films-v1') ?? 'null');
        const node = grain.nodes.find(n => n.id === saved?.node && n.kind === 'finish' && n.ending);
        if (saved?.version === grain.version && node && Array.isArray(saved.visited) && Number.isFinite(saved.run)) recordAchievements([`grain-${node.ending}`], `grain:${saved.run}`, storage);
        const old = JSON.parse(storage.getItem('jieting-chapter-three-v1:endings') ?? '{}');
        let current: { ending?: string; run?: number } | null = null;
        try { current = JSON.parse(storage.getItem('jieting-chapter-three-v1') ?? 'null'); } catch { /* Ledger remains recoverable without the current save. */ }
        for (const [id, at] of Object.entries(old)) {
            const key = `jieting-${id}`;
            if (!extraAchievementIds.has(key) || (typeof at !== 'number' && typeof at !== 'string')) continue;
            const date = new Date(at);
            const run = current?.ending === id && Number.isFinite(current.run) ? `jieting:${current.run}` : `legacy:jieting:${id}`;
            if (Number.isFinite(date.getTime()) && !readAchievements(storage).unlocked[key]) recordAchievements([key], run, storage, date.toISOString());
        }
    } catch { /* Old chapter records are retained for future recovery. */ }
}
