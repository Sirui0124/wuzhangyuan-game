import { dialogueProtocolError } from './dialogue-errors';

export const auditQuoteReferenceVersion = 'gouan-audit-quote-reference-20261027-v1';
export const auditPlayerWordsRef = 'player-words';
/** The auditor judges the complete input; code owns its verbatim citation. No model retry or reassessment. */
export function resolveAuditQuoteReferences(audit: any, input: string) {
    const source = audit?.scoreEvidence;
    if (!source || typeof source !== 'object' || Array.isArray(source)) return { audit, resolvedFields: [] as string[] };
    const scoreEvidence = { ...source }, resolvedFields: string[] = [];
    for (const key of ['trust', 'rigor', 'responsibility'] as const) {
        const item = source[key];
        if (!Array.isArray(item?.conditionEvidence)) continue;
        scoreEvidence[key] = { ...item, conditionEvidence: item.conditionEvidence.map((proof: any, index: number) => {
            if (!proof || typeof proof !== 'object' || !Object.hasOwn(proof, 'playerQuoteRef')) return proof;
            const field = `responseAudit.scoreEvidence.${key}.conditionEvidence.${index}`;
            if (proof.playerQuoteRef !== auditPlayerWordsRef || !input.trim())
                dialogueProtocolError('score-audit-quote-reference-invalid', `${field}.playerQuoteRef`);
            // Do not silently replace a conflicting free-text quote, or invent evidence for an unknown reference.
            if (proof.playerQuote !== undefined && proof.playerQuote !== input)
                dialogueProtocolError('score-audit-quote-reference-conflict', `${field}.playerQuote`);
            resolvedFields.push(`${field}.playerQuote`);
            return { ...proof, playerQuote: input };
        }) };
    }
    return { audit: { ...audit, scoreEvidence }, resolvedFields };
}
