import type { GameSessionState } from '../chapter-session';
import type { Clip } from '../cinematics';

export type EndingFilm = Clip & { ending: string; still?: { src: string; alt: string } };

/** Films illustrate an already earned outcome; they never grant it. */
export function endingFilmForState(films: EndingFilm[], state: GameSessionState) {
    const route = state.supplies.agreement?.route;
    if (route && state.phase === 'dialogue' && state.section === 'after-report' && state.lineIndex === 0
        && state.story.flags.REPORT_CLOSED) return films.find(film => film.ending === route) ?? null;
    if (!['death', 'ending'].includes(state.phase) || !state.end) return null;
    if (state.end === 'tent-execution' && state.tent !== 'dead') return null;
    // Material epilogues belong to the night of the report, before dawn and the seven-day montage.
    if (['radio-relay', 'light-signal', 'item-plan'].includes(state.end)) return null;
    return films.find(film => film.ending === state.end) ?? null;
}
