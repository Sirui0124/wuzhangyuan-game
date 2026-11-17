import { ownedWorldItems, worldItem } from './world-items';
import { money, isAvailableSupply, supplyById, type Supplies } from '../phone/supplies';
import { esc } from '../game/view-common';

export function bagHTML(s: Supplies) {
    const objects = ownedWorldItems(s.worldItems).map(item => `<article class="supply-card"><h2>${esc(item.name)}</h2><p>${esc(item.description)}</p></article>`);
    const purchased = s.purchases.filter(id => isAvailableSupply(id, s)).map(id => {
        const item = supplyById(id, s)!;
        return `<article class="supply-card"><h2>${esc(item.name)}</h2><p>${esc(item.ability)}</p></article>`;
    });
    return objects.length || purchased.length ? `<div class="supply-grid">${[...objects, ...purchased].join('')}</div>` : '<p class="panel-empty">尚未携带物品。</p>';
}
export function saleHTML(s: Supplies, enabled: boolean, confirming = '') {
    const items = ownedWorldItems(s.worldItems);
    if (!items.length) return '';
    return `<section class="world-item-sales" aria-label="出售拾取与获赠物品"><h2>出售物品</h2><div class="supply-grid">${items.map(item => `<article class="supply-card"><header class="supply-card-heading"><h3>${esc(item.name)}</h3><strong>¥${money(item.value)}</strong></header><p>${esc(item.description)}</p>${confirming === item.id
        ? `<p>确认出售后，物品会离开物品栏，获得 ¥${money(item.value)} 游戏资金。</p><button data-confirm-sale="${item.id}" ${enabled ? '' : 'disabled'}>确认出售</button><button data-cancel-sale>保留</button>`
        : `<button data-sell-world-item="${item.id}" ${enabled ? '' : 'disabled'}>出售 · ¥${money(item.value)}</button>`}</article>`).join('')}</div></section>`;
}
export function worldReceipt(id: string) { return worldItem(id)?.receipt ?? ''; }
