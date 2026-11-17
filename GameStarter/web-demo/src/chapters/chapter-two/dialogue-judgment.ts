import { parseEraFailure, eraArrestReply, type EraFailure } from '../../phone/era-judgment';
import { GrainDialogueError, dialogueProtocolError } from './dialogue-errors';
import { parseStoredResponse, type DialogueResponse } from './dialogue-response';

export const dimensions = ['trust', 'rigor', 'responsibility'] as const;
export type Dimension = typeof dimensions[number];
export type Rubric = { version: string; initial: Record<Dimension, number>; dimensions: Record<Dimension, { name: string; question: string; levels: Record<string, string> }>; rules: string[]; rounds?: Record<string, { title: string; dimensions: Rubric['dimensions'] }>; scene?: 'O1' | 'O2' };
export function rubricForRound(rubric: Rubric, round?: 'O1' | 'O2'): Rubric {
    const config = round && rubric.rounds?.[round];
    return config ? { ...rubric, dimensions: config.dimensions, scene: round } : rubric;
}
export type Judgment = { input: string; rubricVersion: string; scores: Record<Dimension, { delta: number; quote: string; reason: string }>; reply: string; response?: DialogueResponse; gift?: { ids: string[]; quote: string }; eraFailure?: EraFailure; diagnosticId?: string };
export function parseJudgment(raw: string, input: string, rubric: Rubric, offered: string[] = []): Judgment {
    let result: any;
    try { result = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
    catch { dialogueProtocolError('invalid-json', '$'); }
    if (!result || typeof result !== 'object' || Array.isArray(result)) dialogueProtocolError('object-required', '$');
    if (result?.eraFailure !== undefined) {
        let eraFailure: EraFailure;
        try { eraFailure = parseEraFailure(result.eraFailure, offered, input); }
        catch { dialogueProtocolError('era-failure-invalid', 'eraFailure'); }
        if (result.gift?.ids?.length) dialogueProtocolError('failure-cannot-accept-gift', 'gift');
        const score = { delta: 0, quote: '', reason: '交谈因异物中止，未获得认可。' };
        return { input, rubricVersion: rubric.version, scores: { trust: { ...score }, rigor: { ...score }, responsibility: { ...score } }, reply: eraArrestReply, eraFailure };
    }
    if (result?.valid === false) throw new GrainDialogueError('expression', 'unrelated-or-unreadable', 'valid');
    if (result?.valid !== true) dialogueProtocolError('valid-required', 'valid');
    if (!result.scores || typeof result.scores !== 'object' || Array.isArray(result.scores)) dialogueProtocolError('scores-required', 'scores');
    const scores = {} as Judgment['scores'];
    for (const key of dimensions) {
        const s = result.scores[key];
        if (!s || typeof s !== 'object' || Array.isArray(s)) dialogueProtocolError('dimension-required', `scores.${key}`);
        if (!Number.isInteger(s.delta)) dialogueProtocolError('integer-required', `scores.${key}.delta`);
        if (s.delta < -2 || s.delta > 2) dialogueProtocolError('out-of-range', `scores.${key}.delta`);
        if (typeof s.quote !== 'string') dialogueProtocolError('string-required', `scores.${key}.quote`);
        if (s.quote.length > 1500) dialogueProtocolError('too-long', `scores.${key}.quote`);
        if (s.quote && !input.includes(s.quote)) dialogueProtocolError('quote-not-in-input', `scores.${key}.quote`);
        if (s.delta !== 0 && !s.quote.trim()) dialogueProtocolError('quote-required', `scores.${key}.quote`);
        if (typeof s.reason !== 'string' || !s.reason.trim()) dialogueProtocolError('reason-required', `scores.${key}.reason`);
        if (s.reason.length > 300) dialogueProtocolError('too-long', `scores.${key}.reason`);
        scores[key] = { delta: s.delta, quote: s.quote, reason: s.reason };
    }
    // Score-only legacy records remain valid. New online replies must be independently verified.
    const response = result.response === undefined ? undefined : parseStoredResponse(result.response, input, rubric.scene ?? 'O1');
    const reply = response?.text ?? '';
    const gift = result.gift;
    if (gift !== undefined && (!gift || !Array.isArray(gift.ids) || new Set(gift.ids).size !== gift.ids.length || gift.ids.length > 2
        || gift.ids.some((id: unknown) => typeof id !== 'string' || !offered.includes(id)) || typeof gift.quote !== 'string'
        || (gift.ids.length && (!gift.quote.trim() || !input.includes(gift.quote))))) dialogueProtocolError('gift-invalid', 'gift');
    return { input, rubricVersion: rubric.version, scores, reply: gift?.ids.length ? '东西我收下了。' + reply : reply, ...(response ? {response} : {}), ...(gift ? {gift} : {}) };
}
