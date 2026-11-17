import { opening, outcome, type Reply } from './narrative';
export const dimensions = [
    { id: 'time', label: '时间', question: '事情是什么时候发生的？' },
    { id: 'source', label: '消息来源', question: '这消息是从哪里来的？' },
    { id: 'sequence', label: '完整经过', question: '把前后经过讲一遍。' },
    { id: 'evidence', label: '凭据', question: '有什么能作凭据？' },
    { id: 'consistency', label: '前后核对', question: '再核对一下，你前后见到的情况。' },
] as const;
export type Dimension = typeof dimensions[number]['id'];
export type Verdict = 'true' | 'false' | 'pending';
export type Report = { id: string; name: string; role: string; title: string; truth: boolean; opening: string;
    questions?: Record<Dimension, string>; answers: Record<Dimension, string>; flawDimensions: Dimension[]; explanation: string; motive: string };
export type Story = { version: string; title: string; intro: string; reports: Report[] };
export type Action = { type: 'begin' } | { type: 'ask'; id: string; dimension: Dimension; question?: string }
    | { type: 'judge'; id: string; verdict: Verdict } | { type: 'select'; id: string } | { type: 'finish' }
    | { type: 'settle' } | { type: 'narrate'; stage: 'intro' | 'aftermath' } | { type: 'reply'; reply: Reply };
export type Save = { schemaVersion: 1; chapterId: 'jingzhou'; contentVersion: string; seed: number; actions: Action[] };
export type Entry = { asked: Dimension[]; verdict: Verdict | null; questions: Partial<Record<Dimension, string>>; turns: { dimension: Dimension; question?: string }[] };
const copy = <T>(v: T): T => structuredClone(v);
function rng(seed: number) { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }
export function validateStory(story: Story) {
    if (!story || !story.version || !story.intro || story.reports?.length !== 6 || new Set(story.reports.map(r => r.id)).size !== 6
        || story.reports.filter(r => r.truth === true).length !== 3) throw new Error('荆州军报内容不完整。');
    for (const r of story.reports) if (!r.id || !r.name || !r.role || !r.opening || !r.explanation || !r.motive
        || typeof r.truth !== 'boolean' || dimensions.some(d => typeof r.answers?.[d.id] !== 'string' || !r.answers[d.id])
        || (r.questions !== undefined && dimensions.some(d => typeof r.questions?.[d.id] !== 'string' || !r.questions[d.id]))
        || !Array.isArray(r.flawDimensions) || r.flawDimensions.some(d => !dimensions.some(x => x.id === d))
        || (r.truth ? r.flawDimensions.length !== 0 : r.flawDimensions.length < 1 || r.flawDimensions.length > 2)) throw new Error('军报回答或漏洞配置不完整。');
}
/** Actions are replayed on restore, so a save cannot replenish questions or undo a verdict. */
export class JingzhouSession {
    readonly order: string[];
    readonly seed: number;
    private actions: Action[] = [];
    private entries: Record<string, Entry>;
    private picked: string[] = [];
    private started = false;
    private finished = false;
    introPage = 0;
    aftermathPage = 0;
    reply: Reply | '' = '';
    constructor(readonly story: Story, seed: number, saved?: unknown) {
        validateStory(story);
        if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('本轮记录不完整。');
        this.seed = seed;
        this.order = story.reports.map(r => r.id);
        const random = rng(seed);
        for (let i = this.order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [this.order[i], this.order[j]] = [this.order[j], this.order[i]]; }
        this.entries = Object.fromEntries(this.order.map(id => [id, { asked: [], verdict: null, questions: {}, turns: [] }]));
        if (saved !== undefined) {
            const s = saved as Save;
            if (!s || s.schemaVersion !== 1 || s.chapterId !== 'jingzhou' || s.contentVersion !== story.version || s.seed !== seed
                || !Array.isArray(s.actions)) throw new Error('存档版本或内容不匹配，原记录仍保留。');
            for (const a of s.actions) if (!this.apply(a)) throw new Error('存档中的追问或判断记录无效，原记录仍保留。');
        }
    }
    get phase() { return !this.started ? 'intro' : this.finished ? 'result' : this.current ? 'interview' : this.pending.length ? 'resolve' : 'selection'; }
    get current() { return this.order.find(id => this.entries[id].verdict === null); }
    get pending() { return this.order.filter(id => this.entries[id].verdict === 'pending'); }
    get candidates() { return this.order.filter(id => this.entries[id].verdict === 'true'); }
    get selected() { return [...this.picked]; }
    entry(id: string) { return this.entries[id] ? copy(this.entries[id]) : undefined; }
    report(id: string) { return this.story.reports.find(r => r.id === id)!; }
    canAsk(id: string, dimension: Dimension) {
        const e = this.entries[id];
        return this.started && !this.finished && !!e && (id === this.current || e.verdict === 'pending')
            && e.asked.length < 3 && dimensions.some(d => d.id === dimension);
    }
    apply(action: Action): boolean {
        if (!action || typeof action !== 'object') return false;
        if (action.type === 'narrate') {
            if (action.stage === 'intro' && !this.started && this.introPage < opening.length - 1) this.introPage++;
            else if (action.stage === 'aftermath' && this.finished && this.aftermathPage < 5 && this.aftermathPage !== 1) this.aftermathPage++;
            else return false;
            this.actions.push(copy(action)); return true;
        }
        if (action.type === 'reply') {
            if (!this.finished || this.aftermathPage !== 1 || !['stay', 'people'].includes(action.reply)) return false;
            this.reply = action.reply; this.aftermathPage = 2; this.actions.push(copy(action)); return true;
        }
        if (this.finished) return false;
        if (action.type === 'begin') { if (this.started) return false; this.started = true; }
        else {
            if (!this.started) return false;
            if (action.type === 'ask') {
                if (!this.canAsk(action.id, action.dimension)) return false;
                if (action.question !== undefined && (typeof action.question !== 'string' || !action.question.trim() || action.question.length > 300)) return false;
                this.entries[action.id].asked.push(action.dimension);
                this.entries[action.id].turns.push({ dimension: action.dimension, ...(action.question !== undefined ? { question: action.question } : {}) });
                if (action.question !== undefined) this.entries[action.id].questions[action.dimension] = action.question;
            } else if (action.type === 'judge') {
                const e = this.entries[action.id];
                if (!e || (action.id !== this.current && e.verdict !== 'pending') || !['true', 'false', 'pending'].includes(action.verdict)) return false;
                if (action.verdict === 'pending' && (e.verdict === 'pending' || this.pending.length >= 2)) return false;
                e.verdict = action.verdict;
            } else if (action.type === 'select') {
                if (this.phase !== 'selection' || !this.candidates.includes(action.id)) return false;
                if (this.picked.includes(action.id)) this.picked = this.picked.filter(id => id !== action.id);
                else { if (this.picked.length >= 3) return false; this.picked.push(action.id); }
            } else if (action.type === 'settle') {
                if (this.phase !== 'selection') return false;
                this.finished = true;
            } else if (action.type === 'finish') {
                if (this.phase !== 'selection' || (this.candidates.length >= 3 && this.picked.length !== 3)) return false;
                this.finished = true;
            } else return false;
        }
        this.actions.push(copy(action)); return true;
    }
    get result() {
        if (!this.finished) return null;
        const reliable = this.picked.filter(id => this.report(id).truth).length;
        const judged = this.order.filter(id => (this.entries[id].verdict === 'true') === this.report(id).truth).length;
        // Legacy selection actions remain replayable; current endings depend only on six verdicts.
        const survived = judged >= 3;
        return { reliable, judged, chance: survived ? 1 : 0, survived, insufficient: false, outcome: outcome(judged) };
    }
    snapshot(): Save { return { schemaVersion: 1, chapterId: 'jingzhou', contentVersion: this.story.version, seed: this.seed, actions: copy(this.actions) }; }
}
