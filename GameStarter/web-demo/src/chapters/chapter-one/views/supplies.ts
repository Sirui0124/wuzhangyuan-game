import type { ChapterSession, GameSessionState } from '../../../chapter-session';
import { esc, btn } from '../../../game/view-common';
import { balance, money, supplyById, isAvailableSupply, type SupplyItem } from '../supplies';
import { inventoryPanelHTML } from '../../../thought-workspace-view';
import { selectionRowHTML } from '../../../inventory/selection-view';
import { supplyEndings, supplyEpilogues } from '../supply-endings';
import type { GameUIState } from '../../../game/ui-state';
import { ownedWorldItems } from '../../../inventory/world-items';

export { suppliesHTML, phoneComposerHTML } from '../../../phone/view';
export function attachedItemsHTML(state: GameSessionState, open = false) {
    if (state.round !== 2) return '';
    const attached = state.supplies.attached.filter(id => isAvailableSupply(id, state.supplies));
    return `<section class="speech-items" aria-label="本次物品佐证"><header><button data-action="items" class="speech-add-item" aria-expanded="${open}" aria-controls="thought-inventory">＋ 添加物品</button></header>
      <div class="speech-evidence-items">${attached.map(id => `<article class="working-clue"><button class="working-clue-title" data-read-note="item:${esc(id)}" aria-haspopup="dialog">${esc(supplyById(id, state.supplies)!.name)}</button><button class="working-clue-remove" data-attach-item="${esc(id)}" aria-label="撤下${esc(supplyById(id, state.supplies)!.name)}">×</button></article>`).join('')}</div></section>`;
}
export function itemInventoryHTML(state: GameSessionState, canOpenPhone = false) {
    const s = state.supplies, available = s.purchases.filter(id => isAvailableSupply(id, s));
    const rows = available.map(id => {
        const item = supplyById(id, s)!, attached = s.attached.includes(id);
        return selectionRowHTML({ id: `item:${id}`, title: item.name, search: `${item.name} ${item.ability} ${item.boundary}`, detailAction: 'data-inventory-item', toggle: { action: 'data-attach-item', id, selected: attached, disabled: !attached && s.attached.length >= 2 } });
    }).join('');
    const kept = ownedWorldItems(s.worldItems);
    const empty = kept.length
        ? `${kept.map(item => esc(item.name)).join('、')}仍在物品栏，仅供收藏或出售，不能用于本次交涉。 ${btn('bag', '查看物品栏 ↗')}`
        : `尚未持有可用于交涉的物品。${canOpenPhone ? ` ${btn('supplies', '去手机看看 ↗')}` : ''}`;
    return inventoryPanelHTML('物品', rows, available.length ? '未找到相关物品' : empty);
}
export function itemPreviewHTML(item: SupplyItem, consumed = false) {
    return `<div class="item-preview">${consumed ? '<p>已消耗</p>' : ''}<p class="item-preview-price">购入价 ¥${money(item.price)}</p><p>${esc(item.ability)}</p><p class="source-boundary">${esc(item.boundary)}</p><details><summary>购买记录</summary><p>${esc(item.quote)}</p>${item.source ? `<a href="${esc(item.source)}" target="_blank" rel="noreferrer">查看来源 ↗</a>` : ''}</details></div>`;
}
export function supplyEndingHTML(state: GameSessionState) {
    const route = state.supplies.agreement?.route;
    if (!route || state.end !== route) return '';
    const ending = supplyEndings.find(e => e.id === route)!;
    return `<main class="chapter-ending supply-ending"><div class="ending-copy"><span class="ending-kicker">第一章 · 物品交涉结局</span><h1>${esc(ending.title)}</h1><p>${esc(ending.description)}</p>
      <div class="supply-epilogue" aria-label="交接后的对话">${supplyEpilogues[route].map(row => `<p><strong>${row.speaker}</strong><span>${esc(row.text)}</span></p>`).join('')}</div>
      <div>${btn('map', '继续往前', 'ending-primary')}${btn('chapters', '查看成就')}</div></div><footer>${btn('menu', '返回开始页')}<span>原有军报与回令交接已完成</span></footer></main>`;
}
