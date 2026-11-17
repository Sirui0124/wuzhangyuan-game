import { currentClueSources } from '../thought-canvas-model';
import { createPortrait } from '../../../game/view-common';
import { portraitStage } from '../../../game/portrait-stage';
import { expressionHeadingHTML, expressionPaperHTML } from '../../../game/expression-view';
import { narrativeChoiceHTML } from '../../../game/narrative-choice';
import type { ChapterSession, GameSessionState } from '../../../chapter-session';
import type { GameUIState } from '../../../game/ui-state';
import { esc, btn, type Media } from '../../../game/view-common';
import { expressionListenerTurn } from '../expression-context';
import { expressionHelp } from '../expression-help';
import { chapterOneDecision } from '../narrative-decision';

export function createStoryViews(game: ChapterSession, media: Media, ui: GameUIState,
    hud: (state: GameSessionState, light?: boolean) => string) {
    function storyHTML(state: GameSessionState) {
        if (state.phase !== 'expression') {
            return `<main class="game-scene" data-phase="${state.phase}" data-scene="${state.scene}"><div class="scene-image" style="background-image:url('${esc(media.scenes[state.scene])}')"></div><div class="scene-shade"></div>${hud(state)}${narrativeChoiceHTML(chapterOneDecision(state))}</main>`;
        }
        const composition = state.composition;
        const help = expressionHelp(state);
        const feedback = expressionListenerTurn(state, id => game.sourceRow(id));
        const waiting = composition.status === 'waiting';
        const paper = expressionPaperHTML({
            clues: game.content.clues.filter(c => state.story.collected.includes(c.id)).map(c => ({id:c.id,title:c.summary,text:currentClueSources(c.id, state.story.completed).filter(id => state.story.completed.includes(id)).map(id => game.sourceRow(id)).filter(row => !!row).map(row => `${row!.speaker}：${row!.text}`).join("\n") || c.summary})), selected: state.story.selected, evidence: '', draft: state.story.draft, maxLength: 0, ready: true,
            status: waiting ? '正在润色……' : composition.error || '',
            polishActions: waiting ? btn('cancel-generation', '取消润色') : `${btn('generate-expression', game.aiEnabled() ? '润色表达' : '整理参考句', 'polish-button', !state.story.draft.trim() && !state.story.selected.length)}${game.canRestorePreviousDraft ? btn('restore-previous-draft', '撤销润色') : ''}`,
            help: help ? `<details class="expression-help"><summary>看看怎么说</summary><p>${esc(help)}</p>${btn('use-expression-help', '采用这句')}</details>` : '',
            confirmActions: btn('speak', '确认说出', 'confirm-expression', waiting || !state.story.draft.trim() && !state.story.selected.length),
        });
        return `<main class="workspace-screen expression-workspace narrative-expression" data-phase="expression"><div class="thought-landscape" style="background-image:url('${esc(media.scenes[state.scene])}')"></div>${portraitStage(createPortrait(media)('weiyan'))}${hud(state)}<div class="workspace-layout"><section class="expression-center">${expressionHeadingHTML('魏延', feedback ? `“${feedback}”` : '')}${paper}</section></div><p id="game-notice" role="status">${esc(ui.notice || ui.storageWarning)}</p></main>`;
    }
    return { storyHTML };
}
