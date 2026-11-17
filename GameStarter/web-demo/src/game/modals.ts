import { chapterOnwardHTML } from './chapter-onward';
import type { ChapterFlow } from '../../../../content/schema/chapter-session';
import { GAME_SAVE_KEY, type ChapterSession, type GameSessionState } from '../chapter-session';
import { savePanelHTML, recordsPanelHTML, newGamePanelHTML, frameModal, type SaveSlotProps } from '../game-ui-panels';
import { esc, personName, type Media } from './view-common';
import type { GameUIState } from './ui-state';

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
        if (ui.overlay === 'onward') return chapterOnwardHTML('wuzhang', state.end ?? '');
        if (ui.overlay === 'settings') return frameModal('设置', settingsHTML(), 'settings');
        if (ui.overlay === 'save') return frameModal('存档', saveHTML(), 'saves');
        if (ui.overlay === 'records') {
            if(game.branch) return frameModal('历史对白',recordsPanelHTML([...game.branch.dialogue.trail.flatMap(f=>f.lines),...game.branch.dialogue.frame.lines.slice(0,game.branch.line+1)].filter(l=>l.speaker!=='演出').map(l=>({speaker:personName(l.speaker),text:l.text}))), 'history');
            const records = state.story.completed.flatMap(id => { const row = game.recordedRow(id); return row ? [{ speaker: personName(row.speaker), text: row.text }] : []; });
            records.push(...state.story.history.flatMap(item => [{ speaker: '我', text: item.text }, ...(item.feedback ? [{ speaker: '魏延', text: item.feedback }] : [])]));
            return frameModal('历史对白', recordsPanelHTML(records), 'history');
        }
        return frameModal('重新开始', newGamePanelHTML(), 'new');
    }
    return { modalHTML, saveHTML };
}
