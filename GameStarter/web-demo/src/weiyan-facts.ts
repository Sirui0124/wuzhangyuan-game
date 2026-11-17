import type { ExpressionJudgeInput } from './chapter-session';

/** C08's completed in-story commitment, shared by composition and judgment after their evidence gates. */
export const JIANG_CONFIRMED_CONSENT_FACT = '姜维已亲口答应在帐外接报，判断是否禀报丞相，并担责；他已表示就在帐外等候魏延。';

/** C03's acquired supplements must be identical in the writer brief and the judge's fact table. */
export function currentEnemyObservation(summary: string, originals: readonly { id: string }[]) {
    const ids = new Set(originals.map(row => row.id));
    let fact = summary;
    if (ids.has('D22') && ids.has('D23')) fact += '；我军不动时敌军也不往前，我军调兵时敌军随之换向。';
    if (ids.has('D24')) fact += '敌骑还在营外，未碰鹿角，也未见步卒跟进。';
    return fact;
}

/** Chapter-owned facts come only from acquired evidence, never from the player's wording. */
export function compactWeiyanFacts(evidence: ExpressionJudgeInput['evidence']) {
    const ids = new Set(evidence.map(clue => clue.id));
    const campSources = evidence.filter(clue => clue.id === 'T02' || (clue.id === 'C03' && clue.originals.some(row => row.id === 'D24'))).map(clue => clue.id);
    const authorized = ids.has('C08');
    return {
        status: {
            jiangConsent: {
                state: authorized ? '已确认' : '未取得',
                detail: authorized ? JIANG_CONFIRMED_CONSENT_FACT : '没有姜维本人的接报承诺；职责不等于本人答应。',
                sources: authorized ? ['C08'] : [],
            },
            campSituation: {
                state: campSources.length ? '已知' : '未知',
                detail: campSources.length ? '敌军尚未攻营、营门尚未被突破；仍有危险，不可保证退兵。'
                    : '不知道营门是否被突破或敌军是否攻营；不得断言营门未破、敌军未攻营。阵前叫嚷不能证明这些。',
                sources: campSources,
            },
        },
        known: evidence.map(clue => ({
            id: clue.id, fact: clue.id === 'C08' ? JIANG_CONFIRMED_CONSENT_FACT
                : clue.id === 'C03' ? currentEnemyObservation(clue.summary, clue.originals) : clue.summary,
            boundary: clue.id === 'C08' ? '本条须来自姜维实际亲口应允；标题中的可处理不授予尚未发生的接报或军令。'
                    : clue.boundary,
        })),
    };
}
