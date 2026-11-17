import type { GameSessionState } from '../chapter-session';
import type { Clip } from '../cinematics';

export type EndingFilm = Clip & { ending: string; still?: { src: string; alt: string } };

/** Films illustrate an already earned outcome; they never grant it. */
export function endingFilmForState(films: EndingFilm[], state: GameSessionState) {
    if (!['death', 'ending'].includes(state.phase) || !state.end) return null;
    if (state.end === 'tent-execution' && state.tent !== 'dead') return null;
    return films.find(film => film.ending === state.end) ?? null;
}
