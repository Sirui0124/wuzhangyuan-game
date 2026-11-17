import { createCompositionGuard } from './composition-guard';
import type { ChapterSession, GameSessionState } from '../chapter-session';
import type { GameAudio } from '../audio';
import type { CinematicPlayer, Clip } from '../cinematics';
import { esc } from './view-common';
import { createStoryFilms, type StoryFilm } from './story-films';
import { endingFilmForState, type EndingFilm } from './ending-films';
import type { GameUIState } from './ui-state';

type Views = {
    sceneHTML(state: GameSessionState): string;
    menu(): string;
    mapHTML(): string;
    endingHTML(state: GameSessionState): string;
    storyHTML(state: GameSessionState): string;
    modalHTML(state: GameSessionState): string;
};
type RendererOptions = {
    branch?: { html(): string; sync(): void };
    paused?(): boolean;
    presented?(): void;
    root: HTMLElement; game: ChapterSession; ui: GameUIState; audio: GameAudio;
    cinema: CinematicPlayer; movies: Record<string, Clip[]>; views: Views;
};
/** Owns DOM reconciliation, focus, scroll, typewriter and cinematic mounting. */
export function createGameRenderer(options: RendererOptions) {
    const { root, game, ui, audio, cinema, movies } = options;
    const { sceneHTML, menu, mapHTML, endingHTML, storyHTML, modalHTML } = options.views;
    const composition = createCompositionGuard(root, render);
    const storyFilms = createStoryFilms(root, game, cinema, (movies.chapterDialogue ?? []) as StoryFilm[], () => render());
    function renderScene(state: GameSessionState) {
        const current = root.querySelector<HTMLElement>('.game-scene');
        if (!current || current.dataset.scene !== state.scene) { root.innerHTML = sceneHTML(state); return; }
        // Keep the actual scene and portrait nodes mounted while dialogue advances.
        const template = document.createElement('template'); template.innerHTML = sceneHTML(state);
        const next = template.content.firstElementChild as HTMLElement;
        const background = current.querySelector('.scene-image'), shade = current.querySelector('.scene-shade'), previousPortrait = current.querySelector('.portrait-stage');
        const nextPortrait = next.querySelector('.portrait-stage');
        if (background) background.setAttribute('style', next.querySelector('.scene-image')?.getAttribute('style') ?? '');
        const samePortrait = previousPortrait?.querySelector('img')?.getAttribute('src') === nextPortrait?.querySelector('img')?.getAttribute('src');
        const children = Array.from(next.children).map(child => child.classList.contains('scene-image') && background ? background : child.classList.contains('scene-shade') && shade ? shade : child === nextPortrait && samePortrait && previousPortrait ? previousPortrait : child);
        current.dataset.phase = state.phase; current.replaceChildren(...children);
    }
    function render() {
        if (composition.defer()) return;
        try { renderContent(); } finally { options.presented?.(); }
    }
    function renderContent() {
        options.branch?.sync();
        if (options.paused?.()) return;
        // The composition guard above keeps asynchronous updates out of a live IME session.
        const state = game.snapshot(); clearInterval(ui.typeTimer);
        const endingFilms = (movies.chapterEndings ?? []) as EndingFilm[];
        const endingKey = (film: EndingFilm) => `ending:${state.story.run}:${state.round}:${film.id}${film.still ? ':still' : ''}`;
        if (!['death', 'ending'].includes(state.phase)) {
            for (const film of endingFilms.filter(film => film.ending.endsWith('-execution'))) cinema.forget(endingKey(film));
        }
        const endingFilm = endingFilmForState(endingFilms, state);
        const previousPhase = root.querySelector<HTMLElement>('main[data-phase]')?.dataset.phase;
        const dialogueFocused = document.activeElement?.matches('.dialogue-advance');
        const active = document.activeElement as HTMLElement | null;
        const speechFocus = active?.closest('.speech-box') ? active.dataset.action : undefined;
        const focusAttribute = active?.closest('.workspace-screen') ? ['data-action'].find(name => active.hasAttribute(name)) : undefined;
        const workspaceFocus = active?.closest('.workspace-screen') ? active.id ? `#${CSS.escape(active.id)}` : focusAttribute ? `[${focusAttribute}="${CSS.escape(active.getAttribute(focusAttribute)!)}"]` : '' : '';
        const caret = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] : null;
        // Scene nodes stay mounted between lines, but their modal sibling must be replaced too.
        root.querySelectorAll(':scope > .game-modal-shade').forEach(node => node.remove());
        const previousScroll = root.querySelector<HTMLElement>('.workspace-layout')?.scrollTop ?? 0;
        document.documentElement.dataset.reduced = String(ui.reduced);
        const storyMode = ['thought-prompt', 'thoughts', 'expression'].includes(state.phase) && !ui.home;
        if (ui.home) { cinema.dispose(); ui.filmKey = ''; audio.setMusicPaused(false); audio.setMusic('home'); root.innerHTML = ui.menuMap ? mapHTML() : menu(); }
        else if (ui.previewFilm || state.phase === 'cinematic') {
            const cinematic = game.currentCinematic(), clips = ui.previewFilm ? (ui.previewFilm === 'prologue' ? movies.prologue ?? [] : ui.previewFilm === 'grain' ? movies.chapterPreview ?? [] : (movies.chapterScenes ?? []).filter(clip => clip.id === ui.previewFilm)) : (movies[cinematic!.group] ?? []).filter(clip => !cinematic!.clipIds || cinematic!.clipIds.includes(clip.id));
            const key = ui.previewFilm ? `chapter-preview:${ui.previewFilm}` : `${state.story.run}:${cinematic!.id}`;
            audio.setMusicPaused(true);
            if (ui.filmKey !== key || !root.querySelector('video')) {
                ui.filmKey = key; root.innerHTML = '<div id="film-host"></div>';
                cinema.mount(root.querySelector('#film-host')!, key, clips, ui.previewFilm ? 'chapterPreview' : cinematic!.group, () => { ui.filmKey = ''; if (ui.previewFilm) { ui.previewFilm = ''; ui.home = true; ui.menuMap = true; ui.overlay = ''; render(); } else game.finishCinematic(); });
            }
            return;
        } else if (state.phase==='branch' && options.branch) {
            cinema.dispose();ui.filmKey='';audio.setMusicPaused(false);audio.setMusic('round1');
            root.innerHTML=options.branch.html();
        } else if (endingFilm && !cinema.done(endingKey(endingFilm))) {
            const key = endingKey(endingFilm);
            audio.setMusicPaused(true);
            if (ui.filmKey !== key || !root.querySelector(endingFilm.still ? '.ending-still' : 'video')) {
                ui.filmKey = key; root.innerHTML = '<div id="film-host"></div>';
                const host = root.querySelector<HTMLElement>('#film-host')!;
                const finish = () => { ui.filmKey = ''; render(); };
                if (endingFilm.still) cinema.mountStill(host, key, endingFilm.still, finish);
                else cinema.mount(host, key, [endingFilm], 'ending', finish);
            }
            return;
        } else if (storyFilms.mount(state)) {
            // An already completed film may synchronously render the next scene on restore.
            if (root.querySelector('[data-story-film]')) audio.setMusicPaused(true);
            ui.filmKey = '';
            return;
        } else {
            cinema.dispose(); ui.filmKey = ''; audio.setMusicPaused(state.end === 'weiyan-execution'); audio.setMusic(['expression', 'spoken', 'reply'].includes(state.phase) ? 'weiyan' : state.round === 1 ? 'round1' : 'round2');
            if (state.phase === 'death' || state.phase === 'ending') {
                root.innerHTML = endingHTML(state);
                if (endingFilm && cinema.done(endingKey(endingFilm))) {
                    root.querySelector('.execution-transition')?.remove();
                    root.querySelector('.chapter-ending')?.setAttribute('data-film-complete', 'true');
                }
            }
            else if (state.phase === 'map') root.innerHTML = mapHTML();
            else if (storyMode) root.innerHTML = storyHTML(state);
            else renderScene(state);
        }
        if (ui.overlay) root.insertAdjacentHTML('beforeend', modalHTML(state));
        if (ui.home && ui.storageWarning) root.querySelector('main')?.insertAdjacentHTML('beforeend', `<p class="menu-warning" role="status">${esc(ui.storageWarning)}</p>`);
        const workspace = root.querySelector<HTMLElement>('.workspace-layout');
        if (workspace && state.phase === previousPhase) workspace.scrollTop = previousScroll;
        const row = state.phase === 'reply' ? game.currentReply() : game.row(), target = root.querySelector<HTMLElement>('#spoken-line');
        if (row && target) {
            const lineId = `${state.story.run}:${state.phase}:${row.id}:${state.phase === 'reply' ? state.story.history.length : ''}:${row.text}`;
            if (ui.currentLineId !== lineId) { ui.currentLineId = lineId; ui.typeIndex = 0; ui.typed = ui.reduced; ui.lineText = row.text; }
            if (!ui.typed) {
                target.textContent = ui.lineText.slice(0, ui.typeIndex);
                ui.typeTimer = window.setInterval(() => { ui.typeIndex += 2; target.textContent = ui.lineText.slice(0, ui.typeIndex); if (ui.typeIndex >= ui.lineText.length) { ui.typed = true; clearInterval(ui.typeTimer); } }, 28);
            }
        }
        if (ui.overlay) {
            root.querySelector<HTMLElement>('.game-modal button')?.focus({ preventScroll: true });
        }
        else if (state.phase === 'thought-prompt') root.querySelector<HTMLElement>('[data-action=continue-story]')?.focus({ preventScroll: true });
        else if (dialogueFocused || state.phase === 'reply' || (state.phase === 'dialogue' && previousPhase === 'spoken')) root.querySelector<HTMLElement>('.dialogue-advance')?.focus({ preventScroll: true });
        else if (state.phase === 'spoken') {
            const saved = speechFocus ? root.querySelector<HTMLElement>(`.speech-box [data-action="${speechFocus}"]`) : null;
            (saved ?? root.querySelector<HTMLElement>('.speech-box button') ?? root.querySelector<HTMLElement>('.speech-box'))?.focus({ preventScroll: true });
        }
        else if (storyMode && workspaceFocus) {
            const replacement = root.querySelector<HTMLElement>(workspaceFocus);
            replacement?.focus({ preventScroll: true });
            if ((replacement instanceof HTMLTextAreaElement || replacement instanceof HTMLInputElement) && caret && caret[0] !== null && caret[1] !== null) replacement.setSelectionRange(caret[0], caret[1]);
        }
        for (const image of Array.from(root.querySelectorAll<HTMLImageElement>('.character-art'))) {
            if (image.complete && image.naturalWidth) image.classList.add('is-ready');
            else image.addEventListener('load', () => image.classList.add('is-ready'), { once: true });
        }
    }
    function revealDialogue(): boolean {
        const target = root.querySelector('#spoken-line');
        if (ui.typed || !target) return false;
        ui.typed = true; clearInterval(ui.typeTimer); target.textContent = ui.lineText; return true;
    }
    return { render, revealDialogue };
}
