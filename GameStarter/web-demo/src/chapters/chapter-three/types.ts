import type { Supplies } from '../../phone/supplies';
import type { PhoneSave } from '../../phone/phone-state';
import type { JietingJudgment, JietingArgument } from './ai-contracts';

export type JietingScores = { w: number; m: number; r: number };
export type JietingRound = 1 | 2 | 3 | 4 | 5;
export type JietingVisit = 'wang' | 'ma' | 'camp';
export type JietingPhase = 'reinforcement' | 'withdrawal' | 'lure';
export type JietingOutcome = 'great' | 'small' | 'none';
export type JietingEndingId = 'hold-both' | 'hold-masu-dies' | 'great-victory' | 'retreat' | 'era-arrest' | 'execution' | 'mountain-trapped' | 'rear-sacrifice';
export type JietingScene = 'jieting_camp' | 'jieting_masu_tent' | 'jieting_wangping_camp' | 'jieting_water_path' | 'jieting_mountain_path' | 'jieting_evening_camp' | 'jieting_battlefield' | 'jieting_lure_camp';
export type JietingCondition = { flag: string; value?: string | boolean | number } | { visitedPlace: JietingVisit } | { not: JietingCondition } | { all: JietingCondition[] } | { any: JietingCondition[] } | { gate: string };
export type JietingEffect =
    | { type: 'clue'; id: string; update?: string }
    | { type: 'score'; id: string; delta: Partial<JietingScores> }
    | { type: 'flag'; key: string; value: boolean | string | number }
    | { type: 'visit'; place: JietingVisit }
    | { type: 'item'; id: string }
    | { type: 'round-result'; round: JietingRound; outcome: JietingOutcome }
    | { type: 'round-order'; round: JietingRound }
    | { type: 'round-arrival'; round: JietingRound }
    | { type: 'round-report'; round: JietingRound }
    | { type: 'checkpoint'; name: string }
    | { type: 'ending'; id: JietingEndingId };
export type JietingOption = { id: string; text: string; next: string; when?: JietingCondition; effects?: JietingEffect[]; source?: string };
export type JietingNode = {
    id: string; kind: 'line' | 'choice' | 'open' | 'route' | 'ending';
    act: 1 | 2 | 3; scene: JietingScene; speaker: string; text: string;
    next?: string; options?: JietingOption[];
    routes?: { when?: JietingCondition; next: string }[];
    effects?: JietingEffect[]; source?: string; sourceText?: string;
    phase?: JietingPhase; round?: JietingRound; ending?: JietingEndingId;
    /** Runtime text variants describe already committed local facts only. */
    textVariants?: { when: JietingCondition; text: string }[];
};
export type JietingClue = { id: string; title: string; text: string; sources: { node: string; speaker: string; text: string; block?: string }[]; current?: boolean };
export type JietingEnding = { id: JietingEndingId; title: string; success: boolean; masuAlive: boolean | null; description: string };
export type JietingStory = {
    version: string; start: string; nodes: JietingNode[]; clues: JietingClue[]; endings: JietingEnding[];
    rulesVersion?: string;
    sources?: { title: string; url: string; revision: number }[];
};
export type JietingRoundRecord = {
    round: JietingRound; outcome: JietingOutcome; troops: number;
    ordered: boolean; arrived: boolean; reported: boolean;
    source: 'fixed' | 'ai'; input?: string; clueIds?: string[];
    tasks: ('road' | 'water' | 'reception')[];
    usedItemIds: string[];
    argument?: JietingArgument;
    supportedTroops?: number;
};
export type JietingTranscript = { speaker: string; text: string; round?: number };
export type JietingReason = { text: string; clueIds: string[]; round?: number };
export type JietingFeedback = { speaker: string; text: string; followup: boolean; final: boolean };
export type JietingProgress = {
    node: string; visited: string[]; chosen: string[];
    flags: Record<string, string | number | boolean>; visits: JietingVisit[];
    scores: JietingScores; scoreEvents: string[];
    clueIds: string[]; clueSourceNodes: Record<string, string[]>; clueUpdates: Record<string, string>;
    sourceReadings: Record<string, { speaker: string; text: string }>;
    roundResults: Partial<Record<JietingRound, JietingRoundRecord>>;
    transcript: JietingTranscript[]; acceptedReasons: JietingReason[]; unresolvedConcerns: string[];
    followupUsed: Partial<Record<string, boolean>>;
    ending: JietingEndingId | null;
    itemTrials: Record<string, { input: string; operation: string; effect: string }>;
    lureItemIds: string[];
    withdrawalItemIds: string[];
    itemUses: { at: string; itemIds: string[]; effects: { id: string; name: string; effect: string }[] }[];
    guidedQuestions?: Record<string, { question: string; clueIds: string[] }>;
};
export type JietingCheckpoint = JietingProgress & { supplies: Supplies; phone: PhoneSave; judgments: JietingJudgment[] };
export type JietingSave = JietingProgress & {
    schema: 1; version: string; run: number; revision: number;
    draft: string; selected: string[]; supplies: Supplies; phone: PhoneSave;
    judgments: JietingJudgment[]; pendingJudgment: JietingJudgment | null;
    checkpoints: Record<string, JietingCheckpoint>;
};
export type JietingMode = { aiEnabled?: boolean; phoneAllowed?: boolean };
export type JietingGuardAssessment = { cooperation: number; strength: number; receptionBonus: number; failedLurePenalty: number; score: number; holds: boolean; allRearSafe: boolean; masuAlive: boolean };
