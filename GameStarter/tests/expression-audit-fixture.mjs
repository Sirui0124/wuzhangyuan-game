// Structural tests supply semantic verdicts deliberately. These receipts make the
// mocked protocol explicit; they are not evidence that a real model verified prose.
export function withAuditReceipts(api) {
    return { ...api, respond: async (...args) => {
        const response = await api.respond(...args);
        try {
            const prompt = args[0].text;
            const data = JSON.parse(prompt.slice(prompt.lastIndexOf('资料：') + 3));
            if (!data.auditTargets) return response;
            const value = JSON.parse(response.text.trim().replace(/^```(?:json)?\s*|\s*```$/gi, '').trim());
            if (!value?.checks) return response;
            value.intentComparison ??= data.auditTargets.intent.map(target => ({ id: target.id, quote: data.candidate.text, styleOnly: false }));
            value.meaningMatches ??= data.auditTargets.meanings.map(target => ({ id: target.id, quote: data.candidate.text }));
            return { ...response, text: JSON.stringify(value) };
        } catch { return response; }
    } };
}

export function addDialogueAuditReceipts(value, prompt) {
    try {
        const data = JSON.parse(prompt.slice(prompt.lastIndexOf('资料：') + 3));
        if (!data.intentTargets || !data.input || !Object.hasOwn(value, 'coverage')) return value;
        return { ...value,
            intentComparison: value.intentComparison ?? data.intentTargets.map(target => ({ id: target.id, quote: data.candidate, styleOnly: false })),
            evidenceMatches: value.evidenceMatches ?? data.input.evidence.map(e => ({ id: e.id, points: [{ sourceQuote: e.text, quote: data.candidate }] })),
        };
    } catch { return value; }
}
export function withDialogueAuditReceipts(api) {
    return { ...api, respond: async (...args) => {
        const response = await api.respond(...args);
        try { return { ...response, text: JSON.stringify(addDialogueAuditReceipts(JSON.parse(response.text), args[0].text)) }; }
        catch { return response; }
    } };
}
