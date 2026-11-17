/** Compatibility entry for the first chapter. Other chapters own separate runtimes. */
export { ChapterOneSession as ChapterSession } from './chapters/chapter-one/session';
export { GAME_SAVE_KEY, GAME_ENDINGS_KEY } from './chapters/chapter-one/session-state';
export type {
    Speech, GameSessionState, Composition, ExpressionJudgeInput, ExpressionJudge,
    ExpressionGenerationInput, ExpressionGenerator, SessionEvent,
} from './chapters/chapter-one/session-state';
export type { PersuasionResult, NpcTurn } from './npc-dialogue';
