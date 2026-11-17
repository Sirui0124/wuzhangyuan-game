import { hasExpressionMaterial } from '../../expression-contract';
import { eraArrestReply } from '../../phone/era-judgment';
import { ExpressionSafetyError, parseNpcTurn } from '../../npc-dialogue';
import { currentClueSources, clueSources, validAuthorization } from './thought-canvas-model';
import { clone, speechHistoryRound, WEIYAN_JUDGMENT_VERSION, type ExpressionGenerator, type ExpressionJudge, type ExpressionJudgeInput } from './session-state';
import type { ChapterSessionContext } from './session-context';
import { buildExpressionInput } from './expression-context';
import { expressionHelp } from './expression-help';
import { weiyanConfig } from '../../weiyan-prompt-config';
import { ExpressionAuditError } from '../../expression-audit';
import { consumeSupplies, isAvailableSupply, parseItemDecision, supplyById } from './supplies';
/** First-chapter expression state and cancellation. The AI adapter stays independent. */
export class ChapterExpressionActions {
    private request: AbortController | null = null;
    private generation: AbortController | null = null;
    private generationSeq = 0;
    constructor(private readonly context: ChapterSessionContext, private judge?: ExpressionJudge, private generate?: ExpressionGenerator) {
    }
    busy() {
        return !!this.request;
    }
    useHelp(): boolean {
        if (this.context.state.phase !== 'expression' || this.context.state.speech) return false;
        const text = expressionHelp(this.context.state);
        if (!text) return false;
        this.setDraft(text);
        this.context.state.composition.provenance = 'local';
        this.context.emit();
        return true;
    }
    selectEvidence(id: string): boolean {
        if (!['expression', 'thoughts'].includes(this.context.state.phase) || (this.context.state.round === 2 && !validAuthorization(this.context.state.story)) || this.context.state.speech)
            return false;
        if (!this.context.collected.includes(id) && !this.context.graph()[id])
            return false;
        this.cancelGeneration(false);
        this.context.state.composition.status = 'idle';
        const selected = this.context.state.story.selected;
        this.context.state.story.selected = selected.includes(id) ? selected.filter(other => other !== id) : [...selected, id];
        this.context.emit();
        return true;
    }
    setDraft(text: string) {
        if (this.context.state.speech)
            return;
        this.cancelGeneration(false);
        this.context.state.story.draft = text;
        this.context.state.composition.provenance = 'manual';
        this.context.state.composition.status = 'ready';
        this.context.emit();
    }
    setFocus(text: string) {
        if (this.context.state.speech)
            return;
        this.cancelGeneration(false);
        this.context.state.composition.focus = text.slice(0, 600);
        this.context.state.composition.status = 'idle';
        this.context.emit();
    }
    cancelGeneration(emit = true) {
        this.generation?.abort();
        this.generation = null;
        this.generationSeq++;
        if (this.context.state.composition.status === 'waiting')
            this.context.state.composition.status = 'cancelled';
        if (emit)
            this.context.emit();
    }
    get canRestorePreviousDraft(): boolean {
        const state = this.context.state;
        return state.phase === 'expression' && !state.speech && !!state.composition.previousDraft?.text.trim()
            && state.composition.previousDraft.text !== state.story.draft;
    }
    restorePreviousDraft(): boolean {
        if (!this.canRestorePreviousDraft) return false;
        this.cancelGeneration(false);
        const state = this.context.state, previous = state.composition.previousDraft!;
        state.story.draft = previous.text;
        state.composition.provenance = previous.provenance;
        state.composition.evidenceIds = [...previous.evidenceIds];
        state.composition.status = 'ready';
        state.composition.error = '';
        delete state.composition.diagnostic;
        delete state.composition.previousDraft;
        this.context.emit();
        return true;
    }
    async generateExpression(): Promise<boolean> {
        if (this.context.state.phase !== 'expression' || this.context.state.speech)
            return false;
        this.cancelGeneration(false);
        const input = buildExpressionInput(this.context), selected = input.brief.selectedEvidence;
        if (!hasExpressionMaterial(selected.length, input.brief.attachedItems?.length ?? 0, input.brief.playerIntent.words))
            return false;
        const controller = new AbortController(), seq = ++this.generationSeq;
        this.generation = controller;
        this.context.state.composition.status = 'waiting';
        this.context.state.composition.error = '';
        delete this.context.state.composition.diagnostic;
        this.context.emit();
        try {
            if (!this.generate)
                throw new Error('生成服务未接入');
            const result = await this.generate(input, controller.signal);
            if (controller.signal.aborted || seq !== this.generationSeq || this.context.state.phase !== 'expression')
                return false;
            if (typeof result.text !== 'string' || !result.text.trim() || result.text.length > 1200 || !Array.isArray(result.evidenceIds) || result.evidenceIds.some(id => !selected.some(e => e.id === id)))
                throw new Error('预览引用不兼容');
            const state = this.context.state;
            if (state.story.draft.trim() && state.story.draft !== result.text) state.composition.previousDraft = {
                text: state.story.draft, provenance: state.composition.provenance, evidenceIds: [...state.composition.evidenceIds],
            };
            else delete state.composition.previousDraft;
            this.context.state.story.draft = result.text;
            this.context.state.composition.provenance = result.provenance ?? 'ai';
            this.context.state.composition.evidenceIds = result.evidenceIds;
            this.context.state.composition.status = 'ready';
            this.context.emit();
            return true;
        }
        catch (error) {
            if (!controller.signal.aborted && seq === this.generationSeq) {
                this.context.state.composition.status = 'failed';
                if (error instanceof ExpressionAuditError) this.context.state.composition.diagnostic = error.diagnostic;
                const retained = this.context.state.story.draft.trim() ? '当前显示的是上一版文字。' : '你的选择与补充说明已保留。';
                this.context.state.composition.error = (error instanceof ExpressionSafetyError ? error.message : '润色服务暂时未完成，本次新稿未采用。') + retained;
                this.context.emit();
            }
            return false;
        }
        finally {
            if (this.generation === controller)
                this.generation = null;
        }
    }
    expressionContext(text: string): ExpressionJudgeInput {
        const items = this.context.state.speech?.items ?? this.context.state.supplies.attached;
        return {
            stage: this.context.state.round === 1 ? 'first' : 'authorized',
            evidence: this.context.content.clues.filter(c => this.context.collected.includes(c.id)).map(c => ({
                id: c.id, summary: c.summary, boundary: c.boundary, originals: currentClueSources(c.id, this.context.state.story.completed).map(id => {
                    const row = this.context.rows.get(id)!;
                    return {
                        id, speaker: row.speaker, text: row.text
                    };
                })
            })),
            said: this.context.state.story.history.filter(h => speechHistoryRound(h, this.context.state.round) === this.context.state.round).map(h => h.text), current: text,
            ...(items.length ? { items: items.map(id => {
                const item = supplyById(id, this.context.state.supplies);
                if (!item || !isAvailableSupply(id, this.context.state.supplies)) throw new Error('物品尚未购买或已消耗');
                return { id: item.id, name: item.name, ability: item.ability, boundary: item.boundary };
            }) } : {}),
        };
    }
    async confirmExpression(): Promise<boolean> {
        if (this.request || this.context.state.phase !== 'expression' || (this.context.state.round === 2 && !validAuthorization(this.context.state.story)) || !['ready', 'cancelled', 'failed'].includes(this.context.state.composition.status)
            || this.context.state.supplies.attached.some(id => !isAvailableSupply(id, this.context.state.supplies)))
            return false;
        const text = this.context.state.story.draft.trim();
        if (!text)
            return false;
        this.cancelGeneration(false);
        this.context.state.speech = {
            text, selected: [...this.context.state.story.selected], status: 'waiting', items: [...this.context.state.supplies.attached]
        };
        this.context.state.phase = 'spoken';
        this.context.emit({
            type: 'speech'
        });
        return this.judgeSpeech();
    }
    async retrySpeech(): Promise<boolean> {
        if (this.context.state.phase !== 'spoken' || !this.context.state.speech || this.context.state.speech.status === 'ready' || this.request || (this.context.state.round === 2 && !validAuthorization(this.context.state.story)))
            return false;
        return this.judgeSpeech();
    }
    private async judgeSpeech(): Promise<boolean> {
        const speech = this.context.state.speech;
        if (!speech)
            return false;
        const help = expressionHelp(this.context.state);
        const usesHelp = !!help && speech.text === help;
        if (!this.judge && !usesHelp) {
            speech.status = 'failed';
            this.context.emit({
                type: 'speech', message: '暂时无法理解自由表达，原话和依据已保留。'
            });
            return false;
        }
        const controller = new AbortController(), seq = ++this.context.state.story.requestSeq, run = this.context.state.story.run;
        this.request = controller;
        speech.status = 'waiting';
        this.context.emit({
            type: 'speech'
        });
        try {
            const input = this.expressionContext(speech.text);
            // Explicitly confirmed authored speech has a deterministic route; edits/items use the normal judge.
            const turn = usesHelp ? {
                schemaVersion: 1, npcId: 'weiyan', stage: input.stage,
                classification: { code: 'ok', disposition: 'accept', reason: '玩家确认了符合当前已得事实的参考说法。', evidenceIds: [] },
                reply: { speaker: '魏延', text: weiyanConfig.stages[input.stage].fixedAcceptReply },
            } : await this.judge!(input, controller.signal);
            if (controller.signal.aborted || seq !== this.context.state.story.requestSeq || run !== this.context.state.story.run || this.context.state.speech !== speech)
                return false;
            const material = 'itemDecision' in turn ? parseItemDecision(turn.itemDecision, speech.items ?? [], speech.text) : undefined;
            const checked = parseNpcTurn('npcTurn' in turn ? turn.npcTurn : turn, input.stage, input.evidence.map(e => e.id));
            if ((speech.items?.length && !material) || (material && (!speech.items?.length || input.stage !== 'authorized'
                || (checked.classification.code === 'ok') !== (!!material.route || material.mainlineAccepted === true)))) throw new Error('物品与回应不一致');
            if (material?.eraFailure && (checked.classification.code !== 'P2-F1' || checked.reply.text !== eraArrestReply)) throw new Error('时代失败回应不一致');
            if (material) speech.itemDecision = material;
            speech.status = 'ready';
            speech.result = checked.classification.code;
            speech.npcTurn = clone(checked);
            speech.judgmentVersion = WEIYAN_JUDGMENT_VERSION;
            this.context.emit({
                type: 'speech'
            });
            return true;
        }
        catch {
            if (seq === this.context.state.story.requestSeq && !controller.signal.aborted) {
                speech.status = 'failed';
                this.context.emit({
                    type: 'speech', message: '回应暂未到达，原话和依据已保留，可以重试或返回修改。'
                });
            }
            return false;
        }
        finally {
            if (this.request === controller)
                this.request = null;
        }
    }
    cancelSpeech(emit = true) {
        this.cancelGeneration(false);
        this.request?.abort();
        this.request = null;
        this.context.state.story.requestSeq++;
        if (this.context.state.speech?.status === 'waiting')
            this.context.state.speech.status = 'cancelled';
        if (emit)
            this.context.emit({
                type: 'speech'
            });
    }
    reviseExpression(): boolean {
        if (this.context.state.speech?.itemDecision?.eraFailure) return false;
        const rejectedReply = this.context.state.phase === 'reply' && this.context.state.speech?.status === 'ready' && this.context.state.speech.result !== 'ok' && this.context.state.speech.result !== 'execute';
        if (!this.context.state.speech || (!rejectedReply && (this.context.state.phase !== 'spoken' || this.context.state.speech.status === 'ready')))
            return false;
        const text = this.context.state.speech.text;
        this.cancelSpeech(false);
        this.context.state.speech = null;
        this.context.state.story.draft = text;
        this.context.state.composition.status = 'ready';
        this.context.state.composition.error = '';
        this.context.state.phase = 'expression';
        this.context.state.notesReturn = null;
        this.context.state.notesPurpose = 'P2';
        this.context.emit();
        return true;
    }
    acknowledgeReply(): boolean {
        const speech = this.context.state.speech;
        if (this.context.state.phase !== 'spoken' || !speech || speech.status !== 'ready' || !speech.result)
            return false;
        // A model outcome is never sufficient to create authorization or report events.
        if (this.context.state.round === 2 && !validAuthorization(this.context.state.story))
            return false;
        const accepted = speech.result === 'ok', feedback = speech.npcTurn?.reply.text ?? (accepted ? '' : this.context.rows.get(speech.result === 'R1-RETRY' ? 'A-40' : speech.result)!.text);
        if (accepted && speech.itemDecision?.itemIds.some(id => !isAvailableSupply(id, this.context.state.supplies))) return false;
        this.context.state.story.history.push({
            round: this.context.state.round, text: speech.text, feedback, accepted, ...(speech.npcTurn ? {
                npcTurn: clone(speech.npcTurn)
            } : {}), ...(speech.items?.length ? { items: [...speech.items], itemDecision: clone(speech.itemDecision!) } : {})
        });
        this.context.state.lastFeedback = feedback;
        if (accepted) {
            if (speech.itemDecision?.route) {
                this.context.state.supplies.agreement = clone(speech.itemDecision);
                consumeSupplies(this.context.state.supplies, speech.itemDecision.itemIds);
            }
            this.context.state.speech = null;
            this.context.state.story.draft = '';
            this.context.state.composition.status = 'idle';
            this.context.state.composition.provenance = 'manual';
            if (this.context.state.round === 1)
                this.context.enter({
                    kind: 'section', id: 'first-accepted'
                });
            else {
                this.context.state.story.flags.PERSUADED = true;
                this.context.enter({
                    kind: 'section', id: 'weiyan-cooperation'
                });
            }
        }
        else {
            // The player must see who answered and why before choosing to edit again.
            // Keep the committed speech, draft, focus and evidence intact throughout the reply.
            this.context.state.phase = 'reply';
            this.context.state.notesReturn = null;
        }
        this.context.emit({
            type: 'speech'
        });
        return true;
    }
}
