import type { Condition } from '../../../../content/schema/narrative';
import type { RuntimeState } from './state';
export interface InteractionContext { actorId: string | null; evidenceIds: string[]; intentId: string | null; }
export const emptyContext = (): InteractionContext => ({ actorId: null, evidenceIds: [], intentId: null });
export function evaluate(condition: Condition, state: RuntimeState, context: InteractionContext = emptyContext()): boolean {
    if ('all' in condition) return condition.all.every(c => evaluate(c, state, context));
    if ('any' in condition) return condition.any.some(c => evaluate(c, state, context));
    if ('not' in condition) return !evaluate(condition.not, state, context);
    if ('flag' in condition) return state.flags[condition.flag] === condition.equals;
    if ('evidence' in condition) {
        const held = state.evidence[condition.evidence]?.loopId === state.loopId;
        return held && (condition.mode === 'held' || context.evidenceIds.includes(condition.evidence));
    }
    return context.intentId === condition.intent;
}
