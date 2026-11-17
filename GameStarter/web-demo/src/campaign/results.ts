/** Cross-chapter facts only: never exposes another chapter's clues, permissions or mutable state. */
export const RESULT_KEY = 'wzy:chapter-results:v1';
export const priorChapters = ['wuzhang', 'grain', 'jieting', 'yiling', 'jingzhou', 'chapter-six'] as const;
export type PriorChapter = typeof priorChapters[number];
export type PersonResult = { name: string; fate: 'saved' | 'dead' | 'unknown'; detail: string };
export type ChapterResult = { chapterId: PriorChapter; status: 'completed' | 'in-progress' | 'missing' | 'invalid';
    title: string; ending: string | null; source: string; people: PersonResult[];
    rescued: number | null; dead: number | null; missing: number | null; detail: string };
export type CampaignSnapshot = { version: 1; capturedAt: string; results: ChapterResult[] };
export type ResultStore = Pick<Storage, 'getItem' | 'setItem'>;
const titles = ['五丈原', '祁山', '街亭', '夷陵', '荆州', '第六章'];
export function emptyResult(chapterId: PriorChapter, status: ChapterResult['status'] = 'missing'): ChapterResult {
    return { chapterId, title: titles[priorChapters.indexOf(chapterId)], status, ending: null, source: '', people: [], rescued: null, dead: null, missing: null,
        detail: status === 'missing' ? '尚无本章结果，不据此推断生死。' : status === 'invalid' ? '结果无法核验，未用作劝说依据。' : '本章尚未结束。' };
}
export function validateResult(r: ChapterResult): void {
    if (!r || !priorChapters.includes(r.chapterId) || !['completed','in-progress','missing','invalid'].includes(r.status)
        || typeof r.title !== 'string' || typeof r.source !== 'string' || typeof r.detail !== 'string' || !(r.ending === null || typeof r.ending === 'string')
        || !Array.isArray(r.people) || r.people.some(p => !p || typeof p.name !== 'string' || typeof p.detail !== 'string' || !['saved','dead','unknown'].includes(p.fate))
        || [r.rescued,r.dead,r.missing].some(n => n !== null && (!Number.isSafeInteger(n) || n < 0))
        || (r.status !== 'completed' && (r.people.length || r.rescued !== null || r.dead !== null))) throw new Error('跨章结果不完整。');
}
export function validateCampaign(s: CampaignSnapshot): void {
    if (!s || s.version !== 1 || typeof s.capturedAt !== 'string' || !Array.isArray(s.results) || s.results.length !== priorChapters.length
        || s.results.some((r,i) => r.chapterId !== priorChapters[i])) throw new Error('此前经历记录不完整。');
    s.results.forEach(validateResult);
}
/** Future chapter producers publish only committed formal outcomes. Demo namespaces never enter this ledger. */
export function publishChapterResult(result: ChapterResult, store: ResultStore = localStorage): void {
    validateResult(result);
    if (!result.source || /playtest|demo|fixture/i.test(result.source)) throw new Error('专项试玩不能写入正式经历。');
    let ledger: Record<string, ChapterResult> = {};
    try { ledger = JSON.parse(store.getItem(RESULT_KEY) ?? '{}'); } catch { /* Replace unreadable ledger only via an explicit producer. */ }
    store.setItem(RESULT_KEY, JSON.stringify({ ...ledger, [result.chapterId]: structuredClone(result) }));
}
let reader: (() => Promise<CampaignSnapshot>) | undefined;
export function setCampaignReader(value: () => Promise<CampaignSnapshot>) { reader = value; }
export async function captureCampaign(): Promise<CampaignSnapshot> {
    const snapshot = reader ? await reader() : { version: 1 as const, capturedAt: new Date().toISOString(), results: priorChapters.map(id => emptyResult(id)) };
    validateCampaign(snapshot); return structuredClone(snapshot);
}
/** Evidence-strength affects wording, never grants a deterministic historical causation claim. */
export function campaignEvidence(s: CampaignSnapshot) {
    validateCampaign(s);
    const complete = s.results.filter(r => r.status === 'completed');
    const saved = complete.flatMap(r => r.people.filter(p => p.fate === 'saved').map(p => `${r.title}，${p.detail}`));
    const lost = complete.flatMap(r => r.people.filter(p => p.fate === 'dead').map(p => `${r.title}，${p.detail}`));
    for (const r of complete) {
        if (r.rescued !== null && r.rescued > 0) saved.push(`${r.title}，这次实际接回了${r.rescued}人，伤员也在其中。`);
        if (r.dead !== null && r.dead > 0) lost.push(`${r.title}，这次确认有${r.dead}人死亡。`);
    }
    return { saved, lost, savedStrong: saved.length >= 2, lossStrong: lost.length >= 2,
        savedText: saved.length ? saved.slice(0,3).join('') : '我不能把没有亲见的生还说成自己的功劳。刚才出营的母子已经由接应人领走，剩下几户也有了去处。这件事，我们做到了。',
        lossText: lost.length ? lost.slice(0,3).join('') : '我拿不出这一程已经确认的阵亡名单，不能说后来的死亡全是你造成的。但你眼下确实想用死讯，让主公难以回头。' };
}
