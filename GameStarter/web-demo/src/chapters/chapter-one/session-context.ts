import type { FlowTarget } from '../../../../../content/schema/chapter-session';
import type { ChapterReview, Derived, StoryRow } from './thought-canvas-model';
import type { GameSessionState, SessionEvent } from './session-state';
/** Controllers share this chapter's live state, including after restart or restore. */
export type ChapterSessionContext = {
    readonly state: GameSessionState;
    readonly content: ChapterReview;
    readonly rows: Map<string, StoryRow>;
    readonly collected: string[];
    graph(): Record<string, Derived>;
    emit(event?: SessionEvent): void;
    enter(target: FlowTarget): void;
    act(id: string): boolean;
    cancelGeneration(emit?: boolean): void;
};
