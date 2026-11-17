import type { ChapterPhase, ChapterScene } from '../../../../../content/schema/chapter-session';
import type { RuntimeMode } from '../../runtime-mode';
import type { SessionIdentity } from '../../session/contracts';
import type { NpcTurn, PersuasionResult } from '../../npc-dialogue';
import type { ThoughtWorkspace } from './thought-workspace';
import type { ExpressionGenerationInput } from '../../expression-contract';
export type { ExpressionGenerationInput } from '../../expression-contract';
import { freshReview, type ReviewSave } from './thought-canvas-model';
import type { TentStage } from './tent-visit';
export const GAME_SAVE_KEY = 'wuzhang-chapter-session-v1';
export const GAME_ENDINGS_KEY = 'wuzhang-chapter-endings-v2';
/** Bump when judgment rules change so an unread saved verdict cannot bypass the current rules. */
  export const WEIYAN_JUDGMENT_VERSION = 'weiyan-narrative-20261117-v7';
export type Speech = {
    text: string;
    selected: string[];
    status: 'waiting' | 'ready' | 'cancelled' | 'failed';
    result?: PersuasionResult;
    npcTurn?: NpcTurn;
    judgmentVersion?: string;


};
export const CHAPTER_ID = 'wuzhang' as const;

export type SpeechHistoryEntry = ReviewSave['history'][number] & { round?: 1 | 2 };
export type ChapterStorySave = Omit<ReviewSave, 'history'> & { history: SpeechHistoryEntry[] };
/** Older sessions cleared history on the tutorial rewind, so untagged entries belong to that saved round. */
export function speechHistoryRound(entry: SpeechHistoryEntry, savedRound: 1 | 2): 1 | 2 {
    return entry.round ?? (entry.npcTurn ? (entry.npcTurn.stage === 'first' ? 1 : 2) : savedRound);
}
export type GameSessionState = SessionIdentity<typeof CHAPTER_ID> & {
    branch?: import('./branch-progress').BranchSave;
    runtimeMode?: RuntimeMode;
    story: ChapterStorySave;
    /** Text actually presented when a fixed dialogue row was completed. */
    displayedRows?: Record<string, string>;
    phase: ChapterPhase;
    scene: ChapterScene;
    round: 1 | 2;
    section: string | null;
    lineIndex: number;
    finishedSections: string[];
    cinematic: string | null;
    finishedCinematics: string[];
    notesReturn: ChapterPhase | null;
    notesPurpose: 'review' | 'P1' | 'P2';
    speech: Speech | null;
    lastFeedback: string;
    end: 'tutorial-sacrifice' | 'weiyan-execution' | 'tent-execution' | 'safe' | null;
    tent: TentStage;


    panelOpened: string[];
    savedAt: string;
    thinking: ThoughtWorkspace | null;
    composition: Composition;
};
export type Composition = {
    focus: string;
    status: 'idle' | 'waiting' | 'ready' | 'failed' | 'cancelled';
    error: string;
    provenance: 'ai' | 'manual' | 'local';
    evidenceIds: string[];
    diagnostic?: import('../../expression-audit').ExpressionDiagnostic;
    /** Only the draft replaced by the most recent successful polish; not a speech or an answer. */
    previousDraft?: { text: string; provenance: 'ai' | 'manual' | 'local'; evidenceIds: string[] };
};
export const freshComposition = (): Composition => ({
    focus: '', status: 'idle', error: '', provenance: 'manual', evidenceIds: []
});
export type ExpressionJudgeInput = {
    stage: 'first' | 'authorized';
    evidence: {
        id: string;
        summary: string;
        boundary: string;
        originals: {
            id: string;
            speaker: string;
            text: string;
        }[];
    }[];
    said: string[];
    current: string;

};
export type ExpressionJudge = (input: ExpressionJudgeInput, signal: AbortSignal) => Promise<NpcTurn>;
export type ExpressionGenerator = (input: ExpressionGenerationInput, signal: AbortSignal) => Promise<{
    text: string;
    evidenceIds: string[];
    provenance?: 'local';
}>;
export type SessionEvent = {
    type: 'line' | 'clue' | 'section' | 'cinematic' | 'ending' | 'graph' | 'speech' | 'change';
    id?: string;
    message?: string;
};
export const phases: ChapterPhase[] = ['explore', 'dialogue', 'choice', 'cinematic', 'thought-prompt', 'thoughts', 'expression', 'spoken', 'reply', 'death', 'ending', 'map', 'tent'];
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function freshSessionState(scriptVersion: string, contentVersion: string): GameSessionState {
    return {
        schemaVersion: 1, chapterId: CHAPTER_ID, contentVersion, story: freshReview(scriptVersion), displayedRows: {},
        phase: 'explore', scene: 'camp_gate', round: 1, section: null, lineIndex: 0,
        finishedSections: [], cinematic: null, finishedCinematics: [],
        notesReturn: null, notesPurpose: 'review', speech: null, lastFeedback: '', end: null, tent: 'unheard',
        panelOpened: [], savedAt: new Date().toISOString(), thinking: null, composition: freshComposition(),
    };
}
