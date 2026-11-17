import { projectDecision } from '../../narrative/presentation';
import { indexStoryGraph } from '../../session/story-graph';
import { dimensions, parseJudgment, rubricForRound, type Judgment, type Rubric } from './open-dialogue';
import { recordDialogueDiagnostic } from './dialogue-diagnostics';
export type GrainNode = {
    id: string; kind: 'line' | 'choice' | 'action' | 'video' | 'finish' | 'open' | 'route' | 'letter';
    speaker: string; text: string; next?: string; clip?: string;
    clues?: { id: string; title: string; detail: string; sources?: {node: string; speaker: string; text: string}[] }[];
    options?: { id: string; text: string; next: string; delta?: number[] }[];
    round?: 'O1' | 'O2'; listener?: string; material?: boolean; image?: string; placeholder?: boolean; cameraHold?: boolean;
    sourceRows?: string[]; routes?: string[]; gate?: string; ending?: string;
};
export type GrainStory = { version: string; start: string; nodes: GrainNode[]; letterDefault?: string };
export type GrainSave = { version: string; node: string; visited: string[]; chosen: string[]; draft: string; judgments: Record<string, Judgment>; selected: string[]; selectedAt?: string; run: number; letterDraft?: string; routeSnapshot?: { cooperation: boolean; quality: boolean } };
/** 第二章试玩流程，按节点的 next 和选项推进。 */
export class GrainSession {
    readonly state: GrainSave;
    private nodes: Map<string, GrainNode>;
    constructor(readonly story: GrainStory, saved?: unknown, readonly rubric?: Rubric) {
        this.nodes = indexStoryGraph(story.nodes, story.start, '第二章');
        const s = saved as Partial<GrainSave> | null;
        const valid = s?.version === story.version && typeof s.node === 'string' && this.nodes.has(s.node)
            && Array.isArray(s.visited) && s.visited.every(id => typeof id === 'string' && this.nodes.has(id))
            && Array.isArray(s.chosen) && s.chosen.every(id => story.nodes.some(n => n.options?.some(o => o.id === id)));
        if (saved != null && !valid) throw new Error('第二章存档与当前内容不兼容');
        const extras = { selected: [] as string[], run: Date.now() };
        this.state = valid ? { ...extras, version: story.version, node: s!.node!, visited: [...s!.visited!], chosen: [...s!.chosen!], draft: typeof s?.draft === 'string' ? s.draft.slice(0, 1500) : '', judgments: {} }
            : { ...extras, version: story.version, node: story.start, visited: [], chosen: [], draft: '', judgments: {} };
        if (valid) {
            this.state.selected = Array.isArray(s?.selected) ? s.selected.filter(id => this.clues.some(c => c.id === id)) : [];
            if (typeof s?.selectedAt === 'string' && this.nodes.get(s.selectedAt)?.kind === 'open') this.state.selectedAt = s.selectedAt;
            this.state.run = typeof s?.run === 'number' ? s.run : extras.run;
            this.state.letterDraft = typeof s?.letterDraft === 'string' ? s.letterDraft.slice(0,3000) : story.letterDefault;
            if (s?.routeSnapshot && typeof s.routeSnapshot.cooperation === 'boolean' && typeof s.routeSnapshot.quality === 'boolean') this.state.routeSnapshot = { ...s.routeSnapshot };
        }
        if (valid && rubric && s?.judgments && typeof s.judgments === 'object') {
            for (const [id, j] of Object.entries(s.judgments)) {
                if (this.nodes.get(id)?.kind !== 'open' || j?.rubricVersion !== rubric.version || typeof j.input !== 'string') continue;
                try { this.state.judgments[id] = parseJudgment(JSON.stringify({ valid: true, scores: j.scores, response: j.response }), j.input, rubricForRound(rubric, this.nodes.get(id)?.round));
                    // Old saves retain the reply actually shown; absent new response data never invalidates scores.
                    if (!j.response && typeof j.reply === 'string') this.state.judgments[id].reply = j.reply.slice(0, 600);
                    if (typeof j.diagnosticId === 'string' && /^gouan-[a-z0-9-]+$/.test(j.diagnosticId)) this.state.judgments[id].diagnosticId = j.diagnosticId;
                } catch { /* Unread invalid judgments are not credited. */ }
            }
        }
        const missing = story.nodes.find(n => n.kind === 'open' && this.state.visited.includes(n.id) && !this.state.judgments[n.id]);
        if (missing) {
            this.state.node = missing.id;
            this.state.visited = this.state.visited.slice(0, this.state.visited.indexOf(missing.id));
        }
    }
    get current() { return this.nodes.get(this.state.node)!; }
    get currentRubric() { return this.rubric && rubricForRound(this.rubric, this.current.round); }
    get clues() {
        return [...new Map(this.state.visited.flatMap(id => this.nodes.get(id)?.clues ?? []).map(c => [c.id, c])).values()];
    }
    get decision() { return this.current.kind === 'choice' ? projectDecision(this.current, this.current.options ?? []) : undefined; }
    get scores() { return this.calculateScores(); }
    get dialogueResponseContext() { return { baseScores: this.calculateScores(this.current.id) }; }
    private calculateScores(excludeJudgment?: string) {
        const scores = { ...(this.rubric?.initial ?? { trust: 2, rigor: 0, responsibility: 1 }) };
        for (const id of [...new Set([...this.state.visited, this.state.node])]) {
            const node = this.nodes.get(id)!;
            for (const option of node.options ?? []) if (this.state.chosen.includes(option.id)) {
                dimensions.forEach((key,i) => { scores[key] = Math.max(0,Math.min(10,scores[key]+(option.delta?.[i] ?? 0))); });
            }
            const judgment = id === excludeJudgment ? undefined : this.state.judgments[id];
            if (judgment) for (const key of dimensions) scores[key] = Math.max(0, Math.min(10, scores[key] + judgment.scores[key].delta));
        }
        return scores;
    }
    submit(judgment: Judgment) {
        if (this.current.kind !== 'open' || !this.rubric || judgment.rubricVersion !== this.rubric.version) return false;
        const checked = parseJudgment(JSON.stringify({ valid: true, scores: judgment.scores, response: judgment.response }), judgment.input, this.currentRubric!);
        if (typeof judgment.diagnosticId === 'string' && /^gouan-[a-z0-9-]+$/.test(judgment.diagnosticId)) checked.diagnosticId = judgment.diagnosticId;
        this.state.judgments[this.current.id] = checked;
        this.state.draft = checked.input;
        recordDialogueDiagnostic(checked.diagnosticId, 'committed', { snapshot: { nodeId: this.current.id, scores: checked.scores, totals: this.scores, chosen: this.state.chosen } });
        return true;
    }
    advance(optionId?: string) {
        const n = this.current;
        const option = n.options?.find(o => o.id === optionId);
        if (n.kind === 'finish' || (n.kind === 'open' && !this.state.judgments[n.id]) || (n.kind === 'choice' && !option) || (n.kind !== 'choice' && optionId)) return false;
        const next = option?.next ?? n.next;
        if (!next) return false;
        if (n.kind === 'letter' && !(this.state.letterDraft ?? this.story.letterDefault ?? '').trim()) return false;
        if (n.id === 'UI-N5' && !this.state.routeSnapshot) {
            const s=this.scores, ids=new Set(this.clues.map(c=>c.id));
            this.state.routeSnapshot={cooperation:s.trust>=4 && s.responsibility>=4,quality:s.rigor>=5 && ['LY-M01','LY-M02','LY-M03','LY-M04','LY-M05','LY-M06','LY-M07','LY-M08','LY-C11','LY-C12','LY-C14'].every(id=>ids.has(id))};
            for (const j of Object.values(this.state.judgments)) recordDialogueDiagnostic(j.diagnosticId, 'route-snapshot', { snapshot: { totals: s, route: this.state.routeSnapshot, clueIds: [...ids], chosen: this.state.chosen, action: optionId } });
        }
        if (!this.state.visited.includes(n.id)) this.state.visited.push(n.id);
        if (option && !this.state.chosen.includes(option.id)) this.state.chosen.push(option.id);
        this.state.node = next;
        for (let i=0;this.current.kind==='route' && i<10;i++) {
            const route=this.current, snapshot=this.state.routeSnapshot;
            const yes=route.gate==='cooperation'?snapshot?.cooperation:route.gate==='quality'?snapshot?.quality:!this.state.visited.includes('V32R');
            this.state.node=route.routes![yes?0:1];
        }
        if (this.current.kind==='open' && this.current.id!==n.id) this.state.draft=this.state.judgments[this.current.id]?.input ?? '';
        return true;
    }
}
