import type { JietingSession } from './session';
import type { CharacterProgress } from '../../characters/encounters';
import { speakerPortrait } from './presentation';
/** Unlocks use the authored entrance table; a name mentioned in another line grants nothing. */
export function chapterThreeCharacters(session: JietingSession): CharacterProgress {
    return { chapter: 'jieting', entered: [session.current.id], completed: session.state.visited,
        active: speakerPortrait[session.feedback?.speaker ?? session.current.speaker] || undefined, visible: true };
}
