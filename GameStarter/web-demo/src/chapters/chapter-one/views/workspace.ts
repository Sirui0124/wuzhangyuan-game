import { expressionHeadingHTML, expressionPaperHTML } from '../../../game/expression-view';
import { hasExpressionMaterial } from '../../../expression-contract';
import type { ChapterSession, GameSessionState } from '../../../chapter-session';
import type { GameUIState } from '../../../game/ui-state';
import { esc, btn, personName, type Media } from '../../../game/view-common';
import { currentClueSources, clueSources, inferenceRules, type ChapterReview } from '../../../thought-canvas-model';
import { thoughtLabels as shortLabels } from '../../../thought-workspace';
import { inventoryHTML, reasoningHTML, workspaceModesHTML, thoughtRevealDuration, type ThoughtView } from '../../../thought-workspace-view';
import { expressionListenerTurn } from '../expression-context';
import { expressionHelp } from '../expression-help';
import { supplyById } from '../supplies';
import { attachedItemsHTML, itemInventoryHTML, itemPreviewHTML } from './supplies';

export function createWorkspaceViews(game: ChapterSession, script: ChapterReview, media: Media, ui: GameUIState,
    label: (id: string) => string, hud: (state: GameSessionState, light?: boolean) => string) {
    function sourceHTML(id: string, state: GameSessionState) {
        if (id.startsWith('item:')) { const item = supplyById(id.slice(5), state.supplies); return item && state.supplies.purchases.includes(item.id) ? itemPreviewHTML(item, (state.supplies.consumed ?? []).includes(item.id)) : ''; }
        const inferred = inferenceRules.find(rule => rule.id === id), result = game.graph()[id];
        if (inferred) return `<p>${esc(result?.full ?? inferred.full)}</p>${result?.supplements.map(text => `<p>${esc(text)}</p>`).join('') ?? ''}<div class="source-links">${(result?.evidence ?? []).map(source => `<button data-read-note="${source}">${esc(shortLabels[source] ?? label(source))} ↗</button>`).join('')}</div>${!result ? '<small>待重组：原来的支持联系已断开，当前不能用作有效依据。</small>' : '<small>这是有依据的理解，仍保留它的推测性质。</small>'}`;
        // Design boundaries remain available to the AI; source details show only acquired dialogue.
        return currentClueSources(id, state.story.completed).map(row => { const source = game.sourceRow(row)!; return `<blockquote>${esc(personName(source.speaker))}：${esc(source.text)}</blockquote>`; }).join('');
    }
    function thoughtView(state = game.snapshot()): ThoughtView {
        return { inventoryOpen: ui.notesShown, detail: ui.noteOpen, revealAt: ui.revealAt, reduced: ui.reduced, source: id => sourceHTML(id, state) };
    }
    function pickerHTML(state = game.snapshot()) {
        const expression = state.phase === 'expression' || state.notesPurpose === 'P2';
        return expression && ui.inventoryKind === 'items' ? ui.notesShown && game.phoneEnabled() ? itemInventoryHTML(state, game.canPrepareSupplies()) : '' : inventoryHTML(state, game.graph(), thoughtView(state));
    }
    function canvasHTML(state: GameSessionState) {
        const graph = game.graph(), purpose = state.phase === 'expression' || state.notesPurpose === 'P2', view = thoughtView(state);
        const feedback = purpose ? expressionListenerTurn(state, id => game.sourceRow(id)) : '';
        return `<main class="thought-screen workspace-screen ${purpose ? 'expression-workspace' : ''} ${ui.notesShown ? 'inventory-open' : ''}" data-phase="${state.phase}"><div class="thought-landscape" style="background-image:url('${media.scenes[state.scene]}')"></div><div class="paper-atmosphere"></div>${hud(state, true)}${pickerHTML(state)}${purpose ? workspaceModesHTML(state) : ''}${purpose ? `<div class="workspace-layout" tabindex="0" aria-label="组织表达，可上下滚动"><div class="expression-layout"><svg class="reasoning-curves" aria-hidden="true"></svg><section class="thought-center expression-center" data-expression-destination>${expressionHeadingHTML('魏延', feedback ? `“${feedback}”` : '')}${state.phase === 'expression' ? expressionHTML(state) : `<div class="expression-input-block"><p>准备说明的依据与原话，仍可随时回看。</p>${btn('open-inventory', '查阅依据 ＋', 'speech-add')}<div class="thought-inspection-slot expression-inspection-slot" aria-label="查阅表达依据"></div></div>${btn('close-notes', '收起 · 回到表达 ↗', 'expression-return')}`}</section></div></div>` : reasoningHTML(state, graph, view)}<div id="game-notice" class="thought-notice" role="status" aria-live="polite">${esc(ui.notice || ui.storageWarning)}</div></main>`;
    }
    function expressionHTML(state: GameSessionState) {
        const c = state.composition, text = state.story.draft;
        const help = expressionHelp(state);
        const revealing = c.status === 'ready' && !ui.reduced && Date.now() - ui.revealAt < thoughtRevealDuration;
        const error = text.trim() ? c.error : c.error.replace(/(?:依据与|你的)?原话已保留[，。]?/g, '').replace(/[；，]$/, '。');
        const unchanged = (value: string) => value.replace(/[\p{P}\p{Z}\s]/gu, '');
        const completed = c.status === 'ready' && c.provenance === 'ai' ? c.focus.trim() && unchanged(c.focus) === unchanged(text) ? '已保留原句，可以编辑后说出。' : '润色完成。' : '';
        const status = c.status === 'waiting' ? '正在润色……' : c.status === 'failed' ? error || '本次尚未生成，请重试。' : c.status === 'cancelled' ? '已取消润色。' : completed;
        return expressionPaperHTML({
            evidence: expressionEvidenceHTML(state) + (game.phoneEnabled() ? attachedItemsHTML(state, ui.notesShown && ui.inventoryKind === 'items') : ''),
            composer: `<div class="expression-composer"><span class="expression-writing-wash"><input id="expression-focus" maxlength="600" type="text" aria-label="补充说明" placeholder="补充说明…" value="${esc(c.focus)}"></span></div>`,
            draft: text, status, maxLength: 0, ready: c.status === 'ready', revealing, elapsed: Date.now() - ui.revealAt,
            polishActions: `<button type="button" data-action="confirm-focus" class="confirm-focus-button" title="将输入的原话放入右侧待说内容" ${!c.focus.trim() ? 'disabled' : ''}>确认</button>${c.status === 'waiting' ? btn('cancel-generation','取消润色','cancel-polish') : ''}${btn('generate-expression', c.status === 'waiting' ? '润色中…' : !game.aiEnabled() ? '整理参考句' : c.status === 'failed' ? '重新润色' : '润色表达', 'polish-button', c.status === 'waiting' || !hasExpressionMaterial(state.story.selected.length, state.supplies.attached.length, text.trim() || c.focus))}${game.canRestorePreviousDraft ? btn('restore-previous-draft', '撤销润色', 'restore-draft') : ''}`,
            help: help ? `<details class="expression-help"><summary>看看怎么说</summary><p>${esc(help)}</p>${btn('use-expression-help', '采用这句')}</details>` : '',
            confirmActions: btn('speak', '确认说出 ↗', 'confirm-expression', !text.trim() || !['ready', 'cancelled', 'failed'].includes(c.status)),
        });
    }
    function expressionEvidenceHTML(state: GameSessionState) {
        const graph = game.graph(), selected = state.story.selected.filter(id => state.story.collected.includes(id) || graph[id]);
        return `<section class="speech-evidence" data-expression-drop aria-label="本次选用的依据"><header><button data-action="clue-items" class="speech-add" aria-expanded="${ui.notesShown && ui.inventoryKind === 'clues'}" aria-controls="thought-inventory">＋ 添加线索</button></header><div class="speech-evidence-items">${selected.map(id => `<article data-expression-source="${id}" class="working-clue ${graph[id] ? 'is-understanding' : ''}" title="${id === 'C08' ? '姜维亲口应允' : graph[id] ? '已有的认识' : '听来的见闻'}"><button class="working-clue-title" data-read-note="${id}" aria-haspopup="dialog">${esc(shortLabels[id] ?? label(id))}</button><button class="working-clue-remove" data-use="${id}" aria-label="取消选用${esc(label(id))}">×</button></article>`).join('')}</div></section>`;
    }
    return { sourceHTML, thoughtView, canvasHTML, pickerHTML };
}
