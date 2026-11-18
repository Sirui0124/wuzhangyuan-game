import type { GameUIState } from './ui-state';
import { frameModal } from '../game-ui-panels';
import { commandActionContent } from './map-action';
import { pauseAction, resumeIcon } from './pause-art';

/** Pause is a presentation layer: retain the scene, media element and playback offset. */
export function createPauseMenu(root: HTMLElement, ui: GameUIState, options: {
    render(): void; settings(): string; home(): void; suspend(): void;
    saves?(): string; restart?(): void; chapterConfirmsRestart?: boolean;
}) {
    let active = false, focus: HTMLElement | null = null;
    let playing: HTMLMediaElement[] = [];
    const background = new Map<HTMLElement, boolean>();
    function open() {
        if (active) return;
        active = true; ui.overlay = 'pause'; focus = document.activeElement as HTMLElement;
        clearInterval(ui.typeTimer);
        playing = Array.from(root.querySelectorAll<HTMLMediaElement>('video,audio')).filter(media => !media.paused && !media.ended);
        playing.forEach(media => media.pause());
        options.suspend(); options.render();
    }
    function close(resume: boolean) {
        active = false; ui.overlay = '';
        root.querySelectorAll(':scope > .game-modal-shade').forEach(node => node.remove());
        background.forEach((inert, node) => { node.inert = inert; }); background.clear();
        const media = playing; playing = [];
        if (resume) {
            options.render();
            media.filter(node => node.isConnected && !node.ended).forEach(node => { void node.play().catch(() => {}); });
            if (focus?.isConnected) focus.focus();
            else root.querySelector<HTMLElement>('[data-action=pause]')?.focus();
        }
    }
    function back() {
        if (ui.overlay !== 'pause') {
            ui.overlay = 'pause'; ui.slotOverwrite = ''; options.render();
        } else close(true);
    }
    root.addEventListener('play', event => {
        const media = event.target;
        if (active && media instanceof HTMLMediaElement) {
            if (!playing.includes(media)) playing.push(media);
            media.pause();
        }
    }, true);
    root.addEventListener('click', event => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
        const action = target?.dataset.action;
        if (action === 'pause') { event.preventDefault(); event.stopImmediatePropagation(); open(); }
        else if (active && ['resume-game', 'pause-home', 'close-modal', 'pause-save', 'pause-restart', 'pause-restart-confirm'].includes(action ?? '')) {
            event.preventDefault(); event.stopImmediatePropagation();
            if (action === 'pause-home') { close(false); options.home(); }
            else if (action === 'pause-save' && options.saves) { ui.overlay = 'save'; ui.slotOverwrite = ''; options.render(); }
            else if (action === 'pause-restart' && options.restart) {
                if (options.chapterConfirmsRestart) { close(false); options.restart(); }
                else { ui.overlay = 'restart-chapter'; options.render(); }
            }
            else if (action === 'pause-restart-confirm' && options.restart) { close(false); options.restart(); }
            else if (action === 'resume-game') close(true);
            else back();
        }
    }, true);
    document.addEventListener('keydown', event => {
        if (event.isComposing) return;
        if (active) {
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); back(); }
            else if (event.key === 'Tab') {
                const nodes = Array.from(root.querySelectorAll<HTMLElement>('.game-modal button:not(:disabled),.game-modal input:not(:disabled),.game-modal textarea:not(:disabled),.game-modal select:not(:disabled),.game-modal summary,.game-modal a[href]')).filter(node => node.getClientRects().length);
                if (!nodes.includes(document.activeElement as HTMLElement)) { event.preventDefault(); (event.shiftKey ? nodes.at(-1) : nodes[0])?.focus(); }
                else if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
                else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
                event.stopImmediatePropagation();
            }
            else if (!(event.target as HTMLElement).closest('.game-modal')) { event.preventDefault(); event.stopImmediatePropagation(); }
        } else if (event.key === 'Escape' && !ui.home && !ui.overlay && !ui.notesShown && !document.querySelector('dialog[open],.ending-album-host,:popover-open') && root.querySelector('[data-action=pause]')) {
            event.preventDefault(); event.stopImmediatePropagation(); open();
        }
    }, true);
    function render() {
        if (!active) return false;
        root.querySelectorAll(':scope > .game-modal-shade').forEach(node => node.remove());
        for (const node of Array.from(root.children)) if (node instanceof HTMLElement) {
            if (!background.has(node)) background.set(node, node.inert);
            node.inert = true;
        }
        const markup = ui.overlay === 'settings' ? frameModal('设置', options.settings(), 'settings')
            : ui.overlay === 'save' && options.saves ? frameModal('存档', options.saves(), 'saves')
            : ui.overlay === 'restart-chapter' && options.restart ? frameModal('重玩本关', '<p>从本关开头重新开始。当前进度会备份，手动存档和已解锁记录保留。</p><div class="button-row"><button class="folio-button" data-action="pause-restart-confirm">确认重玩本关</button><button class="quiet-button" data-action="close-modal">返回</button></div>', 'new')
            : frameModal('暂停', `<p class="pause-context">灯火未歇，<br>且停片刻。</p><nav class="pause-actions" aria-label="暂停菜单"><button class="map-chapter-action" data-action="resume-game">${commandActionContent('继续游戏', false, resumeIcon())}</button>${options.saves ? pauseAction('pause-save','存档') : ''}${pauseAction('settings','设置')}${options.restart ? pauseAction('pause-restart','重玩本关') : ''}${pauseAction('pause-home','返回首页')}</nav>`, 'pause');
        root.insertAdjacentHTML('beforeend', markup);
        (root.querySelector<HTMLElement>('[data-action=resume-game]') ?? root.querySelector<HTMLElement>('.game-modal button'))?.focus();
        return true;
    }
    return { render, open, dismiss: () => close(false), get active() { return active; } };
}
