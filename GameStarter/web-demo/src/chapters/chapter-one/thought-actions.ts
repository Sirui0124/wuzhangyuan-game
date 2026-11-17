import { thoughtCapacity, capacityFeedback } from './thought-capacity';
import { fixedThoughts, freshThoughtWorkspace, thinkFromEvidence } from './thought-workspace';
import { connectionFeedback, edgeKey, type Edge } from './thought-canvas-model';
import type { ChapterSessionContext } from './session-context';
/** First-chapter thought-panel interactions; factual events remain in the session. */
export class ChapterThoughtActions {
    constructor(private readonly context: ChapterSessionContext) {
    }
    openNotes(): boolean {
        if (['cinematic', 'death', 'map', 'thought-prompt'].includes(this.context.state.phase) || !this.context.collected.length || this.context.state.phase === 'thoughts')
            return false;
        this.context.cancelGeneration(false);
        this.context.state.notesReturn = this.context.state.phase;
        this.context.state.notesPurpose = ['expression', 'spoken'].includes(this.context.state.phase) ? 'P2' : 'review';
        this.context.state.phase = 'thoughts';
        this.context.state.thinking ??= freshThoughtWorkspace(this.context.collected, this.context.graph());
        this.context.emit();
        return true;
    }
    closeNotes(): boolean {
        if (this.context.state.phase !== 'thoughts')
            return false;
        this.context.state.phase = this.context.state.notesReturn ?? 'explore';
        this.context.state.notesReturn = null;
        this.context.emit();
        return true;
    }
    setThoughtMode(mode: 'reasoning' | 'language'): boolean {
        if (!['thoughts', 'expression'].includes(this.context.state.phase))
            return false;
        if (mode === 'reasoning' && this.context.state.round === 1)
            return false;
        if (mode === 'language' && this.context.state.phase !== 'expression' && this.context.state.notesReturn !== 'expression')
            return false;
        this.context.cancelGeneration(false);
        if (mode === 'language') {
            this.context.state.phase = 'expression';
            this.context.state.notesReturn = null;
            this.context.state.notesPurpose = 'P2';
        }
        else {
            if (this.context.state.phase === 'expression')
                this.context.state.notesReturn = 'expression';
            this.context.state.phase = 'thoughts';
            this.context.state.notesPurpose = 'review';
            this.context.state.thinking ??= freshThoughtWorkspace(this.context.collected, this.context.graph());
        }
        this.context.emit();
        return true;
    }
    placeThought(id: string): boolean {
        const board = this.context.state.thinking;
        if (this.context.state.phase !== 'thoughts' || this.context.state.round !== 2 || !this.context.collected.includes('C03') || this.context.graph().R02 || (this.context.graph().R01 && !board?.recipientOpen) || !board || board.placed.includes(id) || (!this.context.collected.includes(id) && !this.context.graph()[id]))
            return false;
        const capacity = thoughtCapacity(board.placed, this.context.graph());
        if (capacity.full && id !== 'R01') {
            board.feedback = capacityFeedback(capacity.limit);
            this.context.emit();
            return false;
        }
        board.placed.push(id);
        board.feedback = '';
        this.context.emit();
        return true;
    }
    removeThought(id: string): boolean {
        const board = this.context.state.thinking;
        if (this.context.state.phase !== 'thoughts' || this.context.state.round !== 2 || !this.context.collected.includes('C03') || this.context.graph().R02 || (this.context.graph().R01 && !board?.recipientOpen) || !board || !board.placed.includes(id) || fixedThoughts(board).includes(id))
            return false;
        board.placed = board.placed.filter(item => item !== id);
        board.feedback = '';
        this.context.emit();
        return true;
    }
    continueThought(): boolean {
        const board = this.context.state.thinking;
        if (this.context.state.phase !== 'thoughts' || !board || !this.context.graph().R01 || this.context.graph().R02 || board.recipientOpen) return false;
        board.recipientOpen = true;
        board.placed = [...new Set(['R01', ...board.placed])];
        this.context.emit();
        return true;
    }
    think(): string | null {
        const board = this.context.state.thinking;
        if (this.context.state.phase !== 'thoughts' || !board || this.context.state.round !== 2 || !this.context.collected.includes('C03') || this.context.graph().R02 || (this.context.graph().R01 && !board.recipientOpen))
            return null;
        const capacity = thoughtCapacity(board.placed, this.context.graph());
        if (capacity.exceeded) {
            board.feedback = `本题最多添加${capacity.limit}条依据，当前有${capacity.count}条。请先移除多余依据。`;
            this.context.emit();
            return null;
        }
        const attempt = thinkFromEvidence(board.placed, this.context.collected, this.context.graph(), this.context.state.story.edges, this.context.state.story);
        board.feedback = attempt.feedback;
        if (!attempt.outputs.length) {
            this.context.emit();
            return null;
        }
        const added = attempt.edges.filter((edge, index, all) => !this.context.state.story.edges.some(old => edgeKey(old) === edgeKey(edge)) && all.findIndex(other => edgeKey(other) === edgeKey(edge)) === index);
        board.history.push({
            inputs: [...board.placed], outputs: attempt.outputs, added
        });
        board.placed = [...new Set([...fixedThoughts(board), ...attempt.outputs.map(output => output.id)])];
        this.context.state.story.edges.push(...added);
        const graph = this.context.graph();
        for (const id of Object.keys(graph))
            if (!this.context.state.story.seen.includes(id))
                this.context.state.story.seen.push(id);
        if (graph.R01)
            this.context.state.story.flags.Q1_DONE = true;
        if (graph.R02)
            this.context.state.story.flags.Q2_DONE = true;
        this.context.emit({
            type: 'graph', message: board.feedback
        });
        return attempt.outputs[0].id;
    }
    reviseThought(): boolean {
        const board = this.context.state.thinking;
        const record = board?.history.at(-1);
        if (this.context.state.phase !== 'thoughts' || !board || !record?.added.length)
            return false;
        const removed = new Set(record.added.map(edgeKey));
        this.context.state.story.edges = this.context.state.story.edges.filter(edge => !removed.has(edgeKey(edge)));
        board.history.pop();
        board.recipientOpen = !!this.context.graph().R01;
        board.placed = [...new Set([...fixedThoughts(board), ...record.inputs])];
        board.feedback = '';
        const graph = this.context.graph();
        this.context.state.story.flags.Q1_DONE = !!graph.R01;
        this.context.state.story.flags.Q2_DONE = !!graph.R02;
        this.context.emit({
            type: 'graph'
        });
        return true;
    }
    connect(a: string, b: string): string {
        if (this.context.state.phase !== 'thoughts' && this.context.state.phase !== 'expression')
            return '';
        const graph = this.context.graph();
        if (a === b || ![a, b].every(id => this.context.collected.includes(id) || !!graph[id]))
            return '待重组的理解还不能支持新的联系。';
        const edge: Edge = [a, b];
        if (this.context.state.story.edges.some(e => edgeKey(e) === edgeKey(edge)))
            return '这条联系已经记下。';
        this.context.cancelGeneration(false);
        this.context.state.story.edges.push(edge);
        const next = this.context.graph();
        for (const id of Object.keys(next))
            if (!this.context.state.story.seen.includes(id))
                this.context.state.story.seen.push(id);
        if (next.R01)
            this.context.state.story.flags.Q1_DONE = true;
        if (next.R02)
            this.context.state.story.flags.Q2_DONE = true;
        const message = connectionFeedback(a, b, this.context.collected, this.context.state.story.edges, this.context.state.story);
        this.context.emit({
            type: 'graph', message
        });
        return message;
    }
    deleteConnection(key: string): boolean {
        if (this.context.state.phase !== 'thoughts' && this.context.state.phase !== 'expression')
            return false;
        const before = this.context.state.story.edges.length;
        this.context.state.story.edges = this.context.state.story.edges.filter(edge => edgeKey(edge) !== key);
        if (before === this.context.state.story.edges.length)
            return false;
        this.context.cancelGeneration(false);
        const graph = this.context.graph();
        this.context.state.story.selected = this.context.state.story.selected.filter(id => this.context.collected.includes(id) || graph[id]);
        this.context.state.composition.status = 'idle';
        this.context.state.story.flags.Q1_DONE = !!graph.R01;
        this.context.state.story.flags.Q2_DONE = !!graph.R02;
        this.context.emit({
            type: 'graph', message: '联系已撤销，原始见闻仍在。'
        });
        return true;
    }
    place(id: string, x: number, y: number): boolean {
        if (!Number.isFinite(x) || !Number.isFinite(y) || ![...this.context.collected, ...this.context.state.story.seen].includes(id))
            return false;
        this.context.state.story.positions[id] = {
            x: Math.max(0, Math.min(1440, x)), y: Math.max(0, Math.min(920, y))
        };
        this.context.emit();
        return true;
    }
    followPlan(): boolean {
        if (this.context.state.phase !== 'thoughts' || !this.context.graph().R02 || this.context.state.finishedSections.includes('jiang-commitment'))
            return false;
        this.context.state.notesReturn = null;
        this.context.state.phase = 'explore';
        this.context.state.scene = 'camp_gate';
        return this.context.act('meet-jiang');
    }
}
