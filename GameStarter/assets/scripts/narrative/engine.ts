import type { Chapter, DialogueNode, Line, Outcome, Effect, JudgeRequest, JudgeResult, Value, Condition } from '../../../../content/schema/narrative';
import { evaluate, emptyContext, InteractionContext } from './conditions';
import { createState, cloneState, rewindState, validateState, uniqueId, RuntimeState } from './state';
import { JudgePort, validateJudgeResult } from './judge';
import { isWeiyan, weiyanReply } from './weiyan';
interface Session { nodeId: string; lines: Line[]; index: number; phase: 'opening' | 'reply'; outcome?: Outcome; outcomeKey?: string; context: InteractionContext; }
export type SubmitResult = { kind: 'judged'; result: JudgeResult } | { kind: 'stale' } | { kind: 'technical_error'; message: string };
function usesEvidence(c: Condition): boolean {
    return 'evidence' in c || ('all' in c && c.all.some(usesEvidence)) || ('any' in c && c.any.some(usesEvidence)) || ('not' in c && usesEvidence(c.not));
}
function requirePresentation(c: Condition): Condition {
    if ('evidence' in c) return { ...c, mode: 'presented' };
    if ('all' in c) return { all: c.all.map(requirePresentation) };
    if ('any' in c) return { any: c.any.map(requirePresentation) };
    if ('not' in c) return { not: requirePresentation(c.not) };
    return c;
}
export class NarrativeEngine {
    private state: RuntimeState;
    private session: Session | null = null;
    private selectedActor: string | null = null;
    private selection = emptyContext();
    private pending: JudgeRequest | null = null;
    private pendingNext: string | null = null;
    private controller: AbortController | null = null;
    private uiEpoch = 0;
    constructor(readonly chapter: Chapter, readonly contentVersion: string, private readonly judge: JudgePort) {
        this.state = createState(chapter, contentVersion);
    }
    snapshot(): RuntimeState { return cloneState(this.state); }
    /** Cancel only the in-flight response, leaving the current conversation and draft available. */
    cancelFreeInput(): void {
        this.controller?.abort(); this.controller = null; this.pending = null; this.uiEpoch++;
    }
    save(): string {
        const checkpoint = this.session && this.session.phase === 'opening' && !this.currentLine() &&
            ([...(this.chapter.readOnlyCheckpointNodeIds ?? []), 'weiyan.negotiate', 'tutorial.weiyan.negotiate'].includes(this.session.nodeId)) ? this.session.nodeId : undefined;
        if ((this.session && !checkpoint) || this.pending || this.pendingNext) throw new Error('Save only at a completed interaction boundary');
        const saved = cloneState(this.state);
        if (checkpoint) saved.checkpointNodeId = checkpoint;
        return JSON.stringify(saved);
    }
    load(json: string): void {
        const restored = validateState(this.chapter, this.contentVersion, JSON.parse(json));
        const checkpoint = restored.checkpointNodeId;
        const context: InteractionContext = { actorId: restored.presentation?.actorId ?? null, evidenceIds: restored.presentation?.evidenceIds ?? [], intentId: null };
        if (checkpoint && !evaluate(this.node(checkpoint).availableWhen, restored, context)) throw new Error('Unavailable saved checkpoint');
        if (checkpoint && ['weiyan.negotiate', 'tutorial.weiyan.negotiate'].includes(checkpoint)) {
            const required = checkpoint === 'weiyan.negotiate' ? ['entry_notice', 'scout_statement', 'jiangwei_authorization'] : ['entry_notice', 'scout_statement'];
            const noticeFlag = checkpoint === 'weiyan.negotiate' ? 'loop.weiyan_notice_presented' : 'loop.tutorial_notice_presented';
            if (context.actorId !== 'weiyan' || !restored.flags[noticeFlag] || required.some(id => !context.evidenceIds.includes(id)))
                throw new Error('Saved negotiation requires actually submitted evidence');
        }
        delete restored.checkpointNodeId;
        this.invalidate(); this.state = restored;
        if (restored.presentation) { this.selectedActor = restored.presentation.actorId; this.selection = context; }
        if (checkpoint) {
            const node = this.node(checkpoint);
            this.selectedActor = node.characterId; this.selection = { ...context, actorId: node.characterId };
            this.startNode(node, this.selection); this.session!.index = node.lines.length;
        }
    }
    rewind(revival = false): void {
        this.invalidate(); this.state = rewindState(this.chapter, this.state);
        this.transact(() => {
            this.log('rewind', this.state.sceneId, {}); this.settle(emptyContext());
            const next = this.pendingNext; this.pendingNext = null;
            if (this.chapter.restart && this.chapter.restart.preserveFlagIds.every(id => this.state.flags[id] === true))
                this.follow(revival ? this.chapter.restart.revivalNodeId : this.chapter.restart.restartNodeId);
            else if (next) this.follow(next);
        });
    }
    private invalidate(): void {
        this.controller?.abort(); this.controller = null; this.pending = null; this.session = null;
        this.pendingNext = null; this.selectedActor = null; this.selection = emptyContext(); this.uiEpoch++;
        delete this.state.presentation;
        if (this.state.flags['loop.result'] === 'none') {
            if ('loop.weiyan_notice_presented' in this.state.flags) this.state.flags['loop.weiyan_notice_presented'] = false;
            if (this.state.flags['loop.tutorial_notice_presented']) {
                this.state.flags['loop.tutorial_notice_presented'] = false;
                this.state.flags['loop.tutorial_step'] = 'block';
            }
        }
    }
    private ok(c: Parameters<typeof evaluate>[0], context = this.selection): boolean { return evaluate(c, this.state, context); }
    private node(id: string): DialogueNode { const n = this.chapter.dialogues.find(x => x.id === id); if (!n) throw new Error(`Unknown node ${id}`); return n; }
    private seen(n: DialogueNode): boolean { return n.repeat === 'once_per_loop' ? this.state.visited.includes(n.id) : n.repeat === 'once_ever' && this.state.visitedEver.includes(n.id); }
    private actorAt(id: string, sceneId: string): boolean {
        const actor = this.chapter.characters.find(x => x.id === id);
        if (!actor || !this.ok(actor.visibleWhen)) return false;
        const places = actor.placements.filter(p => this.ok(p.when));
        if (places.length > 1) throw new Error(`Ambiguous placement ${id}`);
        return places[0]?.sceneId === sceneId;
    }
    interactions() {
        const scenes = this.chapter.scenes.filter(s => this.ok(s.visibleWhen)).map(s => ({ ...s, enabled: this.ok(s.enterWhen) }));
        const characters = this.chapter.characters.filter(a => this.actorAt(a.id, this.state.sceneId))
            .map(a => ({ ...a, enabled: this.ok(a.talkWhen) }));
        const candidates = this.selectedActor && characters.some(a => a.id === this.selectedActor && a.enabled)
            ? this.chapter.dialogues.filter(n => n.sceneId === this.state.sceneId && n.characterId === this.selectedActor && n.trigger !== 'event' && !this.seen(n) && this.ok(n.availableWhen)) : [];
        const topics: DialogueNode[] = [];
        for (const id of new Set(candidates.map(n => `${n.trigger}:${n.topicId}`))) {
            const matches = candidates.filter(n => `${n.trigger}:${n.topicId}` === id).sort((a, b) => b.priority - a.priority);
            if (matches.length > 1 && matches[0].priority === matches[1].priority) throw new Error(`Ambiguous topic ${id}`);
            topics.push(matches[0]);
        }
        const choices = this.session && !this.currentLine() && this.session.phase === 'opening'
            ? this.node(this.session.nodeId).choices.filter(c => this.ok(c.visibleWhen, { ...this.session!.context, intentId: c.intentId })).map(c => ({ ...c, enabled: this.ok(c.enabledWhen, { ...this.session!.context, intentId: c.intentId }) })) : [];
        return { scenes, characters, topics, choices, actorId: this.selectedActor,
            actions: this.chapter.actions.filter(a => this.ok(a.availableWhen)), evidence: this.chapter.evidence.filter(e => !!this.state.evidence[e.id]),
            promises: Object.values(this.state.promises), feedback: this.session ? this.state.feedback[this.session.nodeId] ?? null : null, pending: !!this.pending,
            nodeId: this.session?.nodeId ?? null, line: this.currentLine(), freeInput: this.session?.phase === 'opening' && !this.currentLine() ? this.node(this.session.nodeId).freeInput : null };
    }
    private assertCanNavigate(): void {
        if (this.pendingNext || (this.session && (this.session.phase === 'reply' || this.node(this.session.nodeId).trigger === 'event'))) throw new Error('Finish the selected result segment first');
    }
    enterScene(id: string): void {
        this.assertCanNavigate();
        const scene = this.chapter.scenes.find(s => s.id === id);
        if (!scene || !this.ok(scene.visibleWhen) || !this.ok(scene.enterWhen)) throw new Error(scene?.lockedText || 'Scene unavailable');
        this.invalidate(); this.state.sceneId = id; this.log('scene', id, {});
    }
    selectCharacter(id: string): void {
        this.assertCanNavigate();
        const actor = this.chapter.characters.find(a => a.id === id);
        if (!actor || !this.actorAt(id, this.state.sceneId) || !this.ok(actor.talkWhen)) throw new Error(actor?.unavailableText || 'Character unavailable');
        this.invalidate(); this.selectedActor = id; this.selection.actorId = id;
    }
    presentEvidence(ids: string[], intentId: string | null = null): void {
        this.assertCanNavigate();
        if (!this.selectedActor) throw new Error('Select a character first');
        if (ids.length !== 1) throw new Error('Present exactly one evidence item');
        this.assertEvidence(ids); this.controller?.abort(); this.pending = null; this.controller = null; this.session = null; this.pendingNext = null; this.uiEpoch++;
        const previous = this.selectedActor === 'weiyan' ? this.presentedEvidence() : [];
        this.selection = { actorId: this.selectedActor, evidenceIds: [...new Set([...previous, ...ids])], intentId };
        this.state.presentation = { actorId: this.selectedActor, sceneId: this.state.sceneId, evidenceIds: [...this.selection.evidenceIds] };
        this.log('present_evidence', this.selectedActor, {}, { ...this.selection, evidenceIds: ids });
    }
    presentedEvidence(): string[] {
        const p = this.state.presentation;
        return p?.actorId === this.selectedActor && p.sceneId === this.state.sceneId ? [...p.evidenceIds] : [];
    }
    evidenceProgress() {
        const required = this.selectedActor === 'weiyan' && this.presentedEvidence().includes('entry_notice') &&
            (this.state.flags['loop.weiyan_notice_presented'] || this.state.flags['loop.tutorial_notice_presented'])
            ? this.state.flags['progress.tutorial_completed'] ? ['scout_statement', 'jiangwei_authorization'] : ['scout_statement'] : [];
        return { required, submitted: this.presentedEvidence(), missing: required.filter(id => !this.presentedEvidence().includes(id)) };
    }
    supportsEvidencePresentation(actorId: string): boolean {
        return this.chapter.dialogues.some(n => n.characterId === actorId &&
            (n.trigger === 'present_evidence' || (n.trigger === 'topic' && usesEvidence(n.availableWhen))));
    }
    /** Failed presentations leave the current line, options and gameplay state untouched. */
    tryPresentEvidence(ids: string[]): boolean {
        const actor = this.selectedActor;
        if (!actor || ids.length !== 1 || this.pending || this.pendingNext ||
            (this.session && (this.session.phase === 'reply' || this.node(this.session.nodeId).trigger === 'event'))) return false;
        if (!this.supportsEvidencePresentation(actor) || ids.some(id => this.state.evidence[id]?.loopId !== this.state.loopId)) return false;
        const person = this.chapter.characters.find(a => a.id === actor)!;
        if (!this.actorAt(actor, this.state.sceneId) || !this.ok(person.talkWhen)) return false;
        const progress = this.evidenceProgress();
        if (progress.submitted.includes(ids[0]) && actor === 'weiyan') return false;
        if (actor === 'weiyan' && progress.required.length && !progress.missing.includes(ids[0])) return false;
        const context: InteractionContext = { actorId: actor, evidenceIds: [...new Set([...(actor === 'weiyan' ? progress.submitted : []), ...ids])], intentId: null };
        const matches = this.chapter.dialogues.filter(n => {
            if (n.sceneId !== this.state.sceneId || n.characterId !== actor || this.seen(n)) return false;
            if (n.trigger === 'present_evidence') {
                if (!this.ok(n.availableWhen, context)) return false;
                // Evidence presentation is a gameplay step, not a semantic acceptance test.
                if (actor === 'weiyan' && n.freeInput)
                    return progress.required.every(id => context.evidenceIds.includes(id));
                const judge = this.chapter.judges.find(j => j.id === n.freeInput?.judgeId);
                return judge ? judge.acceptedIntentIds.some(intentId => judge.acceptanceCases.some(c => this.ok(c.when, { ...context, intentId }))) : this.ok(requirePresentation(n.availableWhen), context);
            }
            return n.trigger === 'topic' && usesEvidence(n.availableWhen) && this.ok(requirePresentation(n.availableWhen), context);
        }).sort((a, b) => b.priority - a.priority);
        const match = matches[0];
        if (!match) {
            if (progress.required.includes(ids[0]) && progress.missing.includes(ids[0])) {
                this.transact(() => this.presentEvidence(ids)); return true;
            }
            return false;
        }
        if (matches.length > 1 && match.priority === matches[1].priority) throw new Error('Ambiguous evidence presentation');
        this.transact(() => { this.presentEvidence(ids); this.openTopic(match.topicId, match.trigger as 'topic' | 'present_evidence'); });
        return true;
    }
    openTopic(topicId: string, trigger: 'topic' | 'present_evidence' = 'topic'): void {
        this.assertCanNavigate();
        const match = this.interactions().topics.find(n => n.topicId === topicId && n.trigger === trigger);
        if (!match) throw new Error('Topic unavailable');
        if (['weiyan.negotiate', 'tutorial.weiyan.negotiate'].includes(match.id) &&
            (!this.evidenceProgress().required.length || this.evidenceProgress().missing.length)) throw new Error('Present the required evidence first');
        this.startNode(match, { ...this.selection, evidenceIds: [...this.selection.evidenceIds] });
    }
    private startNode(node: DialogueNode, context: InteractionContext): void {
        this.controller?.abort(); this.pending = null; this.controller = null; this.uiEpoch++; this.session = { nodeId: node.id, lines: node.lines, index: 0, phase: 'opening', context };
        this.advanceHidden();
    }
    currentLine(): Line | null { return this.session?.lines[this.session.index] ?? null; }
    private advanceHidden(): void {
        while (this.session && this.currentLine()?.when && !this.ok(this.currentLine()!.when!, this.session.context)) this.session.index++;
    }
    confirmLine(id: string): boolean {
        if (!this.session || this.currentLine()?.id !== id) return false;
        const line = this.currentLine()!;
        this.transact(() => {
            const notice = ['weiyan.notice', 'tutorial.weiyan.notice'].includes(this.session!.nodeId);
            const presentation = notice ? [...this.state.history].reverse().find(h => h.kind === 'present_evidence' && h.actorId === 'weiyan' && h.evidenceIds.includes('entry_notice'))?.id : undefined;
            this.commit(`line:${this.session!.nodeId}:${id}${presentation ? ':' + presentation : ''}`, line.effects, 'line', id, this.session!.context);
            if (line.mediaId && !this.state.seenMedia.includes(line.mediaId)) this.state.seenMedia.push(line.mediaId);
            this.session!.index++; this.advanceHidden(); this.settle(this.session!.context);
        });
        return true;
    }
    /** Skips only the already selected linear segment; never chooses a branch/action. */
    skipCurrentSegment(): void { while (this.currentLine()) this.confirmLine(this.currentLine()!.id); }
    completeSegment(options: { deferRestart?: boolean } = {}): void {
        if (!this.session || this.currentLine()) throw new Error('Confirm current lines first');
        const s = this.session, n = this.node(s.nodeId);
        if (s.phase === 'opening' && (n.choices.length || n.freeInput)) return;
        this.transact(() => {
            const effects = s.phase === 'reply' ? s.outcome!.effects : n.onComplete;
            this.commit(s.outcomeKey ?? `complete:${n.id}`, effects, 'outcome', n.id, s.context);
            if (!this.state.visited.includes(n.id)) this.state.visited.push(n.id);
            if (!this.state.visitedEver.includes(n.id)) this.state.visitedEver.push(n.id);
            this.settle(s.context);
            const next = this.pendingNext ?? (s.phase === 'reply' ? s.outcome!.next : n.next);
            this.session = null; this.selection = { actorId: this.selectedActor, evidenceIds: this.presentedEvidence(), intentId: null };
            this.pendingNext = null; this.uiEpoch++;
            if (next) this.follow(next);
        });
        // A presentation may save and show this ending before the player chooses revival.
        if (n.id === this.chapter.restart?.afterNodeId && !options.deferRestart) this.rewind(true);
    }
    private follow(id: string): void {
        const node = this.node(id), scene = this.chapter.scenes.find(x => x.id === node.sceneId)!;
        if (!this.ok(scene.visibleWhen) || (node.trigger !== 'event' && !this.ok(scene.enterWhen)) || !this.ok(node.availableWhen, emptyContext()) || this.seen(node)) throw new Error(`Next node unavailable ${id}`);
        delete this.state.presentation;
        this.state.sceneId = scene.id; this.selectedActor = node.characterId;
        this.selection = { actorId: node.characterId, evidenceIds: [], intentId: null };
        this.startNode(node, this.selection);
    }
    choose(choiceId: string, interactionId: string): boolean {
        if (!interactionId) throw new Error('Missing interaction ID');
        if (this.state.committed.includes(`interaction:${interactionId}`)) return false;
        const s = this.session;
        if (!s || this.currentLine() || s.phase !== 'opening' || this.pending) throw new Error('Choice unavailable');
        const choice = this.node(s.nodeId).choices.find(c => c.id === choiceId);
        const context = { ...s.context, intentId: choice?.intentId ?? null };
        if (!choice || !this.ok(choice.visibleWhen, context) || !this.ok(choice.enabledWhen, context)) throw new Error(choice?.lockedText || 'Choice unavailable');
        this.transact(() => {
            if (choice.actionId) this.applyAction(choice.actionId, context);
            this.state.committed.push(`interaction:${interactionId}`);
            this.log('choice', choice.id, {}, context);
            this.reply(choice.outcome, `choice:${s.nodeId}:${choice.id}`, context);
        });
        return true;
    }
    executeAction(id: string, interactionId: string): boolean {
        if (!interactionId) throw new Error('Missing interaction ID');
        if (this.state.committed.includes(`interaction:${interactionId}`)) return false;
        if (this.pending || this.session) throw new Error('Finish dialogue before executing an action');
        this.transact(() => {
            this.state.committed.push(`interaction:${interactionId}`);
            this.applyAction(id, this.selection);
            const next = this.pendingNext ?? this.chapter.actions.find(a => a.id === id)!.next;
            this.pendingNext = null; this.selection = emptyContext(); this.selection.actorId = this.selectedActor;
            if (next) this.follow(next);
        });
        return true;
    }
    private applyAction(id: string, context: InteractionContext): void {
        const action = this.chapter.actions.find(a => a.id === id);
        if (!action || !this.ok(action.availableWhen, context)) throw new Error(`Action unavailable ${id}`);
        this.applyEffects(action.effects.filter(e => e.type !== 'fulfillPromise'), context, id); this.state.actions.push(id);
        this.log('action', id, {}, context);
        for (const p of Object.values(this.state.promises)) if (p.status === 'pending') {
            const def = this.chapter.promises.find(x => x.id === p.id)!;
            if (def.requiredActionIds.includes(id) && !p.actions.includes(id)) p.actions.push(id);
            if (action.timeCost === 'delay') {
                p.delays++; this.log(p.delays >= def.delayBudget ? 'promise_break' : 'promise_warning', p.id, {}, context);
                if (p.delays >= def.delayBudget) { p.status = 'broken'; this.applyEffects(def.brokenEffects, context, id); }
            }
            if (p.status === 'pending' && def.requiredActionIds.every(a => p.actions.includes(a)) && this.ok(def.completedWhen, context)) p.status = 'fulfilled';
        }
        this.applyEffects(action.effects.filter(e => e.type === 'fulfillPromise'), context, id);
        this.settle(context);
        if (!this.pendingNext && action.next) this.pendingNext = action.next;
    }
    private reply(outcome: Outcome, key: string, context: InteractionContext): void {
        const s = this.session!; this.uiEpoch++;
        this.session = { nodeId: s.nodeId, lines: outcome.reply, index: 0, phase: 'reply', outcome, outcomeKey: key, context };
        this.advanceHidden();
    }
    async submitFreeInput(intentId: string, evidenceIds: string[], text: string): Promise<SubmitResult> {
        const s = this.session;
        if (!s || s.phase !== 'opening' || this.currentLine() || this.pending) throw new Error('Input unavailable');
        const n = this.node(s.nodeId), input = n.freeInput;
        if (!input || !input.intentOptions.some(x => x.id === intentId) || !text.trim() || text.length > input.maxLength) throw new Error('Invalid input');
        this.assertEvidence(evidenceIds);
        if (input.evidenceSelection === 'required' && !evidenceIds.length) throw new Error('Select evidence');
        const def = this.chapter.judges.find(j => j.id === input.judgeId)!;
        if (!def.acceptedIntentIds.includes(intentId)) throw new Error('Intent unavailable');
        this.state.drafts[n.id] = text;
        const actualEvidence = ['weiyan.negotiate', 'tutorial.weiyan.negotiate'].includes(n.id) ? this.presentedEvidence() : evidenceIds;
        if (['weiyan.negotiate', 'tutorial.weiyan.negotiate'].includes(n.id) &&
            (this.evidenceProgress().missing.length || evidenceIds.some(id => !actualEvidence.includes(id)))) throw new Error('Evidence not submitted in this conversation');
        const context: InteractionContext = { actorId: n.characterId, evidenceIds: [...new Set(actualEvidence)], intentId };
        // Two presentations form one teaching negotiation, not NPC memory. The notice must
        // have been confirmed on screen in this loop; inventory alone never supplies it.
        if (((n.id === 'tutorial.weiyan.negotiate' && this.state.flags['loop.tutorial_notice_presented'] === true) ||
            (n.id === 'weiyan.negotiate' && this.state.flags['loop.weiyan_notice_presented'] === true)) &&
            this.state.evidence.entry_notice?.loopId === this.state.loopId && !context.evidenceIds.includes('entry_notice'))
            context.evidenceIds.push('entry_notice');
        if (!this.ok(n.availableWhen, context)) throw new Error('Input prerequisites changed');
        // NPC owns only current-loop facts; player memory and other actors' histories are excluded.
        const caseFlags = new Set<string>();
        const inspect = (c: Parameters<typeof evaluate>[0]): void => {
            if ('flag' in c) caseFlags.add(c.flag);
            else if ('all' in c) c.all.forEach(inspect);
            else if ('any' in c) c.any.forEach(inspect);
            else if ('not' in c) inspect(c.not);
        };
        def.acceptanceCases.forEach(c => inspect(c.when));
        const constraints = this.chapter.initialFlags.filter(f => f.scope === 'loop' && caseFlags.has(f.id) && f.owner !== n.characterId)
            .map(f => `程序校验事实（不代表NPC已知）：${f.id}=${JSON.stringify(this.state.flags[f.id])}`);
        const facts = this.chapter.initialFlags.filter(f => f.scope === 'loop' && f.owner === n.characterId)
            .map(f => `${f.id}=${JSON.stringify(this.state.flags[f.id])}`);
        const history = this.state.history.filter(e => e.loopId === this.state.loopId && e.actorId === n.characterId).slice(-6)
            .map(e => `${e.kind}:${e.target}; evidence=${e.evidenceIds.join(',')}`);
        const request: JudgeRequest = { requestId: uniqueId('judge'), loopId: this.state.loopId, stateRevision: this.state.revision,
            nodeId: n.id, characterId: n.characterId, intentId, evidenceIds: context.evidenceIds, text,
            context: [this.chapter.characters.find(a => a.id === n.characterId)!.motivation,
                `当前目标证词：${n.targetStatement ?? ''}`, ...facts, ...constraints, ...(n.id === 'weiyan.negotiate' ? [] : history),
                ...(this.state.feedback[n.id]?.missingPoints ?? []).map(point => `上次待补充（须重新核验）：${point}`),
                ...Object.values(this.state.promises).filter(p => p.actorId === n.characterId).map(p => `本轮承诺 ${p.id}:${p.status}`)] };
        if (n.id === 'weiyan.negotiate' || n.id === 'tutorial.weiyan.negotiate') {
            request.context = [];
            request.weiyan = { engineFacts: { approval: this.state.flags['loop.jiangwei_approval'] === true } };
        }
        this.pending = request; const epoch = this.uiEpoch; const controller = new AbortController(); this.controller = controller;
        const stale = () => this.pending !== request || this.state.loopId !== request.loopId || this.state.revision !== request.stateRevision || this.uiEpoch !== epoch;
        try {
            const raw = await this.judge.judge(request, def, this.chapter.evidence.filter(e => request.evidenceIds.includes(e.id)), controller.signal);
            if (stale()) return { kind: 'stale' };
            const result = validateJudgeResult(raw, request, def);
            this.assertEvidence(result.supportedEvidenceIds);
            if (result.interpretedIntentId && !input.intentOptions.some(i => i.id === result.interpretedIntentId)) throw new Error('Intent not offered by current input');
            const acceptedContext = { ...context, intentId: result.interpretedIntentId ?? intentId };
            let outcome = input.outcomes[result.status];
            // Wei Yan's AI verdict directly selects the authored branch, with no second semantic gate.
            if (result.status === 'accept' && !isWeiyan(request)) {
                if (input.evidenceSelection === 'required' && !result.supportedEvidenceIds.length) throw new Error('Acceptance without supported evidence');
                const match = def.acceptanceCases.find(c => this.ok(c.when, acceptedContext));
                outcome = match?.outcome ?? outcome;
            }
            // The program selects all effects first. The renderer may replace only the first line's text.
            if (isWeiyan(request)) {
                const anchor = weiyanReply(request, result, outcome).anchor;
                let wording = anchor;
                try { wording = this.judge.renderReply ? await this.judge.renderReply(request, result, outcome,
                    this.chapter.evidence.filter(e => request.evidenceIds.includes(e.id)), controller.signal) : anchor; }
                catch (error) { if (controller.signal.aborted) throw error; }
                if (stale()) return { kind: 'stale' };
                // Port implementations cannot remove or override the authored decision text.
                const safeText = wording.endsWith(anchor) && wording.length <= anchor.length + 70 ? wording : anchor;
                outcome = { ...outcome, reply: outcome.reply.map((line, i) => i ? line : { ...line, text: safeText }) };
            }
            this.transact(() => {
                this.state.feedback[n.id] = result; this.log(`judge:${result.status}`, n.id, {}, acceptedContext);
                this.reply(outcome, `judge:${request.requestId}`, acceptedContext); });
            return { kind: 'judged', result };
        } catch (e) {
            if (stale()) return { kind: 'stale' };
            return { kind: 'technical_error', message: e instanceof Error ? e.message : String(e) };
        } finally { if (this.pending === request) { this.pending = null; this.controller = null; } }
    }
    private assertEvidence(ids: string[]): void {
        if (ids.some(id => this.state.evidence[id]?.loopId !== this.state.loopId)) throw new Error('Evidence not held in current loop');
    }
    private commit(key: string, effects: Effect[], kind: string, target: string, context: InteractionContext): void {
        if (this.state.committed.includes(key)) return;
        this.state.committed.push(key); this.applyEffects(effects, context, target); this.log(kind, target, {}, context);
    }
    private applyEffects(effects: Effect[], context: InteractionContext, target: string): void {
        const changes: Record<string, Value> = {};
        const granted: string[] = [];
        for (const effect of effects) {
            if (effect.type === 'setFlag') {
                const def = this.chapter.initialFlags.find(f => f.id === effect.flag);
                if (!def || typeof effect.value !== typeof def.initial || (def.allowedValues && !def.allowedValues.includes(effect.value))) throw new Error(`Invalid flag ${effect.flag}`);
                this.state.flags[effect.flag] = effect.value; changes[effect.flag] = effect.value;
            } else if (effect.type === 'grantEvidence') {
                if (!this.chapter.evidence.some(e => e.id === effect.evidenceId)) throw new Error('Unknown evidence');
                if (!this.state.evidence[effect.evidenceId]) {
                    this.state.evidence[effect.evidenceId] = { loopId: this.state.loopId, nodeId: this.session?.nodeId ?? target, sourceEvent: '' };
                    granted.push(effect.evidenceId);
                }
            } else {
                const def = this.chapter.promises.find(p => p.id === effect.promiseId);
                if (!def) throw new Error('Unknown promise');
                const p = this.state.promises[def.id];
                if (effect.type === 'startPromise' && !p) this.state.promises[def.id] = { id: def.id, actorId: context.actorId ?? '', startedEvent: target, status: 'pending', actions: [], delays: 0 };
                if (effect.type === 'fulfillPromise') {
                    if (!p || p.status === 'broken' || !def.requiredActionIds.every(a => p.actions.includes(a)) || !this.ok(def.completedWhen, context)) throw new Error('Promise not actually fulfilled');
                    p.status = 'fulfilled';
                }
                if (effect.type === 'breakPromise' && p?.status === 'pending') { p.status = 'broken'; this.applyEffects(def.brokenEffects, context, target); }
            }
        }
        const eventId = this.log('effects', target, changes, context);
        for (const id of granted) this.state.evidence[id].sourceEvent = eventId;
    }
    private settle(context: InteractionContext): void {
        for (let pass = 0; pass <= this.chapter.events.length; pass++) {
            const event = [...this.chapter.events].sort((a, b) => b.priority - a.priority)
                .find(e => !this.state.firedEvents.includes(e.id) && this.ok(e.when, context));
            if (!event) return;
            this.state.firedEvents.push(event.id); this.applyEffects(event.effects, context, event.id);
            this.log('event', event.id, {}, context); if (event.next && !this.pendingNext) this.pendingNext = event.next;
        }
        throw new Error('Event settlement failed');
    }
    private log(kind: string, target: string, changes: Record<string, Value>, context = this.selection): string {
        this.state.revision++;
        const id = uniqueId('event');
        this.state.history.push({ id, loopId: this.state.loopId, revision: this.state.revision,
            actorId: context.actorId, kind, target, evidenceIds: [...context.evidenceIds], changes });
        return id;
    }
    private transact(work: () => void): void {
        const before = cloneState(this.state), session = this.session ? JSON.parse(JSON.stringify(this.session)) as Session : null;
        const next = this.pendingNext, epoch = this.uiEpoch, actor = this.selectedActor;
        const selection = { ...this.selection, evidenceIds: [...this.selection.evidenceIds] };
        try { work(); } catch (e) { this.state = before; this.session = session; this.pendingNext = next; this.uiEpoch = epoch; this.selectedActor = actor; this.selection = selection; throw e; }
    }
}
