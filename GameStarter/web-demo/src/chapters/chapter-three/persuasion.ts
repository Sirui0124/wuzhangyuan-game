import type { JietingArgument, JietingArgumentTopic, JietingCriteria, JietingJudgment } from './ai-contracts';
import type { JietingRoundRecord } from './types';
import { reinforcementOutcome, troopsForOutcome } from './rules';

export const REINFORCEMENT_LIMIT = 5, REINFORCEMENT_TARGET = 20000;
export const argumentTopics: Record<JietingArgumentTopic, { title: string; clues: string[] }> = {
    road: { title: '正面与侧路都要守', clues: ['JT-C04', 'JT-C05', 'JT-C08'] },
    water: { title: '护住上下山的水路', clues: ['JT-C03', 'JT-C09'] },
    reception: { title: '趁山道还通安排接应', clues: ['JT-C08', 'JT-C12'] },
    mandate: { title: '守住要道才算完成军令', clues: ['JT-C01'] },
    initiative: { title: '下山仍可掌握战机', clues: ['JT-C02', 'JT-C06', 'JT-C11'] },
};
export function argumentSupported(argument: JietingArgument, clues: string[], words: string[]) {
    const topic = argumentTopics[argument.topic];
    return !!topic && !!argument.quote?.trim() && words.some(w => w.includes(argument.quote))
        && Array.isArray(argument.clueIds) && argument.clueIds.length > 0
        && new Set(argument.clueIds).size === argument.clueIds.length && argument.clueIds.every(id => clues.includes(id))
        && argument.clueIds.some(id => topic.clues.includes(id))
        && (argument.topic !== 'initiative' || argument.clueIds.includes('JT-C02'));
}
/** Historic records predate argument tracking, but their actual orders are preserved. */
export function recordTopic(r: JietingRoundRecord): JietingArgumentTopic {
    return r.argument?.topic ?? r.tasks[0] ?? (r.round === 1 ? 'road' : r.round === 2 ? 'water' : 'reception');
}
export function argumentLedger(records: JietingRoundRecord[]) {
    return records.filter(r => r.troops > 0).map(r => ({ topic: recordTopic(r), troops: r.troops, quote: r.argument?.quote ?? r.input ?? '' }));
}
export function reinforcementGrant(criteria: JietingCriteria, argument: JietingArgument | undefined, records: JietingRoundRecord[], below: number, maintain = false, supportedTroops?: number) {
    let outcome = maintain ? 'none' : reinforcementOutcome(criteria);
    if (outcome === 'none' || !argument) return { outcome: 'none' as const, troops: 0 };
    let support = supportedTroops === undefined ? troopsForOutcome(outcome) : supportedTroops;
    if (!Number.isInteger(support) || support < 0 || support > 5000) return { outcome: 'none' as const, troops: 0 };
    if (!criteria.concernAnswered) support = Math.min(support, 3000);
    if (supportedTroops !== undefined) outcome = support >= 4000 && criteria.concernAnswered ? 'great' : support > 0 ? 'small' : 'none';
    const previous = records.filter(r => recordTopic(r) === argument.topic && r.troops > 0);
    const credited = previous.reduce((n, r) => n + r.troops, 0);
    const normalize = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, '');
    const repeated = previous.some(r => normalize(r.argument?.quote ?? r.input ?? '') === normalize(argument.quote));
    const troops = Math.max(0, Math.min(support - credited, REINFORCEMENT_TARGET - below));
    return repeated || !troops ? { outcome: 'none' as const, troops: 0 } : { outcome, troops };
}
export function grantForJudgment(j: JietingJudgment, records: JietingRoundRecord[], below: number) {
    if (j.reasoning && (!j.reasoning.linked || new Set(j.reasoning.clueIds).size < 2 || !j.reasoning.quote.trim() || !j.reasoning.conclusion.trim()))
        return { outcome: 'none' as const, troops: 0 };
    return reinforcementGrant(j.criteria, j.argument, records, below, !!j.maintain, j.reinforcementAssessment?.supportedTroops);
}
export function troopWords(n: number): string {
    if (!Number.isInteger(n) || n < 0 || n > 5000) return n.toLocaleString('en-US');
    if (n === 0) return '零';
    const digits = '零一二三四五六七八九', units = ['', '十', '百', '千'];
    let result = '', zero = false;
    for (let i = 3; i >= 0; i--) {
        const digit = Math.floor(n / 10 ** i) % 10;
        if (digit) { if (zero) result += '零'; result += (digit === 2 && i === 3 ? '两' : digits[digit]) + units[i]; zero = false; }
        else if (result && n % 10 ** i) zero = true;
    }
    return result.startsWith('一十') ? result.slice(1) : result;
}
