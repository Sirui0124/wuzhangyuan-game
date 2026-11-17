import type { JietingCriteria } from './ai-contracts';
import type { JietingGuardAssessment, JietingOutcome, JietingScores } from './types';

export const JIETING_TOTAL = 25000;
export const JIETING_INITIAL_BELOW = 5000;
export const JIETING_TIGER = 'fuhu-wood-tiger';
export const JIETING_SAVE_KEY = 'wuzhang-jieting-save-v1';
export const troopsForOutcome = (outcome: JietingOutcome): 0 | 3000 | 5000 => outcome === 'great' ? 5000 : outcome === 'small' ? 3000 : 0;
export const clampScore = (n: number) => Math.max(0, Math.min(10, Number.isFinite(n) ? n : 0));

/** The model reports semantic evidence; only these chapter rules choose rewards. */
export function reinforcementOutcome(c: JietingCriteria): JietingOutcome {
    if (!c.factsReliable || !c.gapEstablished || !c.reinforcementUse) return 'none';
    return c.concernAnswered ? 'great' : 'small';
}
export function withdrawalReady(c: JietingCriteria) {
    return c.factsReliable && c.risk && c.route && c.reception;
}
export function lurePlanReady(c: JietingCriteria) {
    return c.factsReliable && c.motive && c.means && c.reception && c.withdrawal;
}
export function lureEligible(scores: JietingScores, below: number, method: 'phone' | 'fixed') {
    return below >= 10000 && scores.m >= 4 && scores.w >= 4 && scores.r >= (method === 'phone' ? 5 : 7);
}
export function earlyWithdrawalEligible(scores: JietingScores) { return scores.m >= 4; }
export function rearReceptionEligible(scores: JietingScores) { return scores.w >= 4 && scores.r >= 5; }
export function guardAssessment(scores: JietingScores, below: number, options: { early?: boolean; rearReception?: boolean; failedLure?: boolean } = {}): JietingGuardAssessment {
    const cooperation = (scores.w + scores.m) / 2;
    const strength = below / 1000;
    const receptionBonus = options.rearReception && !options.early ? 3 : 0;
    const failedLurePenalty = options.failedLure ? 3 : 0;
    const score = strength + cooperation + scores.r + receptionBonus - failedLurePenalty;
    return { cooperation, strength, receptionBonus, failedLurePenalty, score,
        holds: score >= 20, allRearSafe: score >= 26, masuAlive: score >= 20 && (!!options.early || score >= 26) };
}

/** A stable key invalidates pending work when draft, evidence, mode or actual facts change. */
export function contextDigest(value: unknown): string {
    const source = JSON.stringify(value); let hash = 2166136261;
    for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16);
}
