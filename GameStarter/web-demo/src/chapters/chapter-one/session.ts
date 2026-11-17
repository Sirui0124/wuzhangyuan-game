import { chapterOneDecision } from './narrative-decision';
import { availableChoice } from '../../narrative/presentation';
import type { ChapterFlow, ChapterPhase, ChapterScene, FlowSection, FlowTarget } from '../../../../../content/schema/chapter-session';
import { freshThoughtWorkspace } from './thought-workspace';
import { commitRow, derive, inferenceRules, validAuthorization, type ChapterReview, type StoryRow } from './thought-canvas-model';
import { clone, freshComposition, freshSessionState, speechHistoryRound, type GameSessionState, type SessionEvent, type ExpressionJudge, type ExpressionGenerator } from './session-state';
import { ChapterExpressionActions } from './expression-actions';
import { ChapterThoughtActions } from './thought-actions';
import type { ChapterSessionContext } from './session-context';
import { validateChapterFlow } from './flow-validation';
import { restoreSessionState } from './session-restore';
import { aiEnabled, type RuntimeMode } from '../../runtime-mode';
import { advanceTent } from './tent-visit';
import { BranchProgress } from './branch-progress';
import type { Story as BranchStory, AiReceipt } from './branch-engine';
/** One state machine for the whole chapter. Presentation, timers and generated text cannot grant facts. */
export class ChapterOneSession {
    branch?: BranchProgress;
    private state: GameSessionState;
    private rows: Map<string, StoryRow>;
    private sections: Map<string, FlowSection>;
    private expressions: ChapterExpressionActions;
    private thoughts: ChapterThoughtActions;
    private listeners = new Set<(event: SessionEvent) => void>();
    constructor(readonly content: ChapterReview, readonly flow: ChapterFlow, readonly contentVersion: string, judge?: ExpressionJudge, generate?: ExpressionGenerator, private mode: RuntimeMode = 'ai', branchStory?: BranchStory) {
        this.rows = new Map(content.rows.map(row => [row.id, row]));
        this.sections = new Map(flow.sections.map(section => [section.id, section]));
        validateChapterFlow(content, flow);
        const session = this;
        const context: ChapterSessionContext = {
            get state() {
                return session.state;
            },
            get collected() {
                return session.collected;
            },
            content, rows: this.rows,
            graph: () => this.graph(), emit: event => this.emit(event),
            enter: target => this.enter(target), act: id => this.act(id),
            cancelGeneration: emit => this.cancelGeneration(emit),
        };
        this.expressions = new ChapterExpressionActions(context, judge, generate);
        this.thoughts = new ChapterThoughtActions(context);
        this.state = freshSessionState(this.content.version, this.contentVersion);
        if (branchStory) this.branch = new BranchProgress(branchStory);
        this.enter(flow.entry);
    }
    onChange(listener: (event: SessionEvent) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private emit(event: SessionEvent = {
        type: 'change'
    }) {
        this.state.savedAt = new Date().toISOString();
        for (const listener of this.listeners)
            listener(event);
    }
    snapshot(): GameSessionState {
        return clone({ ...this.state, ...(this.branch ? {branch:this.branch.snapshot()} : {}), runtimeMode: this.mode });
    }
    runtimeMode() { return this.mode; }
    aiEnabled() { return aiEnabled(this.mode); }
    setRuntimeMode(mode: RuntimeMode) {
        if (mode === this.mode) return;
        this.cancelSpeech(false);
        this.mode = mode;
        this.applyMode(true);
        this.emit();
    }
    private applyMode(changed: boolean) {
        // Unread judgments belong to their original mode. Return to editable words.
        if (changed && (this.state.phase === 'spoken' || this.state.notesReturn === 'spoken') && this.state.speech) {
            this.state.story.draft = this.state.speech.text;
            this.state.speech = null;
            this.state.composition.status = 'ready';
            if (this.state.phase === 'spoken') this.state.phase = 'expression';
            else this.state.notesReturn = 'expression';
        }
    }
    serialize() {
        return JSON.stringify(this.snapshot());
    }
    row(): StoryRow | null {
        if(this.state.phase==='branch' && this.branch?.currentLine) return {id:`${this.branch.dialogue.nodeId}:${this.branch.dialogue.audit.length}:${this.branch.line}`, ...this.branch.currentLine} as StoryRow;
        const row = this.state.phase === 'dialogue' ? this.rows.get(this.sections.get(this.state.section!)!.rows[this.state.lineIndex]) ?? null : null;
        const last = this.state.story.history.at(-1);
        if (row && last?.accepted && last.npcTurn && row.id === (last.npcTurn.stage === 'first' ? 'A-40B' : 'W07'))
            return {
                ...row, text: last.npcTurn.reply.text
            };
        return row?.id === 'A-42' && !this.collected.includes('T02') ? {
            ...row, text: row.text.replace('营门未破。', '')
        } : row;
    }
    sourceRow(id: string) {
        return this.rows.get(id);
    }
    recordedRow(id: string): StoryRow | undefined {
        const row = this.rows.get(id);
        if (!row || !this.state.story.completed.includes(id)) return undefined;
        const saved = this.state.displayedRows?.[id];
        if (saved !== undefined) return { ...row, text: saved };
        // Old saves have no presentation snapshot. Reconstruct only facts already
        // read before this row, never facts acquired later or in the second round.
        if (id === 'A-42') {
            const learnedAt = this.state.story.completed.indexOf('A-24');
            if (learnedAt < 0 || learnedAt >= this.state.story.completed.indexOf(id))
                return { ...row, text: row.text.replace('营门未破。', '') };
        }
        return row;
    }
    currentReply(): StoryRow | null {
        const result = this.state.speech?.result;
        const replyId = result === 'execute' ? (this.state.round === 1 ? 'A-40' : 'P2-F1') : result === 'R1-RETRY' ? 'A-40' : result;
        const row = this.state.phase === 'reply' && replyId && result !== 'ok' ? this.rows.get(replyId) ?? null : null;
        return row && this.state.speech?.npcTurn ? {
            ...row, ...(result === 'execute' ? { id: 'execute' } : {}), text: this.state.speech.npcTurn.reply.text
        } : row;
    }
    graph() {
        return derive(this.state.story.collected, this.state.story.edges, inferenceRules, this.state.story);
    }
    currentSection() {
        return this.sections.get(this.state.section ?? '') ?? null;
    }
    currentCinematic() {
        return this.flow.cinematics.find(c => c.id === this.state.cinematic) ?? null;
    }
    busy() {
        return this.expressions.busy();
    }
    get collected() {
        return [...this.state.story.collected];
    }
    get scene() {
        return this.flow.scenes.find(s => s.id === this.state.scene)!;
    }
    private commit(id: string) {
        const before = this.state.story.collected.length;
        commitRow(this.state.story, id);
        if (this.state.story.collected.length > before)
            return this.state.story.collected.at(-1);
        return null;
    }
    private enter(target: FlowTarget) {
        if (target.kind === 'section') {
            const section = this.sections.get(target.id)!;
            this.state.phase = 'dialogue';
            this.state.section = section.id;
            this.state.lineIndex = 0;
            this.state.scene = section.scene;
            this.state.round = section.round;
            this.state.story.current = section.rows[0];
        }
        else if (target.kind === 'cinematic') {
            this.state.phase = 'cinematic';
            this.state.cinematic = target.id;
        }
        else {
            this.state.phase = target.id as ChapterPhase;
            if (target.id === 'thoughts') {
                // Completing the report offers an explicit pause before the first canvas.
                this.state.phase = 'thought-prompt';
                this.state.notesReturn = null;
            }
            if (target.id === 'expression') {
                if (this.state.round === 2 && !validAuthorization(this.state.story)) {
                    this.enter({
                        kind: 'section', id: 'jiang-commitment'
                    });
                    return;
                }
                this.state.story.current = this.state.round === 1 ? 'R1-LANG' : 'P2-01';
                this.state.notesPurpose = 'P2';
                this.state.composition = freshComposition();
                this.state.story.draft = '';
                if (this.state.round === 1)
                    this.state.story.selected = this.collected;
                if (!this.state.panelOpened.includes(this.state.round === 1 ? 'R1' : 'P2'))
                    this.state.panelOpened.push(this.state.round === 1 ? 'R1' : 'P2');
                this.state.story.flags.P2_OPENED = true;
            }
            if (target.id === 'death') {
                this.state.end = 'tutorial-sacrifice';
                this.state.story.flags.FIRST_FAILURE_EXPERIENCED = true;
            }
            if (target.id === 'ending') {
                if (!this.state.story.flags.REPORT_CLOSED)
                    throw new Error('军报尚未闭环，不能进入生还结局');
                this.state.end = 'safe';
            }
        }
    }
    /** Narrative actions keep factual guards; the retired canvas no longer grants progress. */
    private establishNarrativePlan(): boolean {
        const rule = inferenceRules.find(value => value.id === 'R02')!;
        if (this.state.round !== 2 || !rule.requires.every(id => this.collected.includes(id))
            || !(rule.requiresStory ?? []).every(id => this.state.story.completed.includes(id))) return false;
        for (const id of rule.requires.slice(1)) {
            const edge: [string, string] = [rule.requires[0], id];
            if (!this.state.story.edges.some(old => old.includes(edge[0]) && old.includes(edge[1]))) this.state.story.edges.push(edge);
        }
        const known = this.graph();
        this.state.story.flags.Q1_DONE = !!known.R01;
        this.state.story.flags.Q2_DONE = !!known.R02;
        this.state.story.seen = [...new Set([...this.state.story.seen, ...Object.keys(known)])];
        return !!known.R02;
    }
    continueStory(): boolean {
        if (!['thought-prompt', 'thoughts'].includes(this.state.phase)
            || !availableChoice(chapterOneDecision(this.state), 'continue-story') || !this.establishNarrativePlan()) return false;
        this.state.notesReturn = null;
        this.state.phase = 'explore';
        this.state.scene = 'camp_gate';
        return this.act('meet-jiang');
    }
    returnToStory(): boolean {
        if (!['thought-prompt', 'thoughts'].includes(this.state.phase)) return false;
        this.establishNarrativePlan();
        const previous = this.state.notesReturn;
        this.state.phase = previous && !['thoughts', 'thought-prompt'].includes(previous) ? previous : 'explore';
        this.state.notesReturn = null;
        this.emit();
        return true;
    }
    beginThinking(): boolean {
        if (this.state.phase !== 'thought-prompt') return false;
        this.state.phase = 'thoughts';
        this.state.story.current = 'P1-Q1';
        this.state.notesPurpose = 'P1';
        this.state.notesReturn = 'explore';
        if (!this.state.panelOpened.includes('P1')) this.state.panelOpened.push('P1');
        this.state.story.flags.P1_OPENED = true;
        if (!this.state.thinking || (!this.state.thinking.placed.length && !this.state.thinking.history.length))
            this.state.thinking = freshThoughtWorkspace(this.collected, this.graph());
        this.emit({ type: 'section' });
        return true;
    }
    chooseScout(option: 'a' | 'b'): boolean {
        if (this.state.phase !== 'choice' || this.state.round !== 1 || !['a', 'b'].includes(option))
            return false;
        this.enter({
            kind: 'section', id: option === 'a' ? 'scout-option-a' : 'scout-option-b'
        });
        this.emit();
        return true;
    }
    nextLine(): boolean {
        const row = this.row(), section = this.currentSection();
        if (!row || !section)
            return false;
        (this.state.displayedRows ??= {})[row.id] ??= row.text;
        const gained = this.commit(row.id);
        if (this.state.lineIndex + 1 < section.rows.length) {
            this.state.lineIndex++;
            this.state.story.current = section.rows[this.state.lineIndex];
            const scene = section.rowScenes?.[this.state.story.current];
            if (scene)
                this.state.scene = scene;
        }
        else {
            if (!this.state.finishedSections.includes(section.id))
                this.state.finishedSections.push(section.id);
            this.enter(section.next);
        }
        this.emit(gained ? {
            type: 'clue', id: gained
        } : this.state.phase === 'death' || this.state.phase === 'ending' ? {
            type: 'ending', id: this.state.end!
        } : {
            type: 'line', id: row.id
        });
        return true;
    }
    finishCinematic(): boolean {
        const cinematic = this.currentCinematic();
        if (this.state.phase !== 'cinematic' || !cinematic)
            return false;
        for (const id of this.branch ? [] : cinematic.coveredRows)
            this.commit(id);
        if (!this.state.finishedCinematics.includes(cinematic.id))
            this.state.finishedCinematics.push(cinematic.id);
        this.state.cinematic = null;
        if (this.branch && cinematic.id==='opening') this.state.phase='branch';
        else this.enter(cinematic.next);
        this.emit(this.state.end && ['death', 'ending'].includes(this.state.phase)
            ? { type: 'ending', id: this.state.end }
            : { type: 'cinematic', id: cinematic.id });
        return true;
    }
    tentAction(action: string): boolean {
        if (!advanceTent(this.state, action)) return false;
        this.emit(this.state.end === 'tent-execution' ? { type: 'ending', id: this.state.end } : { type: 'section' });
        return true;
    }
    actionState(id: string): {
        enabled: boolean;
        reason: string;
    } {
        const action = this.flow.actions.find(a => a.id === id);
        if (!action || action.round !== this.state.round || this.state.finishedSections.includes(action.section))
            return {
                enabled: false, reason: '这段经历已经结束。'
            };
        if (action.scene !== this.state.scene)
            return {
                enabled: false, reason: '先到对应地点。'
            };
        if (action.requires.some(id => !this.state.finishedSections.includes(id)))
            return {
                enabled: false, reason: '先把眼前的事问清。'
            };
        if (id === 'deliver-first' && !this.state.story.flags.FIRST_TRANSFER_ACCEPTED)
            return {
                enabled: false, reason: '先向魏将军说清即时转呈的安排。'
            };
        if (id === 'meet-jiang' && !this.graph().R02)
            return {
                enabled: false, reason: '先整理见闻，想清不误军情的办法。'
            };
        if (id === 'intercept-weiyan' && !validAuthorization(this.state.story))
            return {
                enabled: false, reason: '还要得到姜维本人答复，并请亲兵同行。'
            };
        return {
            enabled: this.state.phase === 'explore', reason: this.state.phase === 'explore' ? '' : '先读完当前的对话。'
        };
    }
    actions() {
        return this.flow.actions.filter(a => a.round === this.state.round && a.scene === this.state.scene && !this.state.finishedSections.includes(a.section) && a.requires.every(id => this.state.finishedSections.includes(id)));
    }
    act(id: string): boolean {
        if (!this.actionState(id).enabled)
            return false;
        const action = this.flow.actions.find(a => a.id === id)!;
        this.enter({
            kind: 'section', id: action.section
        });
        this.emit({
            type: 'section', id: action.section
        });
        return true;
    }
    move(scene: ChapterScene): boolean {
        if (this.state.phase !== 'explore' || !this.scene.routes.includes(scene))
            return false;
        this.state.scene = scene;
        this.emit();
        return true;
    }
    objective(): string {
        if (this.state.end === 'weiyan-execution')
            return '这次交涉已告失败，可以回到本轮对话之前。';
        if (this.state.phase === 'death')
            return '记住这次遗漏，再回到那一片夕阳。';
        if (this.state.phase === 'ending')
            return '这一夜已经守住。';
        if (this.state.phase === 'dialogue')
            return this.currentSection()!.title;
        if (this.state.round === 2 && this.state.finishedSections.includes('rewind')) {
            const guard = this.state.finishedSections.includes('guard-investigation');
            const relay = this.state.finishedSections.includes('relay-investigation');
            if (!guard && !relay) return '甲在中军帐前，乙在姜维帐前；先找谁都可以，两人都聊完再继续。';
            if (!guard) return '还需到中军帐前与甲聊完，再去核实敌情。';
            if (!relay) return '还需到姜维帐前与乙聊完，再去核实敌情。';
        }
        const next = this.flow.actions.find(a => a.round === this.state.round && !this.state.finishedSections.includes(a.section) && a.requires.every(id => this.state.finishedSections.includes(id)));
        if (next?.id === 'meet-jiang' && !this.graph().R02)
            return this.graph().R01 ? '不能惊扰丞相，又不能耽误军情，怎么办？' : '这次军情与前几夜有何不同？';
        return next?.description ?? '回看这一夜的见闻。';
    }
    rewind(): boolean {
        if (this.state.phase !== 'death' || this.state.end !== 'tutorial-sacrifice' || !this.state.story.flags.FIRST_FAILURE_EXPERIENCED)
            return false;
        this.cancelSpeech(false);
        this.state.story.collected = [];
        this.state.story.edges = [];
        this.state.story.seen = [];
        this.state.story.positions = {};
        this.state.story.selected = [];
        this.state.story.draft = '';
        this.state.story.history = [];
        delete this.state.story.pending;
        this.state.panelOpened = [];
        this.state.composition = freshComposition();
        this.state.lastFeedback = '';
        this.state.story.flags = {
            FIRST_FAILURE_EXPERIENCED: true
        };
        this.state.speech = null;
        this.state.end = null;
        this.state.thinking = null;
        this.state.tent = 'unheard';
        this.enter({
            kind: 'section', id: 'rewind'
        });
        this.emit();
        return true;
    }
    /** The execution reply must be read before its ending is applied. This is not the tutorial rewind. */
    finishExecution(): boolean {
        const speech = this.state.speech, previous = this.state.story.history.at(-1);
        if (this.state.phase !== 'reply' || speech?.status !== 'ready' || speech.result !== 'execute' || !speech.npcTurn
            || !previous || previous.accepted || previous.text !== speech.text || previous.feedback !== speech.npcTurn.reply.text
            || (this.state.round === 2 && !validAuthorization(this.state.story)))
            return false;
        this.cancelSpeech(false);
        this.state.phase = 'death';
        this.state.end = 'weiyan-execution';
        this.state.notesReturn = null;
        this.emit({ type: 'ending', id: 'weiyan-execution' });
        return true;
    }
    /** Re-enter only this round's introduction; clues, reasoning and real authorization remain intact. */
    retryWeiyanRound(): boolean {
        if (this.state.phase !== 'death' || this.state.end !== 'weiyan-execution'
            || (this.state.round === 2 && !validAuthorization(this.state.story)))
            return false;
        this.cancelSpeech(false);
        const round = this.state.round, section = round === 1 ? 'first-weiyan' : 'weiyan-approach';
        this.state.story.history = this.state.story.history.filter(h => speechHistoryRound(h, round) !== round);
        this.state.story.draft = '';
        this.state.story.selected = [];
        delete this.state.story.pending;
        if (round === 1)
            delete this.state.story.flags.FIRST_TRANSFER_ACCEPTED;
        else
            delete this.state.story.flags.PERSUADED;
        this.state.speech = null;
        this.state.lastFeedback = '';
        this.state.end = null;
        this.state.notesReturn = null;
        this.state.notesPurpose = 'review';
        this.state.composition = freshComposition();
        this.state.finishedSections = this.state.finishedSections.filter(id => id !== section);
        this.enter({ kind: 'section', id: section });
        this.emit();
        return true;
    }
    openNotes() {
        return this.thoughts.openNotes();
    }
    closeNotes() {
        return this.thoughts.closeNotes();
    }
    setThoughtMode(mode: 'reasoning' | 'language') {
        return this.thoughts.setThoughtMode(mode);
    }
    placeThought(id: string) {
        return this.thoughts.placeThought(id);
    }
    removeThought(id: string) {
        return this.thoughts.removeThought(id);
    }
    continueThought() { return this.thoughts.continueThought(); }
    think() {
        return this.thoughts.think();
    }
    reviseThought() {
        return this.thoughts.reviseThought();
    }
    connect(a: string, b: string) {
        return this.thoughts.connect(a, b);
    }
    deleteConnection(key: string) {
        return this.thoughts.deleteConnection(key);
    }
    place(id: string, x: number, y: number) {
        return this.thoughts.place(id, x, y);
    }
    followPlan() {
        return this.thoughts.followPlan();
    }
    selectEvidence(id: string) {
        return this.expressions.selectEvidence(id);
    }
    setDraft(text: string) {
        this.expressions.setDraft(text);
    }
    setFocus(text: string) {
        this.expressions.setFocus(text);
    }
    get canRestorePreviousDraft() {
        return this.expressions.canRestorePreviousDraft;
    }
    restorePreviousDraft() {
        return this.expressions.restorePreviousDraft();
    }
    cancelGeneration(emit = true) {
        this.expressions.cancelGeneration(emit);
    }
    generateExpression() {
        return this.expressions.generateExpression();
    }
    useExpressionHelp() {
        return this.expressions.useHelp();
    }
    expressionContext(text: string) {
        return this.expressions.expressionContext(text);
    }
    confirmExpression() {
        return this.expressions.confirmExpression();
    }
    retrySpeech() {
        return this.expressions.retrySpeech();
    }
    cancelSpeech(emit = true) {
        this.expressions.cancelSpeech(emit);
    }
    reviseExpression() {
        return this.expressions.reviseExpression();
    }
    acknowledgeReply() {
        return this.expressions.acknowledgeReply();
    }
    toMap(): boolean {
        if (this.state.phase !== 'ending' || !this.state.story.flags.REPORT_CLOSED)
            return false;
        this.state.phase = 'map';
        this.emit();
        return true;
    }
    restart() {
        this.cancelSpeech(false);
        this.state = freshSessionState(this.content.version, this.contentVersion);
        if(this.branch)this.branch=new BranchProgress(this.branch.story);
        this.enter(this.flow.entry);
        this.emit();
    }
    restore(raw: string) {
        if(this.branch) {
            const saved=JSON.parse(raw) as GameSessionState;
            if(!saved || saved.chapterId && saved.chapterId!=='wuzhang')throw Error('不是第一章存档。');
            const fresh=freshSessionState(this.content.version,this.contentVersion);
            if(saved.branch) {
                if(saved.schemaVersion!==1 || typeof saved.story?.run!=='string')throw Error('第一章存档身份不完整。');
                const branch=new BranchProgress(this.branch.story);branch.restore(saved.branch);
                this.branch=branch;this.state=fresh;
                this.state.story.run=saved.story.run;
                if(saved.phase==='cinematic' && saved.cinematic==='opening')this.enter(this.flow.entry);
                else {this.state.phase=saved.phase==='map' && branch.completed?'map':'branch';this.syncBranch(false);}
            } else {
                // Legacy content cannot safely resume halfway through rewritten dialogue.
                // The UI archives the original record before requesting this migration.
                restoreSessionState(raw,{content:this.content,flow:this.flow,contentVersion:saved.contentVersion,rows:this.rows,sections:this.sections});
                this.state=fresh;this.branch=new BranchProgress(this.branch.story);
                this.enter(this.flow.entry);
            }
            this.cancelSpeech(false);this.emit();return;
        }
        const restored = restoreSessionState(raw, {
            content: this.content, flow: this.flow, contentVersion: this.contentVersion,
            rows: this.rows, sections: this.sections,
        });
        this.cancelSpeech(false);
        this.state = restored;
        if (this.state.phase === 'explore') this.establishNarrativePlan();
        this.applyMode((restored.runtimeMode ?? 'ai') !== this.mode);
        this.emit();
    }
    branchAct(kind:'next'|'choose'|'ask'|'retry'|'offline'|'notice', value='', text='') {
        if(this.state.phase!=='branch'||!this.branch)return;
        const b=this.branch;
        if(kind==='notice')b.openNotice();else if(kind==='next')b.next();else if(kind==='choose')b.choose(value);else if(kind==='ask')b.ask(value);else if(kind==='retry')b.retry();else b.offline(value,text);
        this.syncBranch();
    }
    branchReply(text:string,result:AiReceipt) { if(this.state.phase!=='branch'||!this.branch)return;this.branch.apply(text,result);this.syncBranch(); }
    branchDraft(text:string) {if(this.branch)this.branch.draft=text.slice(0,800);}
    branchChanged() { this.emit(); }
    private syncBranch(emit=true) {
        const b=this.branch!;const g=b.dialogue;
        this.state.round=g.state.deathSeen?2:1;
        this.state.scene=g.nodeId.includes('JIANG')?'jiangwei_tent_front':g.nodeId.includes('ORDER')||g.nodeId==='C01-REPORT'?'report_post':'camp_gate';
        this.state.story.flags.REPORT_CLOSED=b.completed;
        this.state.end=b.completed?'safe':null;
        if(g.node.kind==='terminal' && b.completed)this.state.phase='map';
        const ending=g.node.endingId;
        if(emit)this.emit(ending&&b.atLastLine?{type:'ending',id:({'E-COOP':'branch-coop','E-FORMAL':'branch-formal','E-DEATH':'tutorial-sacrifice','E-LAMP':'branch-lamp'} as Record<string,string>)[ending]}:{type:'line'});
    }
}
