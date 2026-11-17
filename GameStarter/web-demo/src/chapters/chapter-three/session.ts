import { acquireWorldItem, sellWorldItem, freshWorldInventory, ownedWorldItems } from '../../inventory/world-items';
import { itemSystemEnabled } from '../../runtime-mode';
import { indexStoryGraph } from '../../session/story-graph';
import { freshSupplies, restoreSupplies, isAvailableSupply, supplyById, consumeSupplies } from '../../phone/supplies';
import { freshPhone, restorePhone } from '../../phone/phone-state';
import type { JietingEvaluationContext, JietingJudgment, JietingDialogueItem, JietingOpeningQuestion } from './ai-contracts';
import { fallbackOpeningQuestion } from './opening-question';
import type { JietingStory, JietingNode, JietingSave, JietingProgress, JietingCheckpoint, JietingMode, JietingCondition, JietingEffect, JietingRound, JietingOutcome, JietingRoundRecord } from './types';
import { JIETING_INITIAL_BELOW, JIETING_TOTAL, JIETING_TIGER, clampScore, contextDigest, troopsForOutcome, reinforcementOutcome, withdrawalReady, lurePlanReady, lureEligible, earlyWithdrawalEligible, rearReceptionEligible, guardAssessment } from './rules';
import { REINFORCEMENT_LIMIT, REINFORCEMENT_TARGET, argumentLedger, argumentSupported, argumentTopics, grantForJudgment, recordTopic, reinforcementGrant, troopWords } from './persuasion';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const emptyProgress = (node: string): JietingProgress => ({ node, visited: [], chosen: [], flags: {}, visits: [], scores: { w: 0, m: 0, r: 0 }, scoreEvents: [], clueIds: [], clueSourceNodes: {}, clueUpdates: {}, sourceReadings: {}, roundResults: {}, transcript: [], acceptedReasons: [], unresolvedConcerns: [], followupUsed: {}, ending: null, itemTrials: {}, lureItemIds: [], withdrawalItemIds: [], itemUses: [] });
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** All material outcomes are committed here, after their authored dialogue/action is read. */
export class JietingSession {
    readonly state: JietingSave;
    private readonly nodes: Map<string, JietingNode>;
    private mode: Required<JietingMode>;
    constructor(readonly story: JietingStory, saved?: unknown, mode: JietingMode = {}) {
        this.mode = { aiEnabled: mode.aiEnabled ?? true, phoneAllowed: mode.phoneAllowed ?? true };
        this.nodes = indexStoryGraph(story.nodes, story.start, '第三章');
        this.state = { ...emptyProgress(story.start), schema: 1, version: story.version, run: Date.now(), revision: 0, draft: '', selected: [], supplies: freshSupplies(), phone: freshPhone(), judgments: [], pendingJudgment: null, checkpoints: {} };
        if (saved != null) this.restore(saved);
        if (!this.state.checkpoints.act1) this.checkpoint('act1');
        this.resolveRoutes();
        this.applyModeToOpen();
    }
    get phoneAllowed() { return this.mode.phoneAllowed; }
    get scores() { return { ...this.state.scores }; }
    get below() { return JIETING_INITIAL_BELOW + Object.values(this.state.roundResults).reduce((n, r) => n + (r?.arrived ? r.troops : 0), 0); }
    get above() { return JIETING_TOTAL - this.below; }
    get round() { return this.current.round; }
    get guard() { return guardAssessment(this.scores, this.below, { early: this.state.flags.early === true, rearReception: this.state.flags.rearReception === true, failedLure: this.state.flags.failedLure === true }); }
    get current(): JietingNode {
        const raw = this.nodes.get(this.state.node)!;
        let text = raw.textVariants?.find(v => this.matches(v.when))?.text ?? raw.text;
        if (raw.kind === 'open' && raw.phase === 'reinforcement') text = this.state.guidedQuestions?.[raw.id]?.question ?? fallbackOpeningQuestion(raw.round!, this.below, this.state.roundResults);
        if (raw.id === 'JT-159' && this.state.roundResults[1]?.source === 'ai') text = '先前下来的兵已经照军令分派，王将军仍得看住正面和侧路。要从哪一处再抽人，都得把原先的差事交代好，不能空着。';
        const order = raw.effects?.find(e => e.type === 'round-order');
        if (order?.type === 'round-order') {
            const r = this.state.roundResults[order.round];
            if (r?.source === 'ai' && !r.troops) text = '这一回不再调兵。已有的差事照旧，你把回话带给子均。';
            if (r?.troops && (r.source === 'ai' || r.troops !== troopsForOutcome(r.outcome) || r.round > 3)) {
                const task = r.tasks.map(t => t === 'road' ? '守路' : t === 'water' ? '护水' : '留出接应').join('、');
                text = `再拨${troopWords(r.troops)}人下山。${task ? `照方才议定的，安排他们${task}。` : '照方才议定的安排交给王平。'}你把军令送去，等领队报明到营人数，再来回话。`;
            }
        }
        return { ...raw, text: text.replaceAll('{below}', this.below.toLocaleString('en-US')).replaceAll('{above}', this.above.toLocaleString('en-US')) };
    }
    get options() { return (this.current.options ?? []).filter(o => !o.when || this.matches(o.when)).map(o => o.id === 'JT-O171' && this.state.roundResults[1]?.source === 'ai' ? { ...o, text: '领队已经报过，各处都照原令分了人，正面和侧路仍得守。另派人护水，就不必抽走已经有差事的队伍。' } : o); }
    get clues() {
        return this.story.clues.filter(c => this.state.clueIds.includes(c.id)).map(c => ({ ...c,
            text: this.state.clueUpdates[c.id] ?? (c.id === 'JT-C10' ? `已经到营山下${this.below.toLocaleString('en-US')}人。${Object.values(this.state.roundResults).filter(r => r?.arrived && r.troops).map(r => `第${r!.round}次增派${r!.troops}人，${r!.tasks.map(t => t === 'road' ? '守路' : t === 'water' ? '护水' : '接应').join('、') || '按已经下达的军令部署'}。`).join('')}` : c.text),
            sources: c.sources.filter(s => this.state.clueSourceNodes[c.id]?.includes(s.node)).map(s => ({ ...s, ...this.state.sourceReadings[s.node] })),
            current: c.id === 'JT-C12' ? !this.state.flags.mountainRoadClosed : true,
        }));
    }
    get feedback() {
        const j = this.state.pendingJudgment;
        return j ? { speaker: '马谡', text: j.response, followup: j.status === 'followup', final: j.status === 'final' } : null;
    }
    snapshot() { return copy(this.state); }
    confirmOpeningQuestion(result: JietingOpeningQuestion, expectedDraft = '') {
        if (!this.mode.aiEnabled || this.current.kind !== 'open' || this.current.phase !== 'reinforcement' || this.feedback || this.state.draft !== expectedDraft
            || this.state.followupUsed[this.current.id] || result.nodeId !== this.current.id || result.contextKey !== this.getEvaluationContext().contextKey
            || !result.question.trim() || result.question.length > 140 || !/[?？]/u.test(result.question)
            || result.clueIds.some(id => !this.clues.some(c => c.id === id && c.current !== false))) return false;
        (this.state.guidedQuestions ??= {})[this.current.id] = { question: result.question, clueIds: [...result.clueIds] };
        this.state.revision++; return true;
    }
    setMode(mode: JietingMode) {
        this.mode = { aiEnabled: mode.aiEnabled ?? this.mode.aiEnabled, phoneAllowed: mode.phoneAllowed ?? this.mode.phoneAllowed };
        this.state.revision++;
        this.applyModeToOpen();
    }
    private applyModeToOpen() {
        if (!itemSystemEnabled() && /^JT-05[4-9]$/.test(this.current.id)) { this.go('JT-MA-END'); return; }
        if (this.mode.aiEnabled && this.current.kind === 'choice') {
            const match = /^JT-R([12345])-(?:FIXED|FOLLOW|SAFE-FIXED|SAFE-FOLLOW)$/.exec(this.current.id);
            if (match && !this.state.roundResults[Number(match[1]) as JietingRound]) {
                if (this.current.id.includes('FOLLOW')) this.state.unresolvedConcerns = [this.state.transcript.at(-1)?.text ?? '请把前一个理由接着说清。'];
                this.go(`JT-OPEN-R${match[1]}`); return;
            }
            if (this.current.id === 'JT-WITHDRAW-FIXED') { this.go('JT-OPEN-WITHDRAW'); return; }
        }
        if (this.current.kind !== 'open' || this.mode.aiEnabled || this.state.pendingJudgment) return;
        const n = this.current;
        const target = n.phase === 'reinforcement' ? n.round === 2 && this.gate('water-protected') ? 'JT-R2-SAFE-FIXED' : `JT-R${n.round}-FIXED` : n.phase === 'withdrawal' ? 'JT-WITHDRAW-FIXED' : 'JT-LURE-METHOD';
        this.go(target);
    }
    getEvaluationContext(): JietingEvaluationContext {
        const n = this.current;
        if (n.kind !== 'open' || !n.phase) throw new Error('当前不在可进言处');
        const items = this.dialogueItems();
        const verifiedClueIds = this.clues.filter(c => this.state.flags[`verified-${c.id}`] === true && c.current !== false).map(c => c.id);
        // A previous phase's unfinished question is history, not a new requirement for this scene.
        const previousPhase = this.state.judgments.at(-1)?.phase;
        const currentConcerns = previousPhase && previousPhase !== n.phase ? [] : this.state.unresolvedConcerns;
        const context: JietingEvaluationContext = { nodeId: n.id, contextKey: '', phase: n.phase, ...(n.round ? { round: n.round } : {}), currentQuestion: n.text, scores: this.scores, below: this.below, above: this.above,
            ownedClues: this.clues.map(c => ({ id: c.id, title: c.title, text: c.text, current: c.current })),
            confirmedTranscript: copy(this.state.transcript), acceptedReasons: copy(this.state.acceptedReasons.filter(r => r.clueIds.every(id => this.clues.some(c => c.id === id && c.current !== false)))),
            unresolvedConcerns: [...currentConcerns], followupUsed: !!this.state.followupUsed[n.id], verifiedClueIds,
            roundResults: copy(Object.values(this.state.roundResults).map(r => ({ ...r, adoptedItems: this.state.itemUses.filter(use => use.itemIds.some(id => r?.usedItemIds.includes(id))) }))), mode: this.mode.aiEnabled ? 'online' : 'offline', items,
            reinforcement: { limit: REINFORCEMENT_LIMIT, targetBelow: REINFORCEMENT_TARGET, arguments: argumentLedger(Object.values(this.state.roundResults)) } };
        context.contextKey = contextDigest({ context, run: this.state.run, revision: this.state.revision, draft: this.state.draft.trim(), selected: this.state.selected, mode: this.mode, itemTrials: this.state.itemTrials });
        return context;
    }
    dialogueItems(): JietingDialogueItem[] {
        if (!itemSystemEnabled() || !this.mode.phoneAllowed) return [];
        const s = this.state.supplies;
        return [...s.purchases.map(id => { const item = supplyById(id, s)!; const trial = this.state.itemTrials[id]; return { id, name: item.name, ability: item.ability, boundary: item.boundary, source: 'phone' as const, available: isAvailableSupply(id, s), shown: s.attached.includes(id), ...(trial ? { tested: true, observedEffect: trial.effect } : {}) }; }),
            ...ownedWorldItems(s.worldItems).map(i => ({ id: i.id, name: i.name, ability: i.description, boundary: '普通随身物品，不代表军令或将领授权。', source: 'world' as const, available: true, shown: false }))];
    }
    confirmItemPreparation(result: { version: number; nodeId: string; contextKey: string; itemId: string; input: string; status: string; operation: string; effect: string; requirements: { satisfied: boolean; sourceItemIds: string[]; specQuote: string }[] }) {
        if (this.current.kind !== 'open' || this.feedback || !this.phoneAllowed || !itemSystemEnabled() || result.version !== 1 || result.status !== 'ready'
            || result.nodeId !== this.current.id || result.contextKey !== this.getEvaluationContext().contextKey || !isAvailableSupply(result.itemId, this.state.supplies)
            || !result.input.trim() || !result.operation.trim() || !result.effect.trim() || !Array.isArray(result.requirements) || result.requirements.some(r => !r.satisfied || !r.specQuote || r.sourceItemIds.some(id => !isAvailableSupply(id, this.state.supplies)))) return false;
        this.state.itemTrials[result.itemId] = { input: result.input, operation: result.operation, effect: result.effect };
        this.state.transcript.push({ speaker: '试用', text: result.operation + ' ' + result.effect });
        this.state.revision++;
        return true;
    }
    sellWorldItem(id: string) {
        if (!itemSystemEnabled() || !this.phoneAllowed || this.current.kind !== 'open' || this.feedback || this.state.ending) return false;
        const result = sellWorldItem(this.state.supplies.worldItems ??= freshWorldInventory(), id);
        if (result) this.state.revision++;
        return result;
    }
    /** Confirmation stores an NPC response, never an order or an arrival. */
    submit(j: JietingJudgment) {
        const n = this.current;
        if (n.kind !== 'open' || !this.mode.aiEnabled || this.feedback || this.state.ending) return false;
        const context = this.getEvaluationContext();
        if (j.version !== 1 || j.nodeId !== n.id || j.contextKey !== context.contextKey || j.input !== this.state.draft.trim() || !j.input
            || !equal(j.clueIds, this.state.selected) || j.phase !== n.phase || j.round !== n.round || !['followup', 'final'].includes(j.status)
            || typeof j.response !== 'string' || !j.response.trim() || (j.status === 'followup' && this.state.followupUsed[n.id])
            || j.clueIds.some(id => !context.ownedClues.some(c => c.id === id && c.current !== false))) return false;
        const usedItemIds = j.usedItemIds ?? [];
        if (!Array.isArray(usedItemIds) || new Set(usedItemIds).size !== usedItemIds.length || usedItemIds.some(id => !context.items?.some(i => i.id === id && i.source === 'phone' && i.available && i.shown && i.tested && i.observedEffect))) return false;
        if (j.maintain && (!j.maintainQuote?.trim() || !j.input.includes(j.maintainQuote) || n.phase !== 'reinforcement')) return false;
        const criteria = ['factsReliable', 'gapEstablished', 'reinforcementUse', 'concernAnswered', 'risk', 'route', 'reception', 'motive', 'means', 'withdrawal'];
        if (!j.criteria || criteria.some(k => typeof j.criteria[k as keyof typeof j.criteria] !== 'boolean')) return false;
        if (j.special) {
            if (j.status !== 'final' || !j.special.quote || !j.input.includes(j.special.quote) || !['era-arrest', 'execution'].includes(j.special.kind)) return false;
            if (j.special.kind === 'era-arrest' && (!j.special.itemIds?.length || j.special.itemIds.some(id => !context.items?.some(i => i.id === id && i.source === 'phone' && i.available && i.shown && i.tested && i.observedEffect)))) return false;
        } else if (j.status === 'final') {
            const assessment = j.reinforcementAssessment;
            if (n.phase === 'reinforcement' && (!assessment || !Number.isInteger(assessment.supportedTroops) || assessment.supportedTroops < 0 || assessment.supportedTroops > 5000
                || (!j.criteria.concernAnswered && assessment.supportedTroops > 3000) || !assessment.reason?.trim() || typeof assessment.quote !== 'string'
                || (assessment.supportedTroops > 0 && (!assessment.quote.trim() || ![j.input, ...context.acceptedReasons.filter(r => r.round === n.round).map(r => r.text)].some(text => text.includes(assessment.quote)))))) return false;
            if (n.phase === 'reinforcement' && (!j.reasoning || typeof j.reasoning.linked !== 'boolean'
                || typeof j.reasoning.quote !== 'string' || typeof j.reasoning.conclusion !== 'string' || !Array.isArray(j.reasoning.clueIds)
                || j.reasoning.clueIds.some(id => !context.ownedClues.some(c => c.id === id && c.current !== false))
                || (j.reasoning.linked && (![j.input, ...context.acceptedReasons.filter(r => r.round === n.round).map(r => r.text)].some(text => text.includes(j.reasoning!.quote)) || new Set(j.reasoning.clueIds).size < 2)))) return false;
            if (n.phase === 'reinforcement' && grantForJudgment(j, Object.values(this.state.roundResults), this.below).outcome !== 'none'
                && (!j.argument || !argumentSupported(j.argument, context.ownedClues.filter(c => c.current !== false).map(c => c.id), [j.input, ...context.acceptedReasons.filter(r => r.round === n.round).map(r => r.text)]))) return false;
            const expected = n.phase === 'reinforcement' ? grantForJudgment(j, Object.values(this.state.roundResults), this.below).outcome : (n.phase === 'withdrawal' ? withdrawalReady(j.criteria) : lurePlanReady(j.criteria)) ? 'accepted' : 'revise';
            if (expected !== j.outcome) return false;
        }
        if (!Array.isArray(j.acceptedReasons) || !Array.isArray(j.unresolvedConcerns) || !Array.isArray(j.verifiedClueIds)
            || j.verifiedClueIds.some(id => !context.verifiedClueIds?.includes(id))
            || j.acceptedReasons.some(r => !r.text || r.clueIds.some(id => !context.ownedClues.some(c => c.id === id && c.current !== false)))) return false;
        this.checkpoint('open-' + n.id);
        this.state.pendingJudgment = copy(j);
        this.state.judgments.push(copy(j));
        this.state.transcript.push({ speaker: '我', text: j.input, ...(n.round ? { round: n.round } : {}) });
        // A recognized reason is retained for a follow-up, without granting deployment or new evidence.
        if (!j.special && j.criteria.factsReliable) for (const r of j.acceptedReasons) if (!this.state.acceptedReasons.some(a => a.text === r.text)) this.state.acceptedReasons.push(copy(r));
        this.state.unresolvedConcerns = [...j.unresolvedConcerns];
        return true;
    }
    advance(optionId?: string): boolean {
        const n = this.current;
        if (n.kind === 'ending' || this.state.ending) return false;
        if (n.kind === 'open') {
            const j = this.state.pendingJudgment;
            if (!j || optionId) return false;
            this.state.transcript.push({ speaker: '马谡', text: j.response, ...(n.round ? { round: n.round } : {}) });
            this.state.pendingJudgment = null; this.state.draft = ''; this.state.selected = []; this.state.revision++;
            if (j.special) { this.state.flags.specialOrigin = n.id; this.state.flags.specialKind = j.special.kind; this.go(j.special.kind === 'era-arrest' ? 'JT-403' : 'JT-410'); return true; }
            if (j.status === 'followup') { this.state.followupUsed[n.id] = true; this.applyModeToOpen(); return true; }
            this.markRead(n);
            if (n.phase === 'reinforcement' && n.round) this.setRoundResult(n.round, j.outcome as JietingOutcome, 'ai', j);
            if (n.phase === 'lure') { this.state.flags.lurePlanReady = lurePlanReady(j.criteria); this.state.lureItemIds = j.outcome === 'accepted' ? [...(j.usedItemIds ?? [])] : []; }
            if (n.phase === 'withdrawal') this.state.withdrawalItemIds = j.outcome === 'accepted' ? [...(j.usedItemIds ?? [])] : [];
            this.go(j.outcome === 'revise' ? n.phase === 'withdrawal' ? 'JT-245' : 'JT-300' : n.next!);
            return true;
        }
        if (n.kind === 'choice') {
            const option = this.options.find(o => o.id === optionId);
            if (!option) return false;
            this.markRead(n);
            if (!this.state.chosen.includes(option.id)) this.state.chosen.push(option.id);
            this.state.transcript.push({ speaker: '我', text: option.text });
            for (const effect of option.effects ?? []) this.effect(effect, n.id);
            this.state.revision++; this.go(option.next); return true;
        }
        if (optionId || !n.next) return false;
        this.markRead(n);
        if (n.text) this.state.transcript.push({ speaker: n.speaker, text: n.text, ...(n.round ? { round: n.round } : {}) });
        // Revisiting an editable final arrangement reapplies its decision; gains themselves are idempotent.
        for (const effect of n.effects ?? []) this.effect(effect, n.id);
        this.state.revision++; this.go(n.next); return true;
    }
    /** Retrying a completed branch restores narrative and money from the same checkpoint. */
    retry(target: 'round' | 'act1' | 'act2' | 'act3' | 'final' = 'round') {
        let name: string = target;
        if (target === 'round') {
            const origin = this.state.flags.specialOrigin;
            name = typeof origin === 'string' ? 'open-' + origin : this.current.act === 3 ? this.state.checkpoints.final ? 'final' : 'act3' : `round-${this.current.round ?? Math.min(REINFORCEMENT_LIMIT, Object.keys(this.state.roundResults).length + 1)}`;
        }
        const checkpoint = this.state.checkpoints[name] ?? (target === 'round' ? this.state.checkpoints.act2 : undefined);
        if (!checkpoint) return false;
        const nextRevision = this.state.revision + 1, retained = this.state.checkpoints;
        Object.assign(this.state, copy(checkpoint), { draft: '', selected: [], pendingJudgment: null, revision: nextRevision });
        this.state.checkpoints = Object.fromEntries(Object.entries(retained).filter(([, value]) => value.visited.every(id => this.state.visited.includes(id))));
        this.resolveRoutes(); this.applyModeToOpen(); return true;
    }
    private markRead(n: JietingNode) { if (!this.state.visited.includes(n.id)) this.state.visited.push(n.id); if (n.text) this.state.sourceReadings[n.id] = { speaker: n.speaker, text: n.text }; }
    private go(id: string) {
        if (!this.nodes.has(id)) throw new Error('剧情节点缺失');
        this.state.node = id; this.resolveRoutes();
        const n = this.current;
        if (n.kind === 'open' || /^JT-R[12345]-FIXED$/.test(n.id) || n.id === 'JT-R2-SAFE-FIXED') {
            if (n.round) this.checkpoint(`round-${n.round}`);
            else if (/^JT-R[12345]/.test(n.id)) this.checkpoint('round-' + n.id[4]);
        }
        if (n.id === 'JT-GUARD-CONFIRM' || n.id === 'JT-LURE-CONFIRM') this.checkpoint('final');
        if (n.kind === 'ending') { this.markRead(n); for (const e of n.effects ?? []) this.effect(e, n.id); }
    }
    private resolveRoutes() {
        const seen = new Set<string>();
        while (this.nodes.get(this.state.node)?.kind === 'route') {
            const n = this.nodes.get(this.state.node)!;
            if (seen.has(n.id)) throw new Error('第三章流程形成空循环'); seen.add(n.id);
            if (!this.state.visited.includes(n.id)) { this.markRead(n); for (const e of n.effects ?? []) this.effect(e, n.id); }
            const route = n.routes?.find(r => !r.when || this.matches(r.when));
            if (!route) throw new Error(`第三章缺少匹配分支：${n.id}`);
            this.state.node = route.next;
        }
    }
    private matches(c: JietingCondition): boolean {
        if ('flag' in c) return this.state.flags[c.flag] === (c.value ?? true);
        if ('visitedPlace' in c) return this.state.visits.includes(c.visitedPlace);
        if ('not' in c) return !this.matches(c.not);
        if ('all' in c) return c.all.every(v => this.matches(v));
        if ('any' in c) return c.any.some(v => this.matches(v));
        return this.gate(c.gate);
    }
    private gate(key: string): boolean {
        const outcome = /^r([12345])-(great|small)$/.exec(key);
        if (outcome) return this.state.roundResults[Number(outcome[1]) as JietingRound]?.outcome === outcome[2];
        switch (key) {
            case 'ai': return this.mode.aiEnabled;
            case 'items': return itemSystemEnabled();
            case 'all-visits': return this.state.visits.length === 3;
            case 'water-protected': return Object.values(this.state.roundResults).some(r => r?.arrived && r.troops > 0 && r.tasks.includes('water'));
            case 'r1-reinforced': return !!this.state.roundResults[1]?.arrived && this.state.roundResults[1].troops > 0;
            case 'lure-entry': return this.below >= 10000;
            case 'reinforcement-target': return this.below >= REINFORCEMENT_TARGET;
            case 'phone-ai': return this.mode.aiEnabled && this.mode.phoneAllowed && itemSystemEnabled();
            case 'ma-trust3': return this.scores.m >= 3;
            case 'early-eligible': return earlyWithdrawalEligible(this.scores);
            case 'rear-eligible': return rearReceptionEligible(this.scores);
            case 'guard-fails': return !this.guard.holds;
            case 'guard-rear-unsafe': return this.guard.holds && !this.guard.allRearSafe;
            case 'guard-masu-alive': return this.guard.masuAlive;
            case 'fixed-lure-eligible': return lureEligible(this.scores, this.below, 'fixed');
            case 'phone-lure-ready': return this.gate('phone-ai') && lureEligible(this.scores, this.below, 'phone') && this.state.flags.lurePlanReady === true;
            case 'lure-execution-ready': return this.state.flags.lurePlanReady === true && this.state.flags.lureAuthorized === true && this.state.flags.lureReceptionConfirmed === true && (this.state.flags.lureMethod === 'fixed' ? this.gate('fixed-lure-eligible') : this.gate('phone-lure-ready'));
            default: throw new Error(`未知第三章条件：${key}`);
        }
    }
    private setRoundResult(round: JietingRound, outcome: JietingOutcome, source: 'fixed' | 'ai', j?: JietingJudgment) {
        if (this.state.roundResults[round]) throw new Error('这次调兵已经议定');
        const tasks = source === 'fixed' ? round === 1 ? ['road' as const] : round === 2 ? [this.gate('water-protected') ? 'road' as const : 'water' as const] : ['reception' as const] : [...new Set(j?.deploymentTasks ?? [])];
        const topic = round === 4 ? 'mandate' as const : round === 5 ? 'initiative' as const : tasks[0] ?? 'road';
        const argument = j?.argument ?? { topic, quote: this.state.transcript.filter(t => t.speaker === '我').at(-1)?.text ?? '', clueIds: [] };
        const criteria = j?.criteria ?? { factsReliable: true, gapEstablished: outcome !== 'none', reinforcementUse: outcome !== 'none', concernAnswered: outcome === 'great' };
        const grant = j ? grantForJudgment(j, Object.values(this.state.roundResults), this.below) : reinforcementGrant(criteria as JietingJudgment['criteria'], argument, Object.values(this.state.roundResults), this.below);
        this.state.roundResults[round] = { round, outcome: grant.outcome, troops: grant.troops, ordered: false, arrived: false, reported: false, source, ...(source === 'fixed' || j?.argument ? { argument } : {}), ...(j?.reinforcementAssessment ? { supportedTroops: j.reinforcementAssessment.supportedTroops } : {}), tasks: grant.troops ? tasks : [], usedItemIds: grant.troops ? [...(j?.usedItemIds ?? [])] : [], ...(j ? { input: j.input, clueIds: [...j.clueIds] } : {}) };
    }
    private effect(e: JietingEffect, source: string) {
        switch (e.type) {
            case 'clue': {
                if (!this.story.clues.some(c => c.id === e.id && c.sources.some(s => s.node === source))) throw new Error('线索缺少当前事实来源');
                if (!this.state.clueIds.includes(e.id)) this.state.clueIds.push(e.id);
                const sources = this.state.clueSourceNodes[e.id] ??= []; if (!sources.includes(source)) sources.push(source);
                if (e.update) this.state.clueUpdates[e.id] = e.update;
                break;
            }
            case 'score': if (!this.state.scoreEvents.includes(e.id)) { this.state.scoreEvents.push(e.id); for (const key of ['w', 'm', 'r'] as const) this.state.scores[key] = clampScore(this.state.scores[key] + (e.delta[key] ?? 0)); } break;
            case 'flag':
                this.state.flags[e.key] = e.value;
                if (e.key === 'lureMethod' || (e.key === 'lurePlanReady' && e.value === false)) this.state.lureItemIds = [];
                if (e.key === 'lureAuthorized' && e.value === true) this.commitItemUse(source, this.state.lureItemIds);
                if (e.key === 'withdrawalAuthorized' && e.value === true) this.commitItemUse(source, this.state.withdrawalItemIds);
                break;
            case 'visit': if (!this.state.visits.includes(e.place)) this.state.visits.push(e.place); break;
            case 'item': if (itemSystemEnabled()) acquireWorldItem(this.state.supplies.worldItems ??= freshWorldInventory(), e.id); break;
            case 'round-result': this.setRoundResult(e.round, e.outcome, 'fixed'); break;
            case 'round-order': {
                const r = this.state.roundResults[e.round]; if (!r) throw new Error('调令缺少已确认的说服结果');
                if (!r.ordered) { r.ordered = true; if (r.troops) { this.commitItemUse(source, r.usedItemIds); if (e.round <= 3) this.effect({ type: 'score', id: `round${e.round}-m`, delta: { m: 1 } }, source); } } break;
            }
            case 'round-arrival': { const r = this.state.roundResults[e.round]; if (!r?.ordered) throw new Error('到营缺少实际调令'); r.arrived = true; break; }
            case 'round-report': { const r = this.state.roundResults[e.round]; if (!r?.ordered) throw new Error('回令缺少实际军令'); if (!r.reported) { r.reported = true; if (e.round <= 3) this.effect({ type: 'score', id: `round${e.round}-w`, delta: { w: 1 } }, source); } break; }
            case 'checkpoint': this.checkpoint(e.name); break;
            case 'ending': this.state.ending = e.id; break;
        }
    }
    private commitItemUse(at: string, itemIds: string[]) {
        if (!itemIds.length || this.state.itemUses.some(use => use.at === at && equal(use.itemIds, itemIds))) return;
        if (itemIds.some(id => !isAvailableSupply(id, this.state.supplies))) throw new Error('已采用的方案物品不在当前库存中');
        this.state.itemUses.push({ at, itemIds: [...itemIds], effects: itemIds.map(id => ({ id, name: supplyById(id, this.state.supplies)!.name, effect: this.state.itemTrials[id]?.effect ?? supplyById(id, this.state.supplies)!.ability })) });
        consumeSupplies(this.state.supplies, itemIds);
    }
    private checkpoint(name: string) {
        const { schema: _schema, version: _version, run: _run, revision: _revision, draft: _draft, selected: _selected, pendingJudgment: _pending, checkpoints: _checkpoints, ...progress } = this.state;
        this.state.checkpoints[name] = copy(progress);
    }
    private restore(raw: unknown) {
        const s = raw as JietingSave;
        if (!s || s.schema !== 1 || ![this.story.version, 'jieting-20261026-1a640d464f8a'].includes(s.version) || !Number.isSafeInteger(s.revision) || !Number.isFinite(s.run)) throw new Error('第三章存档版本不兼容');
        this.validateProgress(s);
        const supplies = this.restoreEconomy(s);
        if (!Array.isArray(s.judgments) || !s.checkpoints || typeof s.checkpoints !== 'object') throw new Error('进言或重试记录缺失');
        const checkpoints: Record<string, JietingCheckpoint> = {};
        for (const [key, value] of Object.entries(s.checkpoints)) { this.validateProgress(value); checkpoints[key] = { ...copy(value), ...this.restoreEconomy(value) }; }
        Object.assign(this.state, copy(s), supplies, { checkpoints, draft: typeof s.draft === 'string' ? s.draft.slice(0, 2000) : '', selected: Array.isArray(s.selected) ? s.selected.filter(id => s.clueIds.includes(id)) : [], pendingJudgment: null });
        this.state.version = this.story.version;
        // Saved pending responses remain read-only feedback; they cannot invent a new grant.
        if (s.pendingJudgment) {
            const j = s.pendingJudgment;
            if (j.nodeId !== s.node || this.current.kind !== 'open' || !s.judgments.some(jj => equal(jj, j))) throw new Error('待回应进言缺少确认来源');
            this.state.pendingJudgment = copy(j);
            if (s.version === 'jieting-20261026-1a640d464f8a' && j.phase === 'reinforcement' && !j.argument) {
                this.state.pendingJudgment.argument = { topic: j.deploymentTasks?.[0] ?? (j.round === 1 ? 'road' : j.round === 2 ? 'water' : 'reception'), quote: j.input, clueIds: [...j.clueIds] };
                this.state.judgments.push(copy(this.state.pendingJudgment));
            }
        }
    }
    private restoreEconomy(s: JietingCheckpoint | JietingSave) {
        const supplies = restoreSupplies(s.supplies, [], true, 'jieting-action', false);
        if (supplies.rewards.length || supplies.legacyPurchases?.length || supplies.worldItems?.acquired.some(id => id !== JIETING_TIGER || !s.visited.includes('JT-058'))) throw new Error('第三章资金或木雕缺少实际来源');
        return { supplies, phone: restorePhone(s.phone) };
    }
    private validateProgress(s: JietingProgress) {
        const unique = (a: unknown): a is string[] => Array.isArray(a) && a.every(x => typeof x === 'string') && new Set(a).size === a.length;
        if (!s || !this.nodes.has(s.node) || !unique(s.visited) || s.visited.some(id => !this.nodes.has(id)) || !unique(s.chosen)
            || s.chosen.some(id => !this.story.nodes.some(n => n.options?.some(o => o.id === id))) || !unique(s.clueIds) || !unique(s.scoreEvents)
            || !Array.isArray(s.visits) || new Set(s.visits).size !== s.visits.length || s.visits.some(v => !['wang', 'ma', 'camp'].includes(v))
            || !s.flags || !s.clueSourceNodes || !s.clueUpdates || !s.sourceReadings || !s.roundResults || !s.followupUsed || !Array.isArray(s.transcript) || !Array.isArray(s.acceptedReasons) || !Array.isArray(s.unresolvedConcerns) || !s.itemTrials || !unique(s.lureItemIds) || !unique(s.withdrawalItemIds) || !Array.isArray(s.itemUses)) throw new Error('第三章剧情记录不完整');
        for (const id of s.clueIds) {
            const c = this.story.clues.find(c => c.id === id), sources = s.clueSourceNodes[id];
            if (!c || !unique(sources) || !sources.length || sources.some(node => !s.visited.includes(node) || !c.sources.some(v => v.node === node) || typeof s.sourceReadings[node]?.text !== 'string')) throw new Error('线索没有已经读过的来源');
        }
        const expected = { w: 0, m: 0, r: 0 }, validEvents = new Set<string>();
        if (s.guidedQuestions) for (const [node, question] of Object.entries(s.guidedQuestions)) {
            if (this.nodes.get(node)?.kind !== 'open' || typeof question.question !== 'string' || !question.question.trim() || question.question.length > 140
                || !unique(question.clueIds) || question.clueIds.some(id => !s.clueIds.includes(id))) throw new Error('进言问题缺少当前军情来源');
        }
        for (const node of this.story.nodes) {
            const effects = [...(s.visited.includes(node.id) ? node.effects ?? [] : []), ...(node.options ?? []).filter(o => s.chosen.includes(o.id)).flatMap(o => o.effects ?? [])];
            for (const e of effects) if (e.type === 'score' && s.scoreEvents.includes(e.id) && !validEvents.has(e.id)) { validEvents.add(e.id); for (const k of ['w', 'm', 'r'] as const) expected[k] += e.delta[k] ?? 0; }
        }
        let allocated = JIETING_INITIAL_BELOW;
        const credits: Partial<Record<string, number>> = {};
        for (const [k, r] of Object.entries(s.roundResults).sort(([a], [b]) => Number(a) - Number(b))) {
            const rr = r as JietingRoundRecord, round = Number(k);
            if (![1, 2, 3, 4, 5].includes(round) || rr.round !== round || !['great', 'small', 'none'].includes(rr.outcome) || !Array.isArray(rr.tasks) || rr.tasks.some(t => !['road', 'water', 'reception'].includes(t)) || !unique(rr.usedItemIds) || !['fixed', 'ai'].includes(rr.source)) throw new Error('调兵记录无效');
            if (rr.argument && (!Object.hasOwn(argumentTopics, rr.argument.topic) || typeof rr.argument.quote !== 'string' || !unique(rr.argument.clueIds) || rr.argument.clueIds.some(id => !s.clueIds.includes(id)))) throw new Error('调兵理由缺少已获线索');
            if (rr.argument && rr.source === 'ai' && !(s as JietingCheckpoint).judgments?.some(j => j.phase === 'reinforcement' && j.round === round && j.input === rr.input && equal(j.argument, rr.argument))) throw new Error('调兵理由缺少已经确认的发言');
            const topic = recordTopic(rr), prior = credits[topic] ?? 0;
            let troops = Math.max(0, Math.min(troopsForOutcome(rr.outcome) - (rr.argument ? prior : 0), REINFORCEMENT_TARGET - allocated));
            if (rr.supportedTroops !== undefined) {
                const judgment = (s as JietingCheckpoint).judgments?.find(j => j.status === 'final' && !j.special && j.round === round && j.input === rr.input
                    && equal(j.argument, rr.argument) && j.reinforcementAssessment?.supportedTroops === rr.supportedTroops);
                if (rr.source !== 'ai' || !Number.isInteger(rr.supportedTroops) || rr.supportedTroops < 0 || rr.supportedTroops > 5000 || !judgment) throw new Error('增派人数缺少已确认的AI判断');
                const expected = grantForJudgment(judgment, Object.values(s.roundResults).filter(r => r!.round < round), allocated);
                if (rr.outcome !== expected.outcome) throw new Error('增派结果与已确认的AI判断不符');
                troops = expected.troops;
            }
            if (rr.troops !== troops || (round > 3 && rr.troops > 0 && !rr.argument)) throw new Error('调兵人数缺少新理由或超过本关上限');
            credits[topic] = prior + rr.troops; if (rr.arrived) allocated += rr.troops;
            for (const [property, type] of [['ordered', 'round-order'], ['arrived', 'round-arrival'], ['reported', 'round-report']] as const) {
                if (typeof rr[property] !== 'boolean' || (rr[property] && !this.story.nodes.some(n => s.visited.includes(n.id) && n.effects?.some(e => e.type === type && e.round === round)))) throw new Error('调兵没有实际执行来源');
            }
            if (rr.arrived && !rr.ordered || rr.reported && !rr.ordered) throw new Error('尚未下令的军队不能到营');
            if (round <= 3 && rr.ordered && rr.troops && s.scoreEvents.includes(`round${round}-m`)) { validEvents.add(`round${round}-m`); expected.m++; }
            if (round <= 3 && rr.reported && s.scoreEvents.includes(`round${round}-w`)) { validEvents.add(`round${round}-w`); expected.w++; }
        }
        if (s.scoreEvents.some(id => !validEvents.has(id)) || !s.scores || ['w', 'm', 'r'].some(k => s.scores[k as keyof typeof expected] !== clampScore(expected[k as keyof typeof expected]))) throw new Error('分值缺少实际选项或回报来源');
        if (s.ending !== null && !this.story.endings.some(e => e.id === s.ending && s.node === 'JT-END-' + e.id.toUpperCase())) throw new Error('结局记录与现场不符');
        for (const [id, trial] of Object.entries(s.itemTrials)) if (!trial || typeof trial.input !== 'string' || typeof trial.operation !== 'string' || typeof trial.effect !== 'string' || !(s as JietingCheckpoint).supplies?.purchases.includes(id)) throw new Error('试用缺少已购物品');
        const used = new Set<string>();
        for (const use of s.itemUses) {
            if (!s.visited.includes(use.at) || !unique(use.itemIds) || !use.itemIds.length || !Array.isArray(use.effects) || use.itemIds.some(id => used.has(id) || !(s as JietingCheckpoint).supplies.purchases.includes(id) || !use.effects.some(e => e.id === id && typeof e.effect === 'string'))) throw new Error('物品消耗缺少实际采用来源');
            use.itemIds.forEach(id => used.add(id));
        }
        if (!equal([...(s as JietingCheckpoint).supplies.consumed ?? []].sort(), [...used].sort())) throw new Error('物品消耗记录与采用结果不符');
    }
}

/** Fixtures play through real options and source lines; no future clues or cash are injected. */
export function createJietingPlaytest(story: JietingStory, kind: string, mode: JietingMode = {}) {
    const session = new JietingSession(story, undefined, { aiEnabled: false, phoneAllowed: mode.phoneAllowed ?? true });
    const picks: Record<string, string> = { 'JT-Q1': 'JT-O018', 'JT-Q2': 'JT-O029', 'JT-Q3': 'JT-O093', 'JT-Q4': 'JT-O111', 'JT-R1-FIXED': 'JT-O132', 'JT-R2-FIXED': 'JT-O167', 'JT-R3-FIXED': 'JT-O198', 'JT-ROUTE-CHOICE': kind === 'withdrawal' ? 'JT-O228' : 'JT-O229' };
    const target = kind === 'item' || kind === 'reinforcement' ? 'JT-R1-FIXED' : kind === 'withdrawal' ? 'JT-WITHDRAW-FIXED' : 'JT-LURE-METHOD';
    for (let i = 0; i < 500 && session.current.id !== target; i++) {
        if (session.current.kind === 'choice') {
            const id = picks[session.current.id] ?? (session.current.id === 'JT-VISIT-REMAINING' ? session.options[0]?.id : undefined);
            if (!id || !session.advance(id)) throw new Error('试玩检查点选项不完整');
        } else if (!session.advance()) throw new Error('试玩检查点不能到达');
    }
    if (session.current.id !== target) throw new Error('试玩检查点超出合理路径');
    session.setMode(mode);
    if (mode.aiEnabled !== false && (kind === 'reinforcement' || kind === 'item')) {
        // Switching a fixed prompt to its equivalent open prompt changes no material progress.
        session.state.node = 'JT-OPEN-R1';
    } else if (mode.aiEnabled !== false && kind === 'withdrawal') session.state.node = 'JT-OPEN-WITHDRAW';
    return session;
}
