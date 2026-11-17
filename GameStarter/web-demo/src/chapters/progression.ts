/** Historical chapter access is separate from plot saves and never grants plot facts. */
export const CHAPTER_HISTORY_KEY = 'wuzhang-chapter-history-v1';
export const chapterOrder = ['wuzhang', 'grain', 'jieting', 'yiling', 'jingzhou', 'luofengpo'] as const;
export type ChapterId = typeof chapterOrder[number];
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export type ChapterAccessSpec = {
    id: ChapterId; title: string; saveKey: string; format: 'first' | 'graph' | 'yiling' | 'jingzhou';
    completedKey?: string; collectionKey?: string; successEndings: string[];
    nodes: string[]; successNodes: string[];
};
type History = { version: 1; entered: ChapterId[]; completed: ChapterId[]; freshStart?: true; earlyYiling?: true };
export type ChapterAccess = { unlocked: boolean; completed: boolean; replayable: boolean; earlyAccess: boolean };
let specs: ChapterAccessSpec[] = [];
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === 'string');
function parse(store: Store, key: string): unknown { try { return JSON.parse(store.getItem(key) ?? 'null'); } catch { return null; } }
function history(store: Store): History {
    const saved = parse(store, CHAPTER_HISTORY_KEY);
    const ids = (value: unknown) => strings(value) ? chapterOrder.filter(id => value.includes(id)) : [];
    return object(saved) && saved.version === 1 ? { version: 1, entered: ids(saved.entered), completed: ids(saved.completed), ...(saved.freshStart === true ? { freshStart: true as const } : {}), ...(saved.earlyYiling === true ? { earlyYiling: true as const } : {}) } : { version: 1, entered: [], completed: [] };
}
function remember(store: Store, value: History) {
    try { const raw = JSON.stringify(value); if (store.getItem(CHAPTER_HISTORY_KEY) !== raw) store.setItem(CHAPTER_HISTORY_KEY, raw); } catch { /* Access still works in memory; never replace plot saves. */ }
}
function legacySave(spec: ChapterAccessSpec, value: unknown): { played: boolean; completed: boolean } {
    if (!object(value)) return { played: false, completed: false };
    let played = false, completed = false;
    if (spec.format === 'first') {
        played = value.schemaVersion === 1 && value.chapterId === spec.id && typeof value.contentVersion === 'string'
            && object(value.story) && typeof value.story.run === 'string' && strings(value.story.completed);
        completed = played && ['ending', 'map'].includes(value.phase) && spec.successEndings.includes(value.end);
    } else if (spec.format === 'jingzhou') {
        played = value.schemaVersion === 1 && value.chapterId === spec.id && typeof value.contentVersion === 'string'
            && Number.isInteger(value.seed) && Array.isArray(value.actions);
        completed = played && value.actions.some((action: any) => action?.type === 'finish' || action?.type === 'settle');
    } else if (spec.format === 'yiling') {
        const game = value.game;
        const node = game?.nodeId ?? game?.node;
        played = object(game) && game.schemaVersion === 1 && game.chapterId === spec.id && typeof game.contentVersion === 'string'
            && spec.nodes.includes(node) && Array.isArray(game.actions);
        completed = played && spec.successNodes.includes(node);
    } else {
        played = typeof value.version === 'string' && spec.nodes.includes(value.node) && strings(value.visited)
            && value.visited.every(id => spec.nodes.includes(id)) && strings(value.chosen)
            && (spec.id !== 'jieting' || value.schema === 1);
        completed = played && !value.end && spec.successNodes.includes(value.node);
    }
    return { played, completed };
}
/** Migrate real auto/manual/history saves, excluding dedicated playtests and arbitrary backups. */
export function chapterAccess(store: Store, sources = specs): Record<ChapterId, ChapterAccess> {
    const saved = history(store), entered = new Set(saved.entered), completed = new Set(saved.completed);
    for (const spec of saved.freshStart ? [] : sources) {
        for (const suffix of ['', ':slot:1', ':slot:2', ':slot:3', ':before-new']) {
            const old = legacySave(spec, parse(store, spec.saveKey + suffix));
            if (old.played) entered.add(spec.id);
            if (old.completed) completed.add(spec.id);
        }
        try { if (spec.completedKey && store.getItem(spec.completedKey) === 'true') completed.add(spec.id); } catch { /* Fail closed. */ }
        const collection = spec.collectionKey ? parse(store, spec.collectionKey) : null;
        if (object(collection)) {
            const unlocked = spec.format === 'first' ? collection.unlocked : collection;
            if (object(unlocked) && spec.successEndings.some(id => spec.format === 'first'
                ? object(unlocked[id]) && typeof unlocked[id].firstUnlockedAt === 'string' && unlocked[id].times > 0
                : Number.isFinite(unlocked[id]) && unlocked[id] > 0)) completed.add(spec.id);
        }
    }
    completed.forEach(id => entered.add(id));
    // Early Yiling counts as a real experience, but cannot advance the mainline until Jieting is complete.
    // Unmarked historical saves retain their existing access for compatibility.
    const mainline = (id: ChapterId) => id !== 'yiling' || !saved.earlyYiling || completed.has('jieting');
    const furthestEntered = Math.max(0, ...[...entered].filter(mainline).map(id => chapterOrder.indexOf(id)));
    const furthestUnlocked = Math.max(furthestEntered, ...[...completed].filter(mainline).map(id => Math.min(chapterOrder.length - 1, chapterOrder.indexOf(id) + 1)));
    remember(store, { ...saved, entered: chapterOrder.filter(id => entered.has(id)), completed: chapterOrder.filter(id => completed.has(id)) });
    return Object.fromEntries(chapterOrder.map((id, index) => [id, { unlocked: id === 'yiling' || index <= furthestUnlocked, completed: completed.has(id), replayable: completed.has(id) || index < furthestEntered, earlyAccess: id === 'yiling' && index > furthestUnlocked }])) as Record<ChapterId, ChapterAccess>;
}
/** A new campaign keeps archives but must never migrate their old access again. */
export function startNewChapterProgress(store: Store & Pick<Storage, 'removeItem'> = localStorage, sources = specs) {
    const keys = [CHAPTER_HISTORY_KEY, 'wzy:chapter-results:v1', 'wzy:chapter-results:v1:yiling-base', 'yiling-rescue-campaign-session-v1', ...sources.flatMap(spec => [spec.saveKey, ...(spec.completedKey ? [spec.completedKey] : [])])];
    const previous = Object.fromEntries(keys.map(key => [key, store.getItem(key)]));
    const backup = JSON.stringify(previous);
    store.setItem(`${CHAPTER_HISTORY_KEY}:before-new`, backup);
    if (store.getItem(`${CHAPTER_HISTORY_KEY}:before-new`) !== backup) throw new Error('新游戏备份未写入');
    store.setItem(CHAPTER_HISTORY_KEY, JSON.stringify({ version: 1, entered: [], completed: [], freshStart: true }));
    for (const key of keys) if (key !== CHAPTER_HISTORY_KEY) store.removeItem(key);
}
export function recordChapterHistory(id: ChapterId, completed = false, store: Store = localStorage) {
    const earlyYiling = id === 'yiling' && chapterAccess(store).yiling.earlyAccess;
    const saved = history(store);
    if (earlyYiling) saved.earlyYiling = true;
    if (!saved.entered.includes(id)) saved.entered.push(id);
    if (completed && !saved.completed.includes(id)) saved.completed.push(id);
    remember(store, saved);
}
export async function initializeChapterAccess(): Promise<void> {
    const response = await fetch('/story/chapter-access.json');
    if (!response.ok) throw new Error('章节记录未能载入，请刷新重试。');
    const value = await response.json();
    if (!Array.isArray(value) || value.length !== chapterOrder.length || value.some((spec, i) => spec.id !== chapterOrder[i] || !strings(spec.nodes) || !strings(spec.successNodes) || !strings(spec.successEndings))) throw new Error('章节解锁配置不完整。');
    specs = value; chapterAccess(localStorage);
}
export function chapterAccessMessage(id: ChapterId) {
    const previous = specs[chapterOrder.indexOf(id) - 1];
    return previous ? `先通关${previous.title}，再开启这一章。` : '';
}
export function requestedChapter(value: string | null): ChapterId {
    if (value === 'masu') return 'jieting';
    return chapterOrder.includes(value as ChapterId) ? value as ChapterId : 'wuzhang';
}
