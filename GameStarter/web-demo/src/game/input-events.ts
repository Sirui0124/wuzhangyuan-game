
import { hasExpressionMaterial } from '../expression-contract';
import type { ChapterSession } from '../chapter-session';
import type { GameAudio, AudioBus } from '../audio';
import type { GameUIState } from './ui-state';
import { bindDialogueScreenInput } from './dialogue-screen-input';

type InputOptions = {
    root: HTMLElement; game: ChapterSession; ui: GameUIState; audio: GameAudio;
    settings: { setDetails(open: boolean): void; setRuntime(ai: boolean): void };
    persist(): void;
    render(): void;
    reviseExpression(): void;
    next(): void;
};
/** Input updates preserve IME text, draft persistence and keyboard focus semantics. */
export function bindGameInputEvents(options: InputOptions) {
    const { root, game, ui, audio, settings,
        persist, render, reviseExpression, next } = options;
    const readingAction = () => {
        if (ui.home || ui.overlay || document.querySelector('.ending-album-host')) return;
        if (root.querySelector('[data-story-film]')) {
            const confirm = root.querySelector<HTMLButtonElement>('.story-film-confirm:not([hidden]) [data-film-confirm]');
            return confirm ? () => confirm.click() : undefined;
        }
        const state = game.snapshot();
        if (state.phase === 'tent' && state.tent !== 'side' && state.tent !== 'footsteps') return () => game.tentAction('next');
        if (state.phase === 'dialogue') return next;
        if (state.phase === 'reply') return state.speech?.result === 'execute' ? next : reviseExpression;
        if (state.phase === 'spoken' && state.speech?.status === 'ready') return () => game.acknowledgeReply();
    };
    bindDialogueScreenInput(root, readingAction);
    root.addEventListener('toggle', event => { const target = event.target as HTMLDetailsElement; if (target.id === 'api-settings') settings.setDetails(target.open); }, true);
    root.addEventListener('input', event => {
        const target = event.target as HTMLInputElement;
        if (target.id === 'expression-focus') {
            root.querySelector('.expression-paper')?.classList.remove('is-revealing');
            ui.restoring = true; game.setFocus(target.value); ui.restoring = false; persist();
            const confirm = root.querySelector<HTMLButtonElement>('[data-action=confirm-focus]');
            if (confirm) confirm.disabled = !target.value.trim();
            const polish = root.querySelector<HTMLButtonElement>('[data-action=generate-expression]');
            if (polish) { polish.disabled = !hasExpressionMaterial(game.snapshot().story.selected.length, game.snapshot().story.draft.trim() || game.snapshot().composition.focus); polish.textContent = game.aiEnabled() ? '润色表达' : '整理参考句'; }
            root.querySelector('[data-action=cancel-generation]')?.remove();
            const speak = root.querySelector<HTMLButtonElement>('[data-action=speak]'); if (speak) speak.disabled = true;
            const result = root.querySelector('[data-expression-result]'); result?.classList.remove('is-ready'); result?.classList.add('is-pending');
            const status = root.querySelector('.expression-status'); if (status) status.textContent = '';
        }
        if (target.id === 'player-expression') {
            root.querySelector('.expression-paper')?.classList.remove('is-revealing');
            ui.restoring = true; game.setDraft(target.value); ui.restoring = false; persist();
            const speak = root.querySelector<HTMLButtonElement>('[data-action=speak]'); if (speak) speak.disabled = !target.value.trim();
            const result = root.querySelector('[data-expression-result]'); result?.classList.add('is-ready'); result?.classList.remove('is-pending');
            const heading = result?.querySelector('header label'); if (heading) heading.textContent = '准备说的话';
            const status = root.querySelector('.expression-status'); if (status) status.textContent = '';
            const polish = root.querySelector<HTMLButtonElement>('[data-action=generate-expression]'); if (polish) { polish.disabled = !hasExpressionMaterial(game.snapshot().story.selected.length, game.snapshot().story.draft.trim() || game.snapshot().composition.focus); polish.textContent = game.aiEnabled() ? '润色表达' : '整理参考句'; }
            root.querySelector('[data-action=cancel-generation]')?.remove();
        }
        if (target.dataset.volume) { audio.setVolume(target.dataset.volume as AudioBus, Number(target.value)); target.style.setProperty('--range', `${target.value}%`); const output = target.nextElementSibling; if (output) output.textContent = target.value + '%'; }
        if (target.id === 'game-ai-enabled') settings.setRuntime(target.checked);
    });
    document.addEventListener('keydown', event => {
        const focused = event.target as HTMLElement;
        if (event.isComposing || event.keyCode === 229) return;
        if (document.querySelector('.ending-album-host')) return;
        if (event.repeat && [' ', 'Enter'].includes(event.key) && focused.closest('.dialogue-advance,.speech-box button,[data-action=begin-thinking]')) { event.preventDefault(); return; }
        if (ui.overlay && event.key === 'Tab') {
            const focusable = Array.from(root.querySelectorAll<HTMLElement>('.game-modal button:not(:disabled),.game-modal input:not(:disabled),.game-modal summary,.game-modal textarea,.game-modal a[href]')).filter(node => node.getClientRects().length);
            const first = focusable[0], last = focusable.at(-1);
            if (event.shiftKey && focused === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && focused === last) { event.preventDefault(); first?.focus(); }
            return;
        }
        if (event.key === 'Escape') { event.preventDefault(); if (ui.overlay) { if (ui.overlay === 'settings') root.querySelector<HTMLElement>('[data-action=close-modal]')?.click(); else { ui.overlay = ''; render(); } } else if (['thoughts', 'thought-prompt'].includes(game.snapshot().phase)) game.returnToStory(); return; }
        if ((event.target as HTMLElement).matches('input,textarea,button,summary,a')) return;
        const advance = readingAction();
        if (advance && [' ', 'Enter'].includes(event.key)) {
            event.preventDefault(); if (event.repeat) return;
            advance();
        }
    });
}
