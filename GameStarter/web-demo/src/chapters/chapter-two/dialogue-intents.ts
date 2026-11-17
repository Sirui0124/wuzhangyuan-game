import { dialogueProtocolError } from './dialogue-errors';
import type { Judgment } from './dialogue-judgment';

type Intent = { meaning: string; text: string; evidence?: string[]; score?: 'trust-negative' | 'responsibility-negative' };
/** Reviewed response scope. Models select themes; they never supply playable dialogue. */
export const responseIntentBank: Record<'O1' | 'O2', Record<string, Intent>> = {
    O1: {
        date_gap: { meaning: '用五月饮酒与六月领粮指出有限的解释缺口；不是担保无罪。', text: '五月喝酒，确实不能单凭这一点解释这批粮为何迟了。', evidence: ['LY-X04', 'LY-X06'] },
        date_question: { meaning: '具体询问这趟粮何时领取，或要求澄清领粮日期。已知日期必须直接答，不能用未明问题代替。', text: '这趟粮，簿上记的领粮日期是六月初二。', evidence: ['LY-X06'] },
        letter_concern: { meaning: '问苟安怕查粮、怕被封口或牵连谁；只回应已有生计顾虑，不声称确已被封口。', text: '我怕查到最后，连差事都保不住。信里的那些话，我眼下还不想多说。', evidence: ['LY-C02'] },
        concealment_question: { meaning: '质疑是否还有隐瞒、在替谁遮掩；这类问话本身不算恐吓。', text: '你怀疑我还有话没说，我听明白了。可只凭这封信，还说不清谁在替谁遮掩。', evidence: ['LY-C02'] },
        check_commitment: { meaning: '玩家本人明确愿意去核查、查证或把结果带回，不能把分析当承诺。', text: '你肯去查，就照实查，查到什么再回来告诉我。' },
        care: { meaning: '表达感恩、惦念或对苟安本人的关心，不能仅由事实分析推断。', text: '你还惦记着我，这份心意我知道。' },
        threat: { meaning: '原话确有恐吓、羞辱或抓捕强迫；质疑欺瞒、要求说清和拒绝藏错都不自动算威胁。', text: '你把话说到这份上，我也得想想自己还能信什么。', score: 'trust-negative' },
        concealment_offer: { meaning: '玩家明确愿替苟安隐瞒或包庇真实过错；否定包庇不能选。', text: '你肯替我遮掩，我领情；可遮过这一回，下回呢？', score: 'responsibility-negative' },
        other_statement: { meaning: '没有其他主题可准确承接的相关陈述；不得跳过具体提问，也不编造玩家意图。', text: '你说的，我听见了。' },
        unresolved_question: { meaning: '相关具体问题，但当前已得信息没有已核对答案；只承认不确定，不要求玩家改话。已知领粮日期不适用。', text: '这件事，我眼下还说不准。' },
    },
    O2: {
        facts_separate: { meaning: '准确区分已签认和隐瞒的责任，与尚未实行的赴魏散谣。', text: '缺额报告是我签的，没如实上报也是我的事；赴魏散谣还没做，不能混成一桩。', evidence: ['LY-M07', 'LY-C13', 'LY-C14'] },
        no_concealment: { meaning: '玩家明确拒绝掩盖真实过错，要求如实承担责任；不用于包庇承诺。与facts_separate重复时择更贴题的一项。', text: '该是我的错，我没法说成没有。你不肯替我藏，这意思我明白。' },
        accompany_report: { meaning: '玩家本人明确提出陪同补报、送报或共同说明；只确认玩家提议，不代表苟安接受。', text: '你愿意陪着把事情报清，我听见了。到了案前怎么处置，还不能凭这几句话定。' },
        own_report: { meaning: '玩家本人愿自己去报告、联络或确认送达；没有陪同行动时不选accompany_report。', text: '你愿意自己去报，这是你的打算；报上去会怎样处置，还说不准。' },
        care_concern: { meaning: '原话表达对苟安处境的关心或担忧；仅事实判断不自动算。', text: '你担心我的处境，我听得出来。可这些事已经在这里，不能当没发生。' },
        consequence_question: { meaning: '询问或承认如实补报后的处分、生死仍不确定；不替玩家保证免罪。', text: '如实补报以后怎样处置，我也说不准，眼下谁都不能许下免罪。' },
        threat: { meaning: '原话确有恐吓、羞辱或抓捕强迫；如实指出欺瞒、要求担责本身不算。', text: '你把话说到这份上，我也得想想自己还能信什么。', score: 'trust-negative' },
        other_statement: { meaning: '没有其他主题可准确承接的相关陈述；不得跳过具体提问，也不编造玩家意图。', text: '你说的，我听见了。' },
        unresolved_question: { meaning: '相关具体问题，但当前已得信息没有已核对答案；只承认不确定，不要求玩家改话。有已知答案时不适用。', text: '这件事，我眼下还说不准。' },
    },
};
export const responseStageTail = { O1: '粮的事总得查清，我暂且留下。', O2: '接下来怎么做，还得定下来。' } as const;
export type DialogueIntentCandidate = { kind: 'intent-bank'; intents: { id: string; quote: string }[] };

export function intentPrompt(round: 'O1' | 'O2') {
    return `为苟安选择1至2个最贴合当前原话的回应主题，只给ID及连续引句，不写NPC自由文本。优先直接回答具体问题；若主题意思重复，只选更贴题的一项，再可配一个实际行动提议。不得凭分数猜动机，quote必须能支持整个主题，不能把疑问、否定或引用他人当成玩家赞同。
本轮主题表：${JSON.stringify(responseIntentBank[round])}
代码会按所选顺序使用固定text，再接阶段句“${responseStageTail[round]}”。未知具体问题可选unresolved_question，不能返回unmatched逼玩家改话；other_statement只适用没有具体提问的相关陈述。二者均不要与其他主题重复搭配。O2 facts_separate与no_concealment如重复择一，可再配accompany_report；不要预许诺苟安同行或复述最终拒绝。
有效结果必须含responseCandidate:{"kind":"intent-bank","intents":[{"id":"本轮主题ID","quote":"本次玩家原话连续摘录"}]}。禁止text、自由续写或未列出的ID。valid:false不生成回应。`;
}
export function parseIntentCandidate(value: unknown, judgment: Judgment, round: 'O1' | 'O2', evidence: unknown[]): DialogueIntentCandidate {
    const candidate = value as Partial<DialogueIntentCandidate> & { text?: unknown } | null;
    if (candidate?.kind !== 'intent-bank' || candidate.text !== undefined) dialogueProtocolError('intent-bank-required', 'responseCandidate.kind');
    if (!Array.isArray(candidate.intents) || !candidate.intents.length || candidate.intents.length > 2) dialogueProtocolError('intent-selection-invalid', 'responseCandidate.intents');
    const available = new Set(evidence.map(value => (value as { id?: unknown } | null)?.id));
    const seen = new Set<string>();
    for (const [index, choice] of candidate.intents.entries()) {
        const field = `responseCandidate.intents.${index}`, bank = responseIntentBank[round];
        const intent = typeof choice?.id === 'string' && Object.hasOwn(bank, choice.id) ? bank[choice.id] : undefined;
        if (!intent || seen.has(choice.id)) dialogueProtocolError('intent-id-invalid', `${field}.id`);
        seen.add(choice.id);
        if (typeof choice.quote !== 'string' || !choice.quote.trim() || !judgment.input.includes(choice.quote)) dialogueProtocolError('intent-quote-invalid', `${field}.quote`);
        if (intent.evidence?.some(id => !available.has(id))) dialogueProtocolError('intent-evidence-unavailable', `${field}.id`);
        if (intent.score === 'trust-negative' && judgment.scores.trust.delta >= 0 || intent.score === 'responsibility-negative' && judgment.scores.responsibility.delta >= 0)
            dialogueProtocolError('intent-score-ineligible', `${field}.id`);
    }
    if (candidate.intents.length > 1 && candidate.intents.some(choice => ['other_statement', 'unresolved_question'].includes(choice.id)))
        dialogueProtocolError('intent-fallback-overlap', 'responseCandidate.intents');
    const result: DialogueIntentCandidate = { kind: 'intent-bank', intents: candidate.intents.map(({ id, quote }) => ({ id, quote })) };
    if (composeIntentResponse(result, round).length > 180) dialogueProtocolError('intent-response-too-long', 'responseCandidate.intents');
    return result;
}
export function composeIntentResponse(candidate: DialogueIntentCandidate, round: 'O1' | 'O2') {
    return candidate.intents.map(choice => responseIntentBank[round][choice.id].text).join('') + responseStageTail[round];
}
export function validateIntentEvidence(value: unknown, candidate: DialogueIntentCandidate, input: string) {
    if (!Array.isArray(value) || value.length !== candidate.intents.length) dialogueProtocolError('intent-audit-evidence-required', 'responseAudit.intentEvidence');
    for (const [index, choice] of candidate.intents.entries()) {
        const item = value[index], field = `responseAudit.intentEvidence.${index}`;
        if (item?.id !== choice.id || item?.quote !== choice.quote || !input.includes(item.quote)) dialogueProtocolError('intent-audit-reference-mismatch', field);
        if (typeof item.supported !== 'boolean' || typeof item.explanation !== 'string' || !item.explanation.trim() || item.explanation.length > 300)
            dialogueProtocolError('intent-audit-incomplete', field);
        if (!item.supported) dialogueProtocolError('intent-audit-unsupported', `${field}.supported`);
    }
}
