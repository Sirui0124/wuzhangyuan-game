import type { JudgeRequest, JudgeResult, Evidence } from '../../../../content/schema/narrative';
import { GameApi } from '../GameApi';

/** Transport and enum mapping only. The phase prompt owns all semantic judgment. */
export async function requestWeiyanDecision(api: GameApi, request: JudgeRequest, evidence: Evidence[],
    instructions: string, engineFacts: NonNullable<JudgeRequest['weiyan']>['engineFacts'] | undefined,
    signal?: AbortSignal): Promise<JudgeResult> {
    const response = await api.respond({ text: JSON.stringify({ kind: 'classify', instructions,
        requestId: request.requestId, playerText: request.text,
        ...(engineFacts ? { engineFacts } : {}),
        presentedEvidence: evidence.filter(e => request.evidenceIds.includes(e.id)) }) }, signal);
    const raw = JSON.parse(response.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as
        { requestId?: unknown; choice?: unknown; planQuote?: unknown; reason?: unknown };
    if (raw?.requestId !== request.requestId || typeof raw?.choice !== 'string' ||
        !['WAIT_OUTSIDE', 'ENTER_TENT', 'EXECUTE'].includes(raw.choice) || typeof raw.reason !== 'string')
        throw new Error('魏延回应格式不完整，请重试。');
    // Do not inspect player wording, planQuote, evidence sufficiency or approval to reclassify.
    const accepted = raw.choice === 'WAIT_OUTSIDE', execute = raw.choice === 'EXECUTE';
    return { requestId: request.requestId, status: accepted ? 'accept' : execute ? 'out_of_scope' : 'need_plan',
        interpretedIntentId: accepted ? 'propose_wait' : null, supportedEvidenceIds: [...request.evidenceIds],
        missingPoints: accepted ? [] : execute ? ['OUT_OF_SCOPE'] : ['MISSING_RECEIVER'], explanation: raw.reason };
}
