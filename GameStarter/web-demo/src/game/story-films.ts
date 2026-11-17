import type { ChapterSession, GameSessionState } from '../chapter-session';
import type { Clip, CinematicPlayer } from '../cinematics';
import { esc } from './view-common';
import { bindDialogueScreenInput } from './dialogue-screen-input';

export type StoryFilm = Clip & { rows: string[]; endFrame?: string; afterPlayback?: 'dialogue' | 'advance'; firstLineText?: string };

/** A film can cover only the current consecutive rows; old mid-sentence saves use text. */
export function filmForRows(films: StoryFilm[], remaining: string[]) {
    return films.find(film => film.rows.length > 0 && film.rows.every((id, index) => id === remaining[index])) ?? null;
}

/** Fixed branch variants match the words actually available to this player. */
export function filmForLine(films: StoryFilm[], remaining: string[], currentText: string | undefined, sourceText: string | undefined) {
    return films.find(film => filmForRows([film], remaining) && currentText === (film.firstLineText ?? sourceText)) ?? null;
}

/** Present existing rows as film; only configured transitions advance without confirmation. */
export function createStoryFilms(root: HTMLElement, game: ChapterSession, cinema: CinematicPlayer, films: StoryFilm[], render: () => void) {
    let advancing = false;
    bindDialogueScreenInput(root, () => {
        if (root.querySelector('.game-modal-shade') || document.querySelector('dialog[open],.ending-album-host')) return;
        const confirm = root.querySelector<HTMLButtonElement>('.story-film-confirm:not([hidden]) [data-film-confirm]');
        return confirm ? () => confirm.click() : undefined;
    }, '[data-story-film]');
    function mount(state: GameSessionState): boolean {
        if (advancing) return true;
        if (state.phase !== 'dialogue') return false;
        const section = game.currentSection();
        if (!section) return false;
        const film = filmForLine(films, section.rows.slice(state.lineIndex), game.row()?.text, game.sourceRow(section.rows[state.lineIndex])?.text);
        if (!film) return false;
        // A different branch or generated NPC reply can change the runtime line.
        // Such words must stay on the original presentation, never be overwritten by a film.
        const key = `story:${state.story.run}:${state.round}:${section.id}:${film.id}`;
        // Silent reading shots hand back to the shared dialogue UI without committing the row.
        if (film.afterPlayback === 'dialogue' && cinema.done(key)) return false;
        if (root.querySelector<HTMLElement>('[data-story-film]')?.dataset.storyFilm === key) return true;
        const enterExpression = section.next.kind === 'phase' && section.next.id === 'expression' && state.lineIndex + film.rows.length === section.rows.length;
        root.innerHTML = `<section data-story-film="${esc(key)}"><div data-story-film-host></div><aside class="story-film-confirm" hidden><span>点击画面任意空白处继续</span><div class="story-film-actions"><button type="button" data-film-replay class="story-film-replay">重看本段</button><button type="button" data-film-confirm>${enterExpression ? '组织回应' : '继续'} <span aria-hidden="true">→</span></button></div></aside></section>`;
        const panel = root.querySelector<HTMLElement>('.story-film-confirm')!;
        const confirm = panel.querySelector<HTMLButtonElement>('[data-film-confirm]')!;
        const advance = () => {
            if (advancing || game.snapshot().phase !== 'dialogue') return;
            advancing = true; cinema.dispose();
            try {
                for (const id of film.rows) {
                    if (game.snapshot().phase !== 'dialogue' || game.row()?.id !== id) break;
                    game.nextLine();
                }
            } finally { advancing = false; }
            render();
        };
        confirm.addEventListener('click', event => {
            event.stopPropagation(); event.preventDefault();
            if (!panel.hidden) advance();
        });
        panel.querySelector('[data-film-replay]')!.addEventListener('click', event => {
            event.stopPropagation(); event.preventDefault();
            if (panel.hidden) return;
            // Replay only the uncommitted current film. Narrative rows and clues stay put.
            cinema.forget(key);
            panel.closest('[data-story-film]')!.remove();
            render();
        });
        const ready = () => {
            if (root.querySelector<HTMLElement>('[data-story-film]')?.dataset.storyFilm !== key) return;
            if (film.afterPlayback === 'dialogue') { render(); return; }
            if (film.afterPlayback === 'advance') { advance(); return; }
            // Scout choices already carry the player's intent. Commit the answer's facts,
            // then return to the explicit next action, including completed-film restores.
            if (section.next.kind === 'phase' && (section.next.id === 'choice'
                || ['scout-option-a', 'scout-option-b'].includes(section.id))) { advance(); return; }
            if (film.endFrame) root.querySelector<HTMLElement>('[data-story-film-host]')!.innerHTML = `<main class="cinema-screen"><section class="cinema-frame"><img class="film-end-frame" src="${esc(film.endFrame)}" alt="${esc(film.title)}的最后一帧"></section></main>`;
            else {
                root.querySelector<HTMLElement>('.cinema-controls')?.setAttribute('hidden', '');
                const status = root.querySelector<HTMLElement>('.video-status');
                if (status) status.textContent = '';
            }
            panel.hidden = false;
            panel.closest<HTMLElement>('[data-story-film]')!.dataset.filmReady = 'true';
            // Keep the final decoded picture, then let the player decide when to continue.
            confirm.focus({ preventScroll: true });
        };
        if (cinema.done(key)) {
            root.querySelector<HTMLElement>('[data-story-film-host]')!.innerHTML = `<main class="cinema-screen"><section class="cinema-frame"><video playsinline muted preload="metadata" src="${esc(film.src)}"></video></section></main>`;
            const still = root.querySelector<HTMLVideoElement>('video')!;
            still.addEventListener('loadedmetadata', () => { still.currentTime = Math.max(0, still.duration - .08); });
            ready();
        }
        else cinema.mount(root.querySelector<HTMLElement>('[data-story-film-host]')!, key, [film], 'story', ready);
        return true;
    }
    return { mount };
}
