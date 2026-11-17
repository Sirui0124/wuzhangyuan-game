import { parseEraAssessment, isEraFailure, eraArrestReply } from '../../phone/era-judgment';
import { jietingCriteria, jietingReplyLimits, type JietingEvaluationRequest, type JietingJudgment, type JietingCriteria, type JietingAcceptedReason, type JietingSpecial, type JietingDeploymentTask } from './ai-contracts';
import { argumentSupported, argumentTopics, grantForJudgment } from './persuasion';
import type { JietingRoundRecord } from './types';

const RETRY = '回应未核对完整，原话和已完成的进展已保留，请重试。';
const fail = (): never => { throw new Error(RETRY); };
const object = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : fail();
const string = (value: unknown, max: number, empty = false): string => typeof value === 'string' && value.length <= max && (empty || value.trim()) ? value : fail();
const boolean = (value: unknown): boolean => typeof value === 'boolean' ? value : fail();
function ids(value: unknown, allowed: Set<string>): string[] {
    if (!Array.isArray(value) || value.length > 12 || new Set(value).size !== value.length || value.some(id => typeof id !== 'string' || !allowed.has(id))) fail();
    return [...value as string[]];
}

export function validateJietingRequest(request: JietingEvaluationRequest): void {
    const { context: c, input } = request;
    if (request.confirmed !== true || !c || !input.trim() || input.length > 6000) throw new Error('请先确认本次要说的话。');
    if (!c.contextKey || !c.nodeId || !['reinforcement', 'withdrawal', 'lure'].includes(c.phase)
        || (c.phase === 'reinforcement' && ![1, 2, 3, 4, 5].includes(c.round ?? 0))
        || typeof c.followupUsed !== 'boolean' || !Number.isInteger(c.below) || !Number.isInteger(c.above)
        || c.below < 5000 || c.above < 5000 || c.below + c.above !== 25000) fail();
    if (Object.values(c.scores).some(v => !Number.isFinite(v) || v < 0 || v > 10)) fail();
    const owned = new Set(c.ownedClues.map(e => e.id));
    if (owned.size !== c.ownedClues.length || c.ownedClues.some(e => !e.id || !e.text)) fail();
    ids(request.clueIds, owned);
}

function replyPart(value: unknown, max: number): string {
    const text = string(value, max, true).trim();
    // The generated part may discuss a proposal; state-changing orders are shown by the chapter.
    if (/(?:再拨|拨给|赏你|赐你|获得物品|余额|到账|加[分钱]|已(?:经)?(?:守住街亭|大获全胜)|街亭(?:大捷|失守了)|军前斩首|来人.{0,4}拿下|传令|已下山\d|增加\d)/u.test(text)) fail();
    return text;
}

function explicitAbuse(raw: unknown, input: string): JietingSpecial | undefined {
    const a = object(raw);
    boolean(a.direct);
    if (!['ma-su', 'none'].includes(a.target) || !['insult', 'humiliation', 'threat', 'none'].includes(a.kind)
        || !['asserted', 'negated', 'quoted', 'hypothetical'].includes(a.context)) fail();
    const quote = string(a.quote, 1500, true), reason = string(a.reason, 240);
    if (quote && !input.includes(quote)) fail();
    if (!a.direct || a.target !== 'ma-su' || a.kind === 'none' || a.context !== 'asserted') return;
    if (!['abuse', 'argument', 'uncertain'].includes(a.intent)) fail();
    if (a.intent !== 'abuse') return;
    const targetQuote = string(a.targetQuote, 300), actQuote = string(a.actQuote, 1500);
    if (!quote || !quote.includes(targetQuote) || !quote.includes(actQuote)) fail();
    const at = input.indexOf(quote), before = input.slice(Math.max(0, at - 30), at);
    const clause = (before + quote).split(/[。！？!?\n]/u).filter(s => s.trim()).at(-1) ?? quote;
    // A semantic claim alone cannot turn negation, reported speech or ordinary dissent into execution.
    if (/(?:不是|并非|不会|不敢|不认为|不觉得|不该|不应|莫要|不要|别|没有|未曾|如果|假如|若是|有人说|他说|听人说|不是说|不能说).{0,18}(?:蠢|废物|狗|杀|砍|跪|磕头)/u.test(clause)
        || /[“「『"].*[”」』"]/u.test(quote)) return;
    const actAt = input.indexOf(actQuote);
    const lead = input.slice(Math.max(0, actAt - 50), actAt);
    if (/(?:有人说|听人说|他说|引用|并非说|不是说|不觉得|不认为|不会说|未曾说)[^。！？!?\n]{0,40}$/u.test(lead)) return;
    // Meaning is assessed semantically, with separate target and speech-act evidence.
    // Do not use a swear-word whitelist: an explicit humiliation can contain no profanity.
    return { kind: 'execution', quote, reason };
}

function base(request: JietingEvaluationRequest): JietingJudgment {
    const c = request.context;
    return { version: 1, nodeId: c.nodeId, contextKey: c.contextKey, input: request.input,
        clueIds: [...request.clueIds], phase: c.phase, ...(c.round ? { round: c.round } : {}),
        status: 'final', outcome: c.phase === 'reinforcement' ? 'none' : 'revise', response: '',
        criteria: Object.fromEntries(['factsReliable', ...jietingCriteria].map(k => [k, false])) as JietingCriteria,
        verifiedClueIds: [], acceptedReasons: [], unresolvedConcerns: [] };
}

export function parseJietingJudgment(rawText: string, request: JietingEvaluationRequest): JietingJudgment {
    validateJietingRequest(request);
    let raw: Record<string, any>;
    try { raw = object(JSON.parse(rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))); }
    catch { return fail(); }
    if (raw.version !== 1) fail();
    const out = base(request), c = request.context;
    const shown = (c.items ?? []).filter(i => i.source === 'phone' && i.available && i.shown && i.observedEffect?.trim());
    const era = parseEraAssessment(raw.eraAssessment, shown.map(i => i.id), request.input);
    if (isEraFailure(era)) {
        return { ...out, special: { kind: 'era-arrest', quote: era.quote, reason: era.reason, itemIds: era.itemIds }, response: eraArrestReply };
    }
    const offense = explicitAbuse(raw.offense, request.input);
    if (offense) return { ...out, special: offense, response: '军情怎样，你尽管说。可你这番辱骂威胁，岂能当作进言？' };
    if (raw.valid === false) throw new Error('这句话的意思还不明确，请补充想请将军怎样安排。');
    if (raw.valid !== true) fail();
    const current = new Set(c.ownedClues.filter(e => e.current !== false).map(e => e.id));
    const usableItems = new Set((c.items ?? []).filter(i => i.available && i.shown && i.tested && i.observedEffect?.trim()).map(i => i.id));
    const consumableItems = new Set((c.items ?? []).filter(i => i.source === 'phone' && usableItems.has(i.id)).map(i => i.id));
    if (!Array.isArray(raw.factualIssues) || raw.factualIssues.length > 8) fail();
    for (const problem of raw.factualIssues) {
        const p = object(problem); const quote = string(p.quote, 1500); string(p.reason, 240);
        if (!request.input.includes(quote)) fail();
    }
    out.criteria.factsReliable = boolean(raw.factsReliable);
    if (out.criteria.factsReliable === (raw.factualIssues.length > 0)) fail();
    const allowedReasons = c.acceptedReasons.filter(r => r.clueIds.every(id => current.has(id)));
    const playerTexts = [request.input, ...allowedReasons.map(r => r.text)];
    const checks = object(raw.criteria);
    const accepted: JietingAcceptedReason[] = [];
    const checkedItems = new Map<string, string[]>();
    for (const key of jietingCriteria) {
        const check = object(checks[key]); const value = boolean(check.value);
        const quote = string(check.quote, 1500, !value), reason = string(check.reason, 240, !value);
        const evidenceIds = ids(check.evidenceIds, current), itemIds = ids(check.itemIds, usableItems);
        if (quote && !playerTexts.some(t => t.includes(quote))) fail();
        if (value && (!quote || !reason || (!evidenceIds.length && !itemIds.length))) fail();
        out.criteria[key] = value;
        checkedItems.set(key, value ? itemIds : []);
        if (value && out.criteria.factsReliable && evidenceIds.length)
            accepted.push({ text: quote, clueIds: evidenceIds, ...(c.round ? { round: c.round } : {}) });
    }
    const maintain = object(raw.maintain); boolean(maintain.value);
    const maintainQuote = string(maintain.quote, 1500, !maintain.value);
    if (maintainQuote && !request.input.includes(maintainQuote)) fail();
    out.maintain = c.phase === 'reinforcement' && maintain.value;
    out.maintainQuote = out.maintain ? maintainQuote : '';
    let reasoned = true;
    if (c.phase === 'reinforcement' && c.reinforcement) {
        const reasoning = object(raw.reasoning), linked = boolean(reasoning.linked);
        const quote = string(reasoning.quote, 1500, !linked), conclusion = string(reasoning.conclusion, 240, !linked);
        const clueIds = ids(reasoning.evidenceIds, current);
        if (quote && ![request.input, ...allowedReasons.filter(r => r.round === c.round).map(r => r.text)].some(text => text.includes(quote))) fail();
        reasoned = linked && clueIds.length >= 2 && !!quote && !!conclusion && out.criteria.factsReliable;
        out.reasoning = { linked: reasoned, quote, clueIds, conclusion };
        if (reasoned) accepted.push({ text: quote, clueIds, ...(c.round ? { round: c.round } : {}) });
        const assessment = object(raw.reinforcementAssessment);
        if (!Number.isInteger(assessment.supportedTroops) || assessment.supportedTroops < 0 || assessment.supportedTroops > 5000) fail();
        const assessmentQuote = string(assessment.quote, 1500, assessment.supportedTroops === 0);
        if (assessmentQuote && ![request.input, ...allowedReasons.filter(r => r.round === c.round).map(r => r.text)].some(text => text.includes(assessmentQuote))) fail();
        const valid = reasoned && out.criteria.factsReliable && out.criteria.gapEstablished && out.criteria.reinforcementUse && !out.maintain;
        out.reinforcementAssessment = { supportedTroops: valid ? Math.min(assessment.supportedTroops, out.criteria.concernAnswered ? 5000 : 3000) : 0,
            quote: assessmentQuote, reason: string(assessment.reason, 240) };
    }
    const followup = object(raw.followup); boolean(followup.needed);
    const question = replyPart(followup.question, jietingReplyLimits.question), acknowledgment = replyPart(raw.acknowledgment, jietingReplyLimits.acknowledgment);
    if (!acknowledgment || /[?？]/u.test(acknowledgment) || (followup.needed && !question)) fail();
    const f = out.criteria;
    const complete = f.factsReliable && (c.phase === 'reinforcement' ? reasoned && f.gapEstablished && f.reinforcementUse && f.concernAnswered
        : c.phase === 'withdrawal' ? f.risk && f.route && f.reception : f.motive && f.means && f.reception && f.withdrawal);
    if (c.phase === 'reinforcement') {
        out.outcome = maintain.value ? 'none' : complete ? 'great' : reasoned && f.factsReliable && f.gapEstablished && f.reinforcementUse ? 'small' : 'none';
        if (!maintain.value && !complete && !c.followupUsed && followup.needed) out.status = 'followup';
        if (!maintain.value && !reasoned && f.factsReliable && !c.followupUsed) out.status = 'followup';
    } else out.outcome = complete ? 'accepted' : 'revise';
    const currentQuestion = out.status === 'followup' && !question ? '我不是不肯添人。你再说细些，这队人为什么非得现在下去？' : question;
    out.response = acknowledgment + (out.status === 'followup' ? currentQuestion : '');
    out.acceptedReasons = accepted.filter((r, i) => accepted.findIndex(x => x.text === r.text && x.clueIds.join() === r.clueIds.join()) === i);
    out.unresolvedConcerns = !complete && currentQuestion ? [currentQuestion] : [];
    if (c.phase === 'reinforcement' && c.reinforcement) {
        if (raw.argument != null) {
            const a = object(raw.argument);
            if (!Object.hasOwn(argumentTopics, a.topic)) fail();
            out.argument = { topic: a.topic, quote: string(a.quote, 1500), clueIds: ids(a.clueIds, current) };
            if (!argumentSupported(out.argument, [...current], [request.input, ...allowedReasons.filter(r => r.round === c.round).map(r => r.text)])) fail();
        } else if (['great', 'small'].includes(out.outcome) && !out.maintain) fail();
        if (out.status === 'final' && !out.special) {
            const grant = grantForJudgment(out, (c.roundResults ?? []) as JietingRoundRecord[], c.below);
            if (out.outcome !== 'none' && grant.outcome === 'none') {
                const credited = ((c.roundResults ?? []) as JietingRoundRecord[]).some(r => r.argument?.topic === out.argument?.topic && r.troops > 0);
                out.response = credited ? '这一处先前已经派了人。若还要添兵，你再说说哪里仍顾不过来。' : '这回还不足以从山上抽兵。你把下面各队的情形问细些，再来报我。';
                out.unresolvedConcerns = [];
            }
            out.outcome = grant.outcome;
        }
    }
    const relevant = c.phase === 'reinforcement' ? ['gapEstablished', 'reinforcementUse', 'concernAnswered']
        : c.phase === 'withdrawal' ? ['risk', 'route', 'reception'] : ['motive', 'means', 'reception', 'withdrawal'];
    out.usedItemIds = out.status === 'final' && ['great', 'small', 'accepted'].includes(out.outcome)
        ? [...new Set(relevant.flatMap(key => checkedItems.get(key) ?? []).filter(id => consumableItems.has(id)))] : [];
    if (!Array.isArray(raw.deploymentTasks) || raw.deploymentTasks.length > 3) fail();
    const tasks: JietingDeploymentTask[] = [];
    for (const value of raw.deploymentTasks) {
        const task = object(value), quote = string(task.quote, 1500);
        if (!['road', 'water', 'reception'].includes(task.task) || !playerTexts.some(t => t.includes(quote)) || tasks.includes(task.task)) fail();
        tasks.push(task.task);
    }
    if (c.phase === 'reinforcement' && out.outcome !== 'none' && f.factsReliable && f.reinforcementUse) out.deploymentTasks = tasks;
    // Verification is a local scene event, not a reward inferred from eloquence.
    out.verifiedClueIds = ids(c.verifiedClueIds ?? [], current);
    return out;
}
