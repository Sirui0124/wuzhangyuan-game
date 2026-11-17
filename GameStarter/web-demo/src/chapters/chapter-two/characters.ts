import type { GrainSession } from './session';
import type { CharacterProgress } from '../../characters/encounters';
export function chapterTwoCharacters(session: GrainSession): CharacterProgress {
    const n = session.current;
    return { chapter: 'grain', entered: [n.id], completed: session.state.visited, visible: true,
        // Films have no reviewed per-shot identity timeline. A newly unlocked dossier
        // belongs to the completed film and must not label the following shot.
        active: n.kind === 'video' ? '' : n.kind === 'open' || n.speaker === '苟安' ? 'gouan' : n.speaker === '粮队管事' ? 'grain-officer' : undefined };
}
