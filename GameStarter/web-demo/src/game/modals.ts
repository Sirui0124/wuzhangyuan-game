import { chapterOnwardHTML } from './chapter-onward';
import { bagHTML } from '../inventory/view';
import { worldItem } from '../inventory/world-items';
import type { ChapterFlow } from '../../../../content/schema/chapter-session';
import { GAME_SAVE_KEY, type ChapterSession, type GameSessionState } from '../chapter-session';
import { savePanelHTML, recordsPanelHTML, newGamePanelHTML, frameModal, type SaveSlotProps } from '../game-ui-panels';
import { esc, personName, type Media } from './view-common';
import type { GameUIState } from './ui-state';
import { suppliesHTML, phoneComposerHTML } from '../chapters/chapter-one/views/supplies';
import { supplyById, balance, money } from '../chapters/chapter-one/supplies';

export function createGameModals(game: ChapterSession, flow: ChapterFlow, media: Media, ui: GameUIState,
    stored: (key?: string) => string | null, slotKey: (slot: string) => string, settingsHTML: () => string, saveKey = GAME_SAVE_KEY) {
    function saveHTML() {
        const slot = (key: string, manualIndex?: string): SaveSlotProps => {
            const raw = stored(key);
            const base: SaveSlotProps = { key, manualIndex, exists: !!raw, overwrite: !!manualIndex && ui.slotOverwrite === manualIndex };
            if (!raw) return base;
            try {
                const value = JSON.parse(raw) as Partial<GameSessionState> | null;
                const scene = flow.scenes.find(candidate => candidate.id === value?.scene);
                if (!value || !scene || ![1, 2].includes(value.round ?? 0)) return { ...base, summary: '此记录暂不兼容，原文件保留' };
                return { ...base, round: value.round, sceneTitle: scene.title, sceneImage: media.scenes[scene.id], savedAt: value.savedAt };
            } catch { return { ...base, summary: '此记录暂不兼容，原文件保留' }; }
        };
        return savePanelHTML([slot(saveKey), slot(slotKey('1'), '1'), slot(slotKey('2'), '2')], { canStore: !ui.home })
            + (ui.storageWarning || ui.notice ? `<p role="status">${esc(ui.storageWarning || ui.notice)}</p>` : '');
    }
    function modalHTML(state: GameSessionState) {
        if (ui.overlay === 'supplies' && game.canPrepareSupplies()) return `<div class="game-modal-shade phone-shade"><section class="game-modal phone-panel" data-page="supplies" role="dialog" aria-modal="true" aria-labelledby="game-panel-title">
          <header class="phone-header"><span class="phone-assistant-mark" aria-hidden="true">伴</span><h1 id="game-panel-title">我的系统</h1><div class="phone-wallet" aria-label="可用资金"><strong>¥${money(balance(state.supplies))}</strong></div><button data-action="close-modal" aria-label="收起手机">×</button></header>
          <div class="phone-content">${suppliesHTML(game, state, ui.shopping)}</div>
          ${phoneComposerHTML(game, ui.shopping)}
          </section></div>`;
        if (ui.overlay === 'onward') return chapterOnwardHTML('wuzhang', state.end ?? '');
        if (ui.overlay === 'items') return frameModal('物品栏', bagHTML(state.supplies), 'items');
        if (ui.overlay === 'settings') return frameModal('设置', settingsHTML(), 'settings');
        if (ui.overlay === 'save') return frameModal('存档', saveHTML(), 'saves');
        if (ui.overlay === 'records') {
            const records = state.story.completed.flatMap(id => { const row = game.recordedRow(id); return row ? [{ speaker: personName(row.speaker), text: row.text }] : []; });
            records.push(...state.story.history.flatMap(item => [{ speaker: '我', text: item.text + (item.items?.length ? `（出示：${item.items.map(id => supplyById(id, state.supplies)!.name).join('、')}）` : '') }, ...(item.feedback ? [{ speaker: '魏延', text: item.feedback }] : [])]));
            records.push(...(state.supplies.worldItems?.acquired ?? []).map(id => ({ speaker: '获得物品', text: worldItem(id)!.receipt })));
            return frameModal('历史对白', recordsPanelHTML(records), 'history');
        }
        return frameModal('重新开始', newGamePanelHTML(), 'new');
    }
    return { modalHTML, saveHTML };
}
