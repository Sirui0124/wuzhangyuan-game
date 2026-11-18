import { GameApi } from '../../../assets/scripts/GameApi';
import { GameAudio, type AudioBus } from '../audio';
import { createPauseMenu } from './pause-menu';
import { createSettingsController } from './settings';
import { createGameUIState } from './ui-state';
import { savePanelHTML } from '../game-ui-panels';
import { esc } from './view-common';
import { readRuntimeMode, saveRuntimeMode, setRuntimeConnection } from '../runtime-mode';
import { commandId, loadCommand, isCurrentCommand, YILING_CAMPAIGN_KEY as SAVE } from '../campaign/yiling-result';

type Slot = { version: 1; id: string; round: number; ended: boolean; savedAt: number; scenarioId: string; drafts: Record<string, string>; visitedFronts?: string[] };
const slotKey = (index: string) => `${SAVE}:manual:${index}`;

/** Shared presentation and manual slots; rescue rules and private state stay in its engine. */
export function createRescueShell(root: HTMLElement, frame: HTMLIFrameElement) {
    const ui = createGameUIState(); ui.home = false;
    const audio = new GameAudio();
    let busy = false, notice = '';
    const render = () => { pause.render(); if (busy) root.querySelectorAll<HTMLButtonElement>('.game-modal button').forEach(button => button.disabled = true); };
    const settings = createSettingsController(root, new GameApi(), audio, ui, render,

        { get: readRuntimeMode, set: saveRuntimeMode, connected: setRuntimeConnection });
    function readSlot(index: string): Slot | null {
        const raw = localStorage.getItem(slotKey(index));
        if (!raw) return null;
        const slot = JSON.parse(raw) as Slot;
        const uuid = /^[0-9a-f-]{36}$/i;
        if (!slot || slot.version !== 1 || !uuid.test(slot.id) || !uuid.test(slot.scenarioId)
            || !Number.isInteger(slot.round) || slot.round < 1 || slot.round > 8 || typeof slot.ended !== 'boolean'
            || !slot.drafts || typeof slot.drafts !== 'object' || Array.isArray(slot.drafts)
            || Object.entries(slot.drafts).some(([key, value]) => !key.startsWith(slot.scenarioId + '-') || typeof value !== 'string'))
            throw new Error('此存档格式无法读取，原始记录已保留。');
        return slot;
    }
    function saves() {
        return `<p role="status">${esc(notice || '营救进度自动保存在本机。手动存档可回到保存时的兵力、情报与军令。')}</p>` + savePanelHTML([1, 2, 3].map(index => {
            const key = String(index);
            try {
                const slot = readSlot(key);
                return { key: slotKey(key), manualIndex: index, exists: !!slot, chapterTitle: '第四章 · 夷陵',
                    sceneTitle: slot ? `第 ${slot.round} 轮 · ${slot.ended ? '营救结束' : '调度下令'}` : '',
                    savedAt: slot?.savedAt, overwrite: ui.slotOverwrite === key };
            } catch {
                return { key: slotKey(key), manualIndex: index, exists: true, summary: '无法读取；原始记录保留', overwrite: ui.slotOverwrite === key };
            }
        }), { canStore: !!commandId(localStorage) });
    }
    // A save transaction cannot be interrupted by closing the menu or changing chapters.
    root.addEventListener('click', event => { if (busy) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
    document.addEventListener('keydown', event => { if (busy) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
    const pause = createPauseMenu(root, ui, { render, settings: settings.settingsHTML, saves,
        home: () => location.assign('/'), suspend: () => {},
        chapterConfirmsRestart: true, restart: () => frame.contentWindow?.postMessage({ type: 'wzy-shared-restart' }, location.origin) });

    async function transact(index: string, restore: boolean) {
        if (busy || !['1', '2', '3'].includes(index)) return;
        const original = localStorage.getItem(slotKey(index));
        if (!restore && original && ui.slotOverwrite !== index) { ui.slotOverwrite = index; render(); return; }
        busy = true; notice = restore ? '正在读取存档……' : '正在保存……'; render();
        try {
            const id = commandId(localStorage);
            if (!id) throw new Error('军图尚未打开。');
            const state = await loadCommand(id);
            if (!isCurrentCommand(state, id)) throw new Error('当前营救进度无法核实。');
            const slot = restore ? readSlot(index) : null;
            if (restore && !slot) throw new Error('此位置没有存档。');
            if (commandId(localStorage) !== id) throw new Error('另一页面已更换进度，请刷新后重试。');
            if (localStorage.getItem('yiling-shared-pending-' + id)) throw new Error('上一道军令的回执尚未核实，请先回到军图重试。');
            const view = JSON.parse(localStorage.getItem(SAVE + '-ui') ?? '{}');
            const drafts = Object.fromEntries(Object.entries(view.drafts ?? {}).filter(([key]) => key.startsWith(id + '-')));
            const response = await fetch('/api/yiling-command/' + (restore ? 'restore' : 'checkpoint'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenarioId: id, expectedRevision: state.revision, checkpointId: slot?.id, requestId: crypto.randomUUID() }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || '存档操作未完成。');
            if (commandId(localStorage) !== id || localStorage.getItem(slotKey(index)) !== original) throw new Error('另一页面已修改记录，请重新读取。');
            if (restore && slot) {
                const restored = result.session;
                if (!isCurrentCommand(restored, restored?.scenarioId)) throw new Error('存档回执不完整。');
                const pointer = JSON.parse(localStorage.getItem(SAVE)!);
                const history = [...new Set([...(pointer.history || []), id, restored.scenarioId])];
                const currentView = JSON.parse(localStorage.getItem(SAVE + '-ui') ?? '{}');
                for (const [key, value] of Object.entries(slot.drafts)) {
                    (currentView.drafts ??= {})[restored.scenarioId + key.slice(slot.scenarioId.length)] = value;
                }
                if (Object.keys(slot.drafts).length) localStorage.setItem(SAVE + '-ui', JSON.stringify(currentView));
                if (Array.isArray(slot.visitedFronts)) {
                    for (const front of slot.visitedFronts) {
                        if (Object.hasOwn(restored.fronts, front)) localStorage.setItem(`${SAVE}-visited-${restored.scenarioId}-${front}`, 'true');
                    }
                }
                localStorage.setItem(SAVE + ':before-new', id);
                localStorage.setItem(SAVE, JSON.stringify({ id: restored.scenarioId, history }));
                pause.dismiss(); frame.src = frame.src;
            } else {
                const checkpoint = result.checkpoint;
                if (!checkpoint || checkpoint.scenarioId !== id || checkpoint.revision !== state.revision) throw new Error('存档回执不完整。');
                localStorage.setItem(slotKey(index), JSON.stringify({
                    version: 1, id: checkpoint.id, scenarioId: id, round: Math.min(state.round + (state.ended ? 0 : 1), 8),
                    ended: state.ended, savedAt: Date.now(), drafts,
                    visitedFronts: Object.keys(state.fronts).filter(front => localStorage.getItem(`${SAVE}-visited-${id}-${front}`) === 'true'),
                }));
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
        if (input.id === 'game-ai-enabled') settings.setRuntime(input.checked);
    });
    root.addEventListener('toggle', event => { if ((event.target as HTMLElement).id === 'api-settings') settings.setDetails((event.target as HTMLDetailsElement).open); }, true);
    return { open: () => { notice = ''; pause.open(); } };
}
