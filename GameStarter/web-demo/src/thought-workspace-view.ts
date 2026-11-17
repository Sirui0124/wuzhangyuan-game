import { inventoryPanelHTML } from './inventory/panel-view';
export { inventoryPanelHTML } from './inventory/panel-view';
import type { GameSessionState } from './chapter-session';
import { selectionRowHTML } from './inventory/selection-view';
import type { Derived } from './thought-canvas-model';
import { fixedThoughts, thoughtInsights, thoughtLabels, thoughtCapacity } from './thought-workspace';
const esc = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const title = (id: string) => thoughtLabels[id] ?? id;
export const thoughtRevealDuration = 1600;
export type ThoughtView = { inventoryOpen: boolean; detail: string; revealAt: number; reduced: boolean; source: (id: string) => string };
export function workspaceModesHTML(state: GameSessionState) {
    const expression = state.phase === 'expression' || state.notesPurpose === 'P2';
    if (!expression && state.notesReturn !== 'expression') return '';
    return `<nav class="workspace-modes" aria-label="画布用途"><button data-action="reasoning-mode" ${!expression ? 'aria-current="page"' : ''} ${state.round === 1 ? 'disabled title="此刻先向魏延说明"' : ''}>线索推理</button><span aria-hidden="true">·</span><button data-action="language-mode" ${expression ? 'aria-current="page"' : ''}>语言组织</button></nav>`;
}
export function inventoryHTML(state: GameSessionState, graph: Record<string, Derived>, view: ThoughtView) {
    const expression = state.phase === 'expression' || state.notesPurpose === 'P2';
    const readOnly = !expression && (state.round !== 2 || !state.story.collected.includes('C03') || !!graph.R02 || (!!graph.R01 && !state.thinking?.recipientOpen));
    const known = [...new Set([...state.story.collected, ...state.story.seen])].filter(id => id !== 'R02');
    const active = expression ? state.story.selected : graph.R02
        ? [...(state.thinking?.history.at(-1)?.inputs ?? []), ...(state.thinking?.placed ?? [])]
        : state.thinking?.placed ?? [];
    const fixed = expression ? [] : fixedThoughts(state.thinking);
    const capacity = thoughtCapacity(active, graph);
    const rows = known.map(id => {
        const stale = !state.story.collected.includes(id) && !graph[id], placed = active.includes(id), inherited = fixed.includes(id);
        const action = placed ? expression ? 'data-use' : 'data-remove-thought' : 'data-place-evidence';
        const search = `${title(id)} ${view.source(id).replace(/<[^>]*>/g, ' ')}`;
        if (expression) return selectionRowHTML({ id, title: title(id), search, detailAction: 'data-inventory-item', dragId: !stale ? id : undefined, toggle: { action: placed ? 'data-use' : 'data-place-evidence', selected: placed, disabled: stale, unavailable: stale } });
        if (readOnly) return `<section class="inventory-entry ${stale ? 'is-stale' : ''}" data-search-text="${esc(search)}"><button class="inventory-row" data-inventory-item="${id}" aria-haspopup="dialog"><span>${esc(title(id))}</span></button></section>`;
        return `<section class="inventory-entry ${placed ? 'is-placed' : ''} ${stale ? 'is-stale' : ''} ${inherited ? 'is-fixed' : ''}" data-search-text="${esc(search)}"><button class="inventory-row" data-inventory-item="${id}" ${!stale && !inherited && (expression || !capacity.full) ? `data-inventory-drag="${id}"` : ''} aria-haspopup="dialog" ${inherited ? 'aria-description="当前思路的固定起点"' : ''}><span>${esc(title(id))}</span></button><button class="inventory-place" ${action}="${id}" aria-pressed="${placed}" aria-label="${inherited ? '已有的思考起点：' : placed ? '收回' : '放入'}${esc(title(id))}" ${stale || inherited || (!expression && !placed && capacity.full) || (!expression && (state.round !== 2 || !state.story.collected.includes('C03') || !!graph.R02 || (!!graph.R01 && !state.thinking?.recipientOpen))) ? 'disabled' : ''}>${stale ? '−' : placed ? '✓' : '＋'}</button></section>`;
    }).join('');
    return `<button class="inventory-tab" data-action="notes-list" aria-expanded="${view.inventoryOpen}" aria-controls="thought-inventory">线索</button>${view.inventoryOpen ? inventoryPanelHTML('线索', rows, '未找到相关线索', readOnly) : ''}`;
}
function clueHTML(id: string, graph: Record<string, Derived>, editable: boolean, unused = false) {
    return `<article class="working-clue ${graph[id] ? 'is-understanding' : ''} ${unused ? 'is-unused' : ''}" data-thought-node="${id}"><button class="working-clue-title" data-read-note="${id}" aria-haspopup="dialog" aria-label="查看${esc(title(id))}的原话与依据${unused ? '，未用于这个判断' : ''}">${esc(title(id))}</button>${editable ? `<button class="working-clue-remove" data-remove-thought="${id}" aria-label="收回${esc(title(id))}">×</button>` : ''}</article>`;
}
const questions = { situation: '今晚的军情如何？', recipient: '今晚的军情应该怎么处理' };
type Question = keyof typeof questions;
const questionHTML = (stage: Question) => `<h2 class="current-question" data-thought-question="${stage}">${questions[stage]}</h2>`;
const pickerButton = '<button class="drop-invitation" data-action="open-inventory" aria-controls="thought-inventory"><span aria-hidden="true">＋</span>添入线索</button>';
const inspectionSlot = '<div class="thought-inspection-slot" aria-label="查阅线索"></div>';
export function reasoningHTML(state: GameSessionState, graph: Record<string, Derived>, view: ThoughtView) {
    const board = state.thinking!;
    const elapsed = Date.now() - view.revealAt;
    const revealing = !!board.history.length && !view.reduced && elapsed < thoughtRevealDuration;
    const ready = !!graph.R02, waiting = !!graph.R01 && !board.recipientOpen && !ready;
    const hasQuestion = state.round === 2 && state.story.collected.includes('C03');
    const active = hasQuestion && !ready && !waiting;
    const stage: Question = graph.R01 ? 'recipient' : 'situation';
    const completed = (id: 'R01' | 'R02', question: Question) => {
        if (!graph[id]) return '';
        // One answer per question. Expand partial thoughts to their original evidence.
        const used = id === 'R01' ? ['C02', 'C03'] : ['R01', 'C06', 'C07'];
        const index = board.history.findIndex(record => record.outputs.some(output => output.id === id));
        const animate = revealing && index === board.history.length - 1;
        return `<section class="thought-page thought-record begins-question ${animate ? 'is-revealing' : ''}" data-question-stage="${question}" data-thought-start-ids="${id === 'R02' ? 'R01' : ''}" style="--reveal-elapsed:-${Math.max(0, elapsed)}ms" ${id === 'R02' || waiting ? 'data-thought-tail' : ''}>
          ${questionHTML(question)}
          <div class="thought-input-row"><div class="record-evidence">${used.filter(item => item !== 'R01').map(item => clueHTML(item, graph, false)).join('')}</div></div>
          <div class="record-outputs"><section class="thought-outcome" data-thought-result="${id}" data-result-inputs="${used.join(' ')}"><h2><button class="outcome-title" data-read-note="${id}" aria-haspopup="dialog">${esc(title(id))}</button></h2>
          <p class="outcome-insight">${esc(thoughtInsights[id])}</p>
          ${id === 'R01' && waiting ? `<div class="thought-action"><button class="follow-plan-button" data-action="continue-thought">继续推理 ›</button></div>` : ''}
          ${id === 'R02' ? `<div class="outcome-summary"><p>先请他在帐外听报，当面问准。</p></div><div class="thought-action">${state.finishedSections.includes('jiang-commitment') ? '<button data-action="close-notes">回到此刻 ›</button>' : '<button class="follow-plan-button" data-action="follow-plan">去找姜伯约 ›</button>'}</div>` : ''}
          </section></div></section>`;
    };
    const partials = board.history.flatMap(record => record.outputs.map(output => output.id)).filter(id => id.startsWith('I') && graph[id]);
    const capacity = thoughtCapacity(board.placed, graph);
    const inputs = [...new Set(board.placed)].filter(id => id !== 'R01' && id !== 'R02');
    const editor = active ? `<section class="thought-page thought-editor is-current-page begins-question" data-thought-tail data-question-stage="${stage}" data-thought-start-ids="${graph.R01 ? 'R01' : ''}">
        ${questionHTML(stage)}<div class="thought-input-row"><section class="thought-dropzone" data-thought-drop tabindex="0" aria-label="放入本次推理的线索">${inputs.map(id => clueHTML(id, graph, board.placed.includes(id) && !fixedThoughts(board).includes(id))).join('')}</section></div>
        <div class="thought-controls">${pickerButton}<span class="evidence-capacity" role="status">依据 ${capacity.count}/${capacity.limit}</span><button class="think-button" data-action="think" ${board.placed.length && !revealing && !capacity.exceeded ? '' : 'disabled'}>推理</button></div>
        <div class="thought-await" role="status" aria-live="polite"><p>${esc((capacity.exceeded ? `当前依据超过${capacity.limit}条，请先移除多余依据。` : board.feedback) || (partials.length ? '已有部分认识；补充依据，继续回答当前问题。' : ''))}</p></div>${inspectionSlot}</section>` : '';
    return `<header class="thought-goal" data-thought-goal><h1>如何在不惊扰丞相的情况下，不误军情？</h1></header><div class="workspace-layout" tabindex="0" aria-label="推理画布，向上回看历史，向下回到最新"><section class="reasoning-stage" aria-label="思绪画布">${workspaceModesHTML(state)}<div class="reasoning-timeline"><svg class="reasoning-curves" aria-hidden="true"></svg>
      ${completed('R01', 'situation')}${completed('R02', 'recipient')}${editor}
      ${!hasQuestion && !ready ? `<section class="thought-page thought-empty is-current-page"><div class="thought-await"><p>当前没有可推理的问题。</p><button class="resume-thought" data-action="open-inventory" aria-controls="thought-inventory" aria-expanded="${view.inventoryOpen}">查阅已得线索</button></div>${inspectionSlot}</section>` : ''}
      </div></section></div><nav class="thought-navigation" aria-label="回看思绪">${board.history.length ? '<button data-action="thought-history">⌃ 回看前文</button><span aria-hidden="true">｜</span><button data-action="thought-tail">回到最新 ⌄</button>' : ''}<button data-action="close-notes">收起 ⌃</button></nav>`;
}
