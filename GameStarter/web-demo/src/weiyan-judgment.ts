import type { GameApi } from '../../assets/scripts/GameApi';
import type { ExpressionJudge, ExpressionJudgeInput } from './chapter-session';
import { parseNpcTurn, type DialogueStage, type PersuasionResult } from './npc-dialogue';
import { weiyanClassifierPrompt, weiyanConfig, weiyanReplyPrompt } from './weiyan-prompt-config';
import { compactWeiyanFacts } from './weiyan-facts';
import { auditWeiyanReply } from './weiyan-reply-audit';
import { hasDidacticContrast, hasProcessWording } from './npc-voice';

export type WeiyanAssessment = {
    fatal: { type: 'none' | 'off_topic' | 'offense'; quote: string };
    checks: Record<string, string>;
    unsupported: string;
};
export type WeiyanDecision = { result: 'accept' | 'clarify' | 'execute'; reason: string; code: PersuasionResult };
const decode = (text: string): unknown => JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

/** Quotes are a structural grounding check, not a replacement for semantic classification. */
export function parseWeiyanAssessment(value: unknown, input: Pick<ExpressionJudgeInput, 'stage' | 'said' | 'current' | 'evidence'>): WeiyanAssessment {
    const keys = weiyanConfig.stages[input.stage].checks.map(check => check.id);
    const spoken = [input.current, ...input.said];
    const quote = (value: unknown): value is string => typeof value === 'string'
        && (value === '' || !!value.trim() && spoken.some(text => text.includes(value)));
    if (!exact(value, ['fatal', 'checks', 'unsupported']) || !exact(value.fatal, ['type', 'quote'])
        || !exact(value.checks, keys) || !quote(value.unsupported) || !Object.values(value.checks).every(quote)) {
        throw new Error('语义判定结构或玩家原话不兼容');
    }
    const fatal = value.fatal;
    if (!['none', 'off_topic', 'offense'].includes(fatal.type as string) || typeof fatal.quote !== 'string'
        || (fatal.type === 'none' ? fatal.quote !== '' : !fatal.quote.trim() || !input.current.includes(fatal.quote))) {
        throw new Error('失败判定必须引用本次实际发言');
    }
    const assessment = value as WeiyanAssessment;
    const checks = { ...assessment.checks };
    // Model recognition cannot grant a missing in-story commitment, even with a valid speech quote.
    if (input.stage === 'authorized' && !input.evidence.some(clue => clue.id === 'C08')) checks.authorization = '';
    // An unsupported quote wins conservatively over an overlapping positive quote.
    // Valid quote overlap is a clarification outcome, not a transport/format error.
    if (assessment.unsupported) for (const [key, q] of Object.entries(checks)) {
        if (q && (q.includes(assessment.unsupported) || assessment.unsupported.includes(q))) checks[key] = '';
    }
    return { fatal: { ...assessment.fatal }, checks, unsupported: assessment.unsupported };
}

export function decideWeiyan(stage: DialogueStage, assessment: WeiyanAssessment): WeiyanDecision {
    if (assessment.fatal.type !== 'none') return { result: 'execute', reason: assessment.fatal.type, code: 'execute' };
    const missing = weiyanConfig.stages[stage].checks.find(check =>
        !(weiyanConfig.stages[stage].optionalChecks as readonly string[]).includes(check.id) && !assessment.checks[check.id]);
    const reason = assessment.unsupported ? 'unsupported' : missing?.id;
    if (!reason) return { result: 'accept', reason: 'complete', code: 'ok' };
    const code = stage === 'first' ? 'R1-RETRY' : reason === 'authorization' || reason === 'unsupported' ? 'P2-F1'
        : reason === 'handoff' ? 'P2-F5' : 'P2-F4';
    return { result: 'clarify', reason, code };
}

export function weiyanReplyIntent(stage: DialogueStage, decision: WeiyanDecision): string {
    if (decision.result === 'accept') return weiyanConfig.stages[stage].fixedAcceptReply;
    return weiyanConfig.replyIntents[decision.reason as keyof typeof weiyanConfig.replyIntents] ?? weiyanConfig.replyIntents.unclear;
}

/** Shape guard only; differing wording still requires a semantic audit before display. */
export function guardedWeiyanReply(value: unknown, stage: DialogueStage, decision: WeiyanDecision): string {
    const intent = weiyanReplyIntent(stage, decision);
    if (decision.result === 'accept') return intent;
    if (!exact(value, ['reply']) || typeof value.reply !== 'string') return intent;
    const text = value.reply.trim();
    const anchors = weiyanConfig.replyAnchors[decision.reason as keyof typeof weiyanConfig.replyAnchors] ?? [];
    if (!text || [...text].length > 45 || hasDidacticContrast(text) || hasProcessWording(text) || /[\u0000-\u001f]|主角|execute|clarify|accept|JSON|schema|checks|P2-F|R1-RETRY|```/i.test(text)
        || (text.match(/[。！？!?]+/g)?.length ?? 0) > 2
        || anchors.some(group => !group.some(term => text.includes(term)))) return intent;
    if (decision.result === 'execute') {
        if (!/拿下/.test(text) || !/处斩|斩了|斩首|处决/.test(text)
            || /再敢|再犯|若再|否则|下次|暂不|不必|不准|不可|不能|休要/.test(text)) return intent;
    } else if (!/[？?]/.test(text) || /候着|速去|速交|你去|我.{0,5}(转呈|递报|交报)|替你|代你|我带路|已办妥|保证/.test(text)) {
        return intent;
    }
    return text;
}

export function createWeiyanJudge(api: Pick<GameApi, 'respond'>): ExpressionJudge {
    return async (input, signal) => {
        signal.throwIfAborted();
        const source = { stage: input.stage, checks: weiyanConfig.stages[input.stage].checks,
            facts: compactWeiyanFacts(input.evidence), spokenTurns: [...input.said, input.current], current: input.current };
        const raw = await api.respond({ text: weiyanClassifierPrompt + '\n资料：' + JSON.stringify(source),
            temperature: weiyanConfig.classifierTemperature }, signal, 45000);
        signal.throwIfAborted();
        // Malformed assessments remain a technical failure; never invent a story outcome.
        const assessment = parseWeiyanAssessment(decode(raw.text), input);
        // Harmless item conversation already receives a revisable item response; attaching an ordinary item must not invent a new execution route.
        if (input.incidentalItemConversation === true && input.stage === 'authorized' && input.items?.length && assessment.fatal.type === 'off_topic')
            return parseNpcTurn({ schemaVersion: 1, npcId: 'weiyan', stage: input.stage,
                classification: { code: 'P2-F1', disposition: 'revise', reason: '普通物品话题尚未说明军报安排。', evidenceIds: [] },
                reply: { speaker: '魏延', text: '你叫住我，是要禀何事？' } }, input.stage, input.evidence.map(e => e.id));
        const decision = decideWeiyan(input.stage, assessment);
        const intent = weiyanReplyIntent(input.stage, decision);
        let text = intent;
        if (decision.result !== 'accept') {
            const source = { result: decision.result, intent, ...(decision.result === 'execute' ? { current: input.current } : {}) };
            try {
                const candidate = await api.respond({ text: weiyanReplyPrompt + '\n资料：' + JSON.stringify(source),
                    temperature: weiyanConfig.replyTemperature }, signal, 30000);
                signal.throwIfAborted();
                const wording = guardedWeiyanReply(decode(candidate.text), input.stage, decision);
                if (wording === intent || await auditWeiyanReply(api, intent, wording, signal)) text = wording;
            } catch {
                signal.throwIfAborted();
                // Classification already succeeded. The reviewed line is the safe wording fallback.
                text = intent;
            }
        }
        const reason = decision.result === 'accept' ? '本轮所需的情况与安排已说明。'
            : decision.result === 'execute' ? (decision.reason === 'off_topic' ? '本次实质发言完全偏离军情交涉。' : '本次发言直接辱骂、羞辱或威胁魏延。')
            : decision.reason === 'unsupported' ? '发言含有尚无依据的事实、承诺或矛盾。'
            : '尚未说清：' + weiyanConfig.stages[input.stage].checks.find(check => check.id === decision.reason)!.meaning;
        return parseNpcTurn({ schemaVersion: 1, npcId: 'weiyan', stage: input.stage,
            classification: { code: decision.code, disposition: decision.result === 'clarify' ? 'revise' : decision.result,
                reason, evidenceIds: [] }, reply: { speaker: '魏延', text } }, input.stage, input.evidence.map(e => e.id));
    };
}
