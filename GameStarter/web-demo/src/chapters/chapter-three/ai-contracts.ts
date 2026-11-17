/** Only committed dialogue is assessed. Chapter state owns scores, orders and endings. */
export type JietingPhase = 'reinforcement' | 'withdrawal' | 'lure';
export const jietingReplyLimits = { acknowledgment: 100, question: 60 } as const;
export type JietingRound = 1 | 2 | 3 | 4 | 5;
export type JietingArgumentTopic = 'road' | 'water' | 'reception' | 'mandate' | 'initiative';
export type JietingArgument = { topic: JietingArgumentTopic; quote: string; clueIds: string[] };
export type JietingReasoning = { linked: boolean; quote: string; clueIds: string[]; conclusion: string };
export type JietingReinforcementAssessment = { supportedTroops: number; quote: string; reason: string };
export type JietingOpeningQuestion = { nodeId: string; contextKey: string; question: string; clueIds: string[] };
export type JietingEvidence = { id: string; title?: string; text: string; current?: boolean };
export type JietingAcceptedReason = { text: string; clueIds: string[]; round?: number };
export type JietingDialogueItem = {
    id: string; name: string; ability: string; boundary: string;
    source: 'phone' | 'world'; available: boolean; shown: boolean;
    tested?: boolean; observedEffect?: string;
};
export type JietingEvaluationContext = {
    nodeId: string; contextKey: string; phase: JietingPhase; round?: JietingRound;
    currentQuestion?: string;
    scores: { w: number; m: number; r: number }; below: number; above: number;
    ownedClues: JietingEvidence[];
    confirmedTranscript: { speaker: string; text: string; round?: number }[];
    acceptedReasons: JietingAcceptedReason[]; unresolvedConcerns: string[];
    followupUsed: boolean; verifiedClueIds?: string[];
    roundResults?: unknown[]; mode?: 'online' | 'offline'; items?: JietingDialogueItem[];
    reinforcement?: { limit: 5; targetBelow: 20000; arguments: { topic: JietingArgumentTopic; troops: number; quote: string }[] };
};
export type JietingEvaluationRequest = {
    context: JietingEvaluationContext; input: string; clueIds: string[]; confirmed: true;
};
export const jietingCriteria = ['gapEstablished', 'reinforcementUse', 'concernAnswered', 'risk', 'route', 'reception', 'motive', 'means', 'withdrawal'] as const;
export type JietingCriterion = typeof jietingCriteria[number];
export type JietingCriteria = Record<JietingCriterion, boolean> & { factsReliable: boolean };
export type JietingSpecial = { kind: 'era-arrest' | 'execution'; quote: string; reason: string; itemIds?: string[] };
export type JietingDeploymentTask = 'road' | 'water' | 'reception';
export type JietingJudgment = {
    version: 1; nodeId: string; contextKey: string; input: string; clueIds: string[];
    phase: JietingPhase; round?: JietingRound; status: 'followup' | 'final';
    outcome: 'great' | 'small' | 'none' | 'accepted' | 'revise'; response: string;
    responseOrigin?: 'generated' | 'review-fallback';
    criteria: JietingCriteria; verifiedClueIds: string[];
    acceptedReasons: JietingAcceptedReason[]; unresolvedConcerns: string[];
    deploymentTasks?: JietingDeploymentTask[];
    argument?: JietingArgument;
    /** Present on new judgments; absent only on already accepted legacy responses. */
    reasoning?: JietingReasoning;
    /** Total justified on this argument, before subtracting troops already credited to it. */
    reinforcementAssessment?: JietingReinforcementAssessment;
    maintain?: boolean; maintainQuote?: string;
    usedItemIds?: string[];
    special?: JietingSpecial;
};
