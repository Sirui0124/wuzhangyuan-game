import type { GameUIState } from './ui-state';
import { frameModal } from '../game-ui-panels';
import { commandActionContent } from './map-action';
import { pauseAction, resumeIcon } from './pause-art';
import { lockedPersonalityView, personalityHTML, personalityMenuAction, personalityModalHTML, personalityShareText, type PersonalityCopyState } from '../personality/view';
import type { PersonalityViewModel } from '../personality/types';

/** Pause is a presentation layer: retain the scene, media element and playback offset. */
export function createPauseMenu(root: HTMLElement, ui: GameUIState, options: {
    render(): void; settings(): string; home(): void; suspend(): void;
    saves?(): string; restart?(): void;
    personality?: { getView(): PersonalityViewModel; subscribe?(listener: () => void): () => void };
}) {
    let active = false, focus: HTMLElement | null = null;
    let copyState: PersonalityCopyState = 'idle', copying = false, personalityMarkup = '';
    let playing: HTMLMediaElement[] = [];
    const background = new Map<HTMLElement, boolean>();
    if (!document.querySelector('link[data-personality-style]')) {
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet'; stylesheet.href = '/personality.css'; stylesheet.dataset.personalityStyle = '';
        document.head.append(stylesheet);
    }
    const personalityView = () => options.personality?.getView() ?? lockedPersonalityView();
    function refreshPersonality() {
        const body = root.querySelector<HTMLElement>('[data-personality-content]');
        if (!active || ui.overlay !== 'personality' || !body) return;
        const markup = personalityHTML(personalityView(), copyState);
        if (markup === personalityMarkup) return;
        const scroll = body.scrollTop, selected = document.activeElement as HTMLElement | null;
        const hadFocus = body.contains(selected);
        const action = body.contains(selected) ? selected?.dataset.action : undefined;
        const detail = body.contains(selected) ? selected?.closest<HTMLElement>('[data-personality-detail]')?.dataset.personalityDetail : undefined;
        const copyFocused = body.contains(selected) && selected?.hasAttribute('data-personality-copy-text');
        const expanded = new Set(Array.from(body.querySelectorAll<HTMLDetailsElement>('details[open]')).map(node => node.dataset.personalityDetail));
        body.innerHTML = markup; personalityMarkup = markup;
        body.querySelectorAll<HTMLDetailsElement>('details').forEach(node => { node.open = expanded.has(node.dataset.personalityDetail); });
        const restored = action ? body.querySelector<HTMLElement>(`[data-action="${CSS.escape(action)}"]`)
            : copyFocused ? body.querySelector<HTMLElement>('[data-personality-copy-text]')
            : detail ? body.querySelector<HTMLElement>(`[data-personality-detail="${CSS.escape(detail)}"] summary`) : null;
        if (restored) restored.focus({ preventScroll: true });
        else if (hadFocus) root.querySelector<HTMLElement>('.personality-panel .modal-close')?.focus({ preventScroll: true });
        body.scrollTop = scroll;
    }
    const unsubscribe = options.personality?.subscribe?.(refreshPersonality);
    window.addEventListener('pagehide', () => unsubscribe?.(), { once: true });
    async function copyPersonality() {
        if (copying) return;
        const text = personalityShareText(personalityView());
        if (!text) return;
        copying = true;
        try { await navigator.clipboard.writeText(text); copyState = 'copied'; }
        catch { copyState = 'manual'; }
        finally { copying = false; }
        refreshPersonality();
        if (active && ui.overlay === 'personality' && copyState === 'manual') {
            const field = root.querySelector<HTMLTextAreaElement>('[data-personality-copy-text]');
            field?.focus(); field?.select();
        }
    }
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
            const fromPersonality = ui.overlay === 'personality';
            ui.overlay = 'pause'; ui.slotOverwrite = ''; options.render();
            if (fromPersonality) root.querySelector<HTMLElement>('[data-action=pause-personality]')?.focus();
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
        else if (active && ['resume-game', 'pause-home', 'close-modal', 'pause-save', 'pause-restart', 'pause-restart-confirm', 'pause-personality', 'personality-copy'].includes(action ?? '')) {
            event.preventDefault(); event.stopImmediatePropagation();
            if (action === 'pause-home') { close(false); options.home(); }
            else if (action === 'pause-personality') { ui.overlay = 'personality'; copyState = 'idle'; personalityMarkup = ''; options.render(); }
            else if (action === 'personality-copy' && ui.overlay === 'personality') { void copyPersonality(); }
            else if (action === 'pause-save' && options.saves) { ui.overlay = 'save'; ui.slotOverwrite = ''; options.render(); }
            else if (action === 'pause-restart' && options.restart) { ui.overlay = 'restart-chapter'; options.render(); }
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
        } else if (event.key === 'Escape' && !ui.home && !ui.overlay && !ui.notesShown && !document.querySelector('dialog[open],.ending-album-host') && root.querySelector('[data-action=pause]')) {
            event.preventDefault(); event.stopImmediatePropagation(); open();
        }
    }, true);
    function render() {
        if (!active) return false;
        if (ui.overlay === 'personality' && root.querySelector('[data-personality-content]')) { refreshPersonality(); return true; }
        root.querySelectorAll(':scope > .game-modal-shade').forEach(node => node.remove());
        for (const node of Array.from(root.children)) if (node instanceof HTMLElement) {
            if (!background.has(node)) background.set(node, node.inert);
            node.inert = true;
        }
        const markup = ui.overlay === 'personality' ? personalityModalHTML(personalityView(), copyState)
            : ui.overlay === 'settings' ? frameModal('设置', options.settings(), 'settings')
            : ui.overlay === 'save' && options.saves ? frameModal('存档', options.saves(), 'saves')
            : ui.overlay === 'restart-chapter' && options.restart ? frameModal('重玩本关', '<p>从本关开头重新开始。当前进度会备份，手动存档和已解锁记录保留。</p><div class="button-row"><button class="folio-button" data-action="pause-restart-confirm">确认重玩本关</button><button class="quiet-button" data-action="close-modal">返回</button></div>', 'new')
            : frameModal('暂停', `<p class="pause-context">灯火未歇，<br>且停片刻。</p><nav class="pause-actions" aria-label="暂停菜单"><button class="map-chapter-action" data-action="resume-game">${commandActionContent('继续游戏', false, resumeIcon())}</button>${personalityMenuAction()}${options.saves ? pauseAction('pause-save','存档') : ''}${pauseAction('settings','设置')}${options.restart ? pauseAction('pause-restart','重玩本关') : ''}${pauseAction('pause-home','返回首页')}</nav>`, 'pause');
        root.insertAdjacentHTML('beforeend', markup);
        if (ui.overlay === 'personality') {
            personalityMarkup = personalityHTML(personalityView(), copyState);
            root.querySelector<HTMLElement>('.personality-panel .modal-close')?.focus({ preventScroll: true });
        } else (root.querySelector<HTMLElement>('[data-action=resume-game]') ?? root.querySelector<HTMLElement>('.game-modal button'))?.focus();
        return true;
    }
    return { render, open, dismiss: () => close(false), get active() { return active; } };
}
