import { GameApi } from '../../../assets/scripts/GameApi';
import { GameAudio, type AudioBus } from '../audio';
import { createPauseMenu } from './pause-menu';
import { createSettingsController } from './settings';
import { createGameUIState } from './ui-state';
import { savePanelHTML } from '../game-ui-panels';
import { esc } from './view-common';
import { readRuntimeMode, saveRuntimeMode, setRuntimeConnection } from '../runtime-mode';
import { readAiVoiceEnabled, saveAiVoiceEnabled } from '../voice-preference';
import { YILING_CAMPAIGN_KEY as SAVE } from '../campaign/yiling-result';

type Slot = { version: 1; id: string; round: number; phase: string; savedAt: number; drafts: string | null };
const slotKey = (index: string) => `${SAVE}:manual:${index}`;

/** Shared presentation and manual slots; rescue rules and private state stay in its engine. */
export function createRescueShell(root: HTMLElement, frame: HTMLIFrameElement) {
    const ui = createGameUIState(); ui.home = false;
    const audio = new GameAudio();
    let busy = false, notice = '';
    const render = () => { pause.render(); if (busy) root.querySelectorAll<HTMLButtonElement>('.game-modal button').forEach(button => button.disabled = true); };
    const settings = createSettingsController(root, new GameApi(), audio, ui, render,
        { isEnabled: readAiVoiceEnabled, setEnabled: saveAiVoiceEnabled },
        { get: readRuntimeMode, set: saveRuntimeMode, connected: setRuntimeConnection });
    function readSlot(index: string): Slot | null {
        const raw = localStorage.getItem(slotKey(index));
        if (!raw) return null;
        const slot = JSON.parse(raw) as Slot;
        if (slot.version !== 1 || !/^[0-9a-f-]{36}$/.test(slot.id)) throw new Error('此存档格式无法读取，原始记录已保留。');
        return slot;
    }
    function saves() {
        return `<p role="status">${esc(notice || '营救进度自动保存在本机。手动存档可回到保存时的兵力、情报与军令。')}</p>` + savePanelHTML([1, 2, 3].map(index => {
            const key = String(index);
            try {
                const slot = readSlot(key);
                return { key: slotKey(key), manualIndex: index, exists: !!slot, chapterTitle: '第四章 · 夷陵',
                    sceneTitle: slot ? `第 ${slot.round} 轮 · ${slot.phase === 'orders' ? '调度下令' : slot.phase === 'results' ? '军报送达' : '营救结束'}` : '',
                    savedAt: slot?.savedAt, overwrite: ui.slotOverwrite === key };
            } catch {
                return { key: slotKey(key), manualIndex: index, exists: true, summary: '无法读取；原始记录保留', overwrite: ui.slotOverwrite === key };
            }
        }), { canStore: !!localStorage.getItem(SAVE) });
    }
    // A save transaction cannot be interrupted by closing the menu or changing chapters.
    root.addEventListener('click', event => { if (busy) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
    document.addEventListener('keydown', event => { if (busy) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
    const pause = createPauseMenu(root, ui, { render, settings: settings.settingsHTML, saves,
        home: () => location.assign('/'), suspend: () => {},
        restart: () => frame.contentWindow?.postMessage({ type: 'wzy-rescue-restart-confirmed' }, location.origin) });

    async function transact(index: string, restore: boolean) {
        if (busy || !['1', '2', '3'].includes(index)) return;
        const original = localStorage.getItem(slotKey(index));
        if (!restore && original && ui.slotOverwrite !== index) { ui.slotOverwrite = index; render(); return; }
        busy = true; notice = restore ? '正在读取存档……' : '正在保存……'; render();
        try {
            const session = localStorage.getItem(SAVE);
            if (!session) throw new Error('请先进入营地，再保存或读取进度。');
            const current = await fetch('/api/yiling-rescue/state?session=' + encodeURIComponent(session), { cache: 'no-store' });
            if (!current.ok) throw new Error('当前营救记录暂时无法读取，进度未改动。');
            const { state } = await current.json();
            const slot = restore ? readSlot(index) : null;
            if (restore && !slot) throw new Error('此位置没有存档。');
            if (localStorage.getItem(SAVE) !== session) throw new Error('另一页面已更换进度，请刷新后重试。');
            const drafts = localStorage.getItem(`${SAVE}:drafts:${session}`);
            const response = await fetch('/api/yiling-rescue/' + (restore ? 'restore' : 'checkpoint'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session, revision: state.revision, checkpoint: slot?.id }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '存档操作未完成。');
            if (localStorage.getItem(SAVE) !== session || localStorage.getItem(slotKey(index)) !== original) throw new Error('另一页面已修改记录，本次操作没有覆盖新进度。');
            if (restore && slot) {
                const id = result.state.id as string;
                localStorage.setItem(`${SAVE}:before-new`, session);
                if (slot.drafts) localStorage.setItem(`${SAVE}:drafts:${id}`, slot.drafts);
                localStorage.setItem(SAVE, id);
                pause.dismiss(); frame.src = frame.src;
            } else {
                localStorage.setItem(slotKey(index), JSON.stringify({ version: 1, ...result.checkpoint, savedAt: Date.now(), drafts } satisfies Slot));
                notice = '进度已保存。'; ui.slotOverwrite = '';
            }
        } catch (error) { notice = error instanceof Error ? error.message : '存档操作未完成，原进度保留。'; }
        finally { busy = false; render(); }
    }
    root.addEventListener('click', event => {
        const button = (event.target as Element).closest<HTMLElement>('button');
        if (!button) return;
        if (button.dataset.storeSlot) void transact(button.dataset.storeSlot, false);
        else if (button.dataset.loadSlot) void transact(button.dataset.loadSlot, true);
        else if (button.dataset.action === 'settings') settings.openSettings();
        else if (['save-api', 'test-api'].includes(button.dataset.action ?? '')) void settings.saveApiSettings(button.dataset.action === 'test-api');
    });
    root.addEventListener('input', event => {
        const input = event.target as HTMLInputElement;
        if (input.dataset.volume) { audio.setVolume(input.dataset.volume as AudioBus, Number(input.value)); if (input.nextElementSibling) input.nextElementSibling.textContent = input.value + '%'; }
        if (input.id === 'ai-voice-enabled') settings.setVoiceEnabled(input.checked);
        if (input.id === 'game-ai-enabled') settings.setRuntime(input.checked);
    });
    root.addEventListener('toggle', event => { if ((event.target as HTMLElement).id === 'api-settings') settings.setDetails((event.target as HTMLDetailsElement).open); }, true);
    return { open: () => { notice = ''; pause.open(); } };
}
