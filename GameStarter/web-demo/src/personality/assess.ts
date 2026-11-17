import { createEvaluationModule } from '../modules/evaluation';

export type PersonalitySource = 'self-authored' | 'fixed-option' | 'assistant-generated' | 'mixed' | 'unknown';
export type PersonalityVector = [number | null, number | null, number | null, number | null];
export type PersonalityQuotes = [string | null, string | null, string | null, string | null];
export interface PersonalityAssessmentInput {
    chapterId: string;
    nodeId: string;
    /** The exact confirmed text; never an unsent draft or an NPC response. */
    input: string;
    round?: number | 'first' | 'authorized' | 'O1' | 'O2';
    context?: Record<string, unknown>;
    origin?: PersonalitySource | {
        type: PersonalitySource;
        /** Exact text written by the player before optional rewriting. */
        originalText?: string;
        assistantSpanRanges?: { startUtf16: number; endUtf16: number }[];
    };
}
export interface PersonalityAssessment {
    vector: PersonalityVector;
    quotes: PersonalityQuotes;
    reasons: string[];
    excluded: boolean;
    sceneId: string;
    slot: string | null;
    rubricVersion: string;
}

function checkedResult(raw: unknown, input: PersonalityAssessmentInput): PersonalityAssessment {
    const result = raw as Partial<PersonalityAssessment> | null;
    if (!result || !Array.isArray(result.vector) || result.vector.length !== 4
        || !Array.isArray(result.quotes) || result.quotes.length !== 4 || !Array.isArray(result.reasons)
        || result.reasons.length !== 4 || result.reasons.some(reason => typeof reason !== 'string')
        || result.sceneId !== input.nodeId || typeof result.excluded !== 'boolean'
        || typeof result.rubricVersion !== 'string' || (result.slot !== null && typeof result.slot !== 'string')) {
        throw new Error('人格评估结果未核对完整，原话已保留。');
    }
    const origin = typeof input.origin === 'string' ? { type: input.origin } : input.origin ?? { type: 'unknown' };
    result.vector.forEach((value, axis) => {
        const quote = result.quotes![axis];
        if (value === null ? quote !== null : (!Number.isInteger(value) || value < -2 || value > 2
            || typeof quote !== 'string' || !quote.trim() || !input.input.includes(quote))) {
            throw new Error('人格评估缺少对应原句，暂不计分。');
        }
        if (axis === 1 && value !== null && (origin.type !== 'self-authored'
            && !(origin.type === 'mixed' && typeof quote === 'string' && origin.originalText?.includes(quote)))) {
            throw new Error('人格表达依据的来源未核对完整。');
        }
    });
    if (result.excluded && result.vector.some(value => value !== null)) throw new Error('教学段不能计入人格。');
    return result as PersonalityAssessment;
}

/** Uses the same currently configured proxy/provider as the game, with no local scoring fallback. */
export function createPersonalityAssessor(options: {
    enabled?: () => boolean;
    baseUrl?: string;
    timeoutMs?: number;
    fetch?: typeof fetch;
} = {}) {
    const evaluate = createEvaluationModule<PersonalityAssessmentInput, PersonalityAssessment>({
        enabled: options.enabled ?? (() => true),
        online: async (input, signal) => {
            if (!input.input.trim() || input.input.length > 12000) throw new Error('请先确认本次原话。');
            const combined = AbortSignal.any([signal, AbortSignal.timeout(options.timeoutMs ?? 50000)]);
            combined.throwIfAborted();
            const response = await (options.fetch ?? fetch)(`${(options.baseUrl ?? 'http://127.0.0.1:8787').replace(/\/$/, '')}/api/game/personality`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
                body: JSON.stringify(input), signal: combined,
            });
            const result = await response.json();
            combined.throwIfAborted();
            if (!response.ok) throw new Error(result.error || '人格评估暂未完成，原话已保留。');
            return checkedResult(result, input);
        },
    });
    return {
        assess: (input: PersonalityAssessmentInput, signal: AbortSignal = new AbortController().signal) => {
            if (input.chapterId === 'wuzhang' && (input.nodeId === 'R1-LANG' || input.round === 1 || input.round === 'first')) {
                signal.throwIfAborted();
                return Promise.resolve({ vector: [null, null, null, null], quotes: [null, null, null, null],
                    reasons: ['首轮教学不计人格。', '首轮教学不计人格。', '首轮教学不计人格。', '首轮教学不计人格。'],
                    excluded: true, sceneId: input.nodeId, slot: null, rubricVersion: 'tutorial-excluded' } as PersonalityAssessment);
            }
            return evaluate.evaluate(input, signal);
        },
        cancel: evaluate.cancel,
        dispose: evaluate.dispose,
    };
}

const defaultAssessor = createPersonalityAssessor();
export const assessPersonality = (input: PersonalityAssessmentInput, signal?: AbortSignal): Promise<PersonalityAssessment> => defaultAssessor.assess(input, signal);
