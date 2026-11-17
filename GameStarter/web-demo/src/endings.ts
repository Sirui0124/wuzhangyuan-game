import type { Condition } from '../../../content/schema/narrative';
import type { RuntimeState } from '../../assets/scripts/narrative/state';
import { evaluate, emptyContext } from '../../assets/scripts/narrative/conditions';

export type Ending = { id: string; number: string; phase: string; result: string; when?: Condition; title: string; description: string; hint: string; kind: string; note?: string; chapter?: string; category?: 'ending' | 'milestone'; emblem?: string };
export type EndingCatalog = { schemaVersion: 1; chapterId: string; endings: Ending[] };
export type EndingCollection = { schemaVersion: 1; unlocked: Record<string, { firstUnlockedAt: string; lastLoopId: string; times: number; runs?: string[] }> };
export const ENDINGS_KEY = 'wuzhang-endings-v1';
export const freshCollection = (): EndingCollection => ({ schemaVersion: 1, unlocked: {} });
export function endingFor(catalog: EndingCatalog, state: RuntimeState): Ending | null {
    const matches = catalog.endings.filter(e => e.result === state.flags['loop.result'] && (!e.when || evaluate(e.when, state, emptyContext())));
    if (matches.length > 1) throw new Error('Ambiguous ending definition');
    return matches[0] ?? null;
}
export function unlockEnding(collection: EndingCollection, ending: Pick<Ending, 'id'>, loopId: string): EndingCollection {
    const old = collection.unlocked[ending.id];
    if (old?.lastLoopId === loopId) return collection;
    return { schemaVersion: 1, unlocked: { ...collection.unlocked, [ending.id]: { firstUnlockedAt: old?.firstUnlockedAt ?? new Date().toISOString(), lastLoopId: loopId, times: (old?.times ?? 0) + 1 } } };
}
export function parseCollection(raw: string | null, catalog: EndingCatalog): EndingCollection {
    if (!raw) return freshCollection();
    const value = JSON.parse(raw);
    if (value?.schemaVersion !== 1 || !value.unlocked || typeof value.unlocked !== 'object' || Array.isArray(value.unlocked)) throw new Error('Invalid ending collection');
    for (const [id, row] of Object.entries(value.unlocked) as [string, { firstUnlockedAt: string; lastLoopId: string; times: number }][]) {
        if (!catalog.endings.some(e => e.id === id) || !row || typeof row.lastLoopId !== 'string' || !Number.isFinite(Date.parse(row.firstUnlockedAt)) || !Number.isInteger(row.times) || row.times < 1) throw new Error('Invalid ending unlock');
    }
    return value;
}
