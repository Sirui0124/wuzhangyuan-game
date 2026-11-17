import { expressionHeadingHTML, expressionPaperHTML } from '../../game/expression-view';
import type { JietingSession } from './session';
import type { JietingViewState } from './view';
import { esc, btn } from '../../game/view-common';
import { isAvailableSupply, supplyById } from '../../phone/supplies';
import { selectionRowHTML } from '../../inventory/selection-view';
import { inventoryPanelHTML } from '../../inventory/panel-view';
import { deploymentAxisHTML } from './deployment-view';

/** Uses the same expression, evidence and inspection components as chapters one and two. */
export function jietingExpression(s: JietingSession, v: JietingViewState, hud: string, background: string) {
    const question = s.state.followupUsed[s.current.id] ? s.state.unresolvedConcerns.at(-1) ?? s.current.text : s.current.text;
    const chip = (id: string, title: string, action: string) => `<article class="working-clue"><button class="working-clue-title" data-detail="${esc(id)}" aria-haspopup="dialog">${esc(title)}</button><button class="working-clue-remove" ${action}="${esc(id)}" aria-label="收回${esc(title)}" ${v.busy ? 'disabled' : ''}>×</button></article>`;
    const clues = s.clues.filter(c => s.state.selected.includes(c.id)).map(c => chip(c.id, c.title, 'data-select')).join('');
    const available = s.state.supplies.purchases.filter(id => isAvailableSupply(id, s.state.supplies));
    const items = v.phone ? s.state.supplies.attached.filter(id => isAvailableSupply(id, s.state.supplies)).map(id => chip(id, supplyById(id, s.state.supplies)!.name, 'data-attach-item')).join('') : '';
    const itemPicker = v.picker === 'items';
    const rows = itemPicker ? available.map(id => {
        const item = supplyById(id, s.state.supplies)!;
        const selected = s.state.supplies.attached.includes(id);
        return selectionRowHTML({ id, title: item.name, search: `${item.name} ${item.ability}`, detailAction: 'data-detail', toggle: { action: 'data-attach-item', selected, disabled: v.busy || (!selected && s.state.supplies.attached.length >= 2) } });
    }).join('') : s.clues.map(c => selectionRowHTML({ id: c.id, title: c.title, search: `${c.title} ${c.text}`, detailAction: 'data-detail', toggle: { action: 'data-select', selected: s.state.selected.includes(c.id), disabled: v.busy } })).join('');
    const inventory = v.picker ? inventoryPanelHTML(itemPicker ? '物品' : '线索', rows, itemPicker ? '没有找到可用物品。' : '没有找到相关线索。') : '';
    const clue = !itemPicker && s.clues.find(c => c.id === v.detail);
    const item = itemPicker && available.includes(v.detail ?? '') ? supplyById(v.detail!, s.state.supplies) : undefined;
    const tested = item && s.getEvaluationContext().items?.find(i => i.id === v.detail)?.tested;
    const detail = v.picker && (clue || item) ? `<aside class="thought-detail-popover" role="dialog" aria-label="${esc(clue ? clue.title : item!.name)}"><header><h3>${esc(clue ? clue.title : item!.name)}</h3><button data-action="close-evidence-detail" aria-label="收起详情">×</button></header>${clue ? `<p>${esc(clue.text)}</p>${clue.current === false ? '<p>这条军情已有变化，请以最新回报为准。</p>' : ''}<details><summary>回看原话</summary>${clue.sources.map(source => `<blockquote>${esc(source.speaker)}：${esc(source.text)}</blockquote>`).join('')}</details>` : `<p>${esc(item!.ability)}</p><p>${esc(item!.boundary)}</p><button data-prepare-item="${esc(v.detail)}" ${v.busy ? 'disabled' : ''}>${tested ? '再次试用' : '在帐侧试用'}</button>`}</aside>` : '';
    const paper = expressionPaperHTML({
        evidence: `<section class="speech-evidence"><header><button data-action="clue-items" class="speech-add" aria-expanded="${v.picker === 'notes'}" aria-controls="thought-inventory">＋ 添加线索</button></header><div class="speech-evidence-items">${clues}</div></section>${v.phone ? `<section class="speech-items"><header><button data-action="attach-items" class="speech-add-item" aria-expanded="${itemPicker}" aria-controls="thought-inventory">＋ 添加物品</button></header><div class="speech-evidence-items">${items}</div></section>` : ''}`,
        draft:s.state.draft, busy:v.busy, placeholder:'回答马将军的问题，也可以用已知军情提出自己的办法。', status:v.error||(v.questioning?'马谡正在斟酌……':v.polishing?'正在润色……':v.busy?'正在等待回应……':''),
        polishActions:v.polishing?btn('cancel-speech','取消润色','cancel-polish'):!v.busy?`${v.retryAction==='question'?btn('retry-question','重试提问'):''}${btn('polish-expression',v.error&&v.retryAction==='polish'?'重试润色':'润色表达','polish-button',!s.state.draft.trim()&&!s.state.selected.length&&!items)}${v.canUndoPolish?btn('undo-polish','撤销润色','restore-draft'):''}`:'',
        confirmActions:v.busy&&!v.polishing?btn('cancel-speech','停止等待'):btn('speak',v.error&&v.retryAction==='speak'?'重试说出 ↗':'确认说出 ↗','confirm-expression',v.busy||!s.state.draft.trim()),
        inspection:inventory+detail,
    });
    const axis = deploymentAxisHTML(s, v.previousBelow);
    return `<main class="thought-screen workspace-screen expression-workspace jieting-expression${axis ? ' has-deployment' : ''}" data-phase="expression"><div class="thought-landscape" style="background-image:url('${esc(background)}')"></div><div class="paper-atmosphere"></div>${hud}${axis}<div class="workspace-layout" tabindex="0" aria-label="组织表达，可上下滚动"><div class="expression-layout"><section class="thought-center expression-center">${expressionHeadingHTML('马谡',question)}${paper}</section></div></div></main>`;
}
