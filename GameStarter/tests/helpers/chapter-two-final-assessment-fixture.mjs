/** Protocol fixture only. The caller supplies semantic decisions; this helper never proves their correctness. */
export function makeFinalAssessmentFixture(payload, { deltas = [1, 2, 0], intentIds = ['date_gap'], met = {}, explanation = '开发协议样例；不证明真实语义。' } = {}) {
    const refs = payload.quoteSources.map(source => source.id);
    const conditions = Object.fromEntries(payload.necessaryConditions.items.map(item => [item.id,
        { met: met[item.id] ?? true, sourceRefs: met[item.id] === false ? [] : refs, explanation }]));
    const scores = Object.fromEntries(['trust', 'rigor', 'responsibility'].map((key, index) => [key,
        { delta: deltas[index], sourceRefs: deltas[index] === 0 ? [] : refs, reason: explanation }]));
    return { schemaVersion: payload.schemaVersion, conditions, scores,
        responseCandidate: { kind: 'intent-bank', intents: intentIds.map(id => ({ id, sourceRefs: refs })) },
        intentEvidence: intentIds.map(id => ({ id, sourceRefs: refs, supported: true, explanation })),
        checks: { scoresSupported: true, grounded: true, faithful: true, responsive: true, continuity: true, templateFit: true }, reason: '' };
}
