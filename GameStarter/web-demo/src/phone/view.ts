import { saleHTML } from '../inventory/view';
import type { PhoneHost, PhoneSnapshot } from './host';
import { esc, btn } from '../game/view-common';
import { balance, money, supplyById, type SupplyItem } from './supplies';
import type { GameUIState } from '../game/ui-state';
export function suppliesHTML(game: PhoneHost, state: PhoneSnapshot, shopping: GameUIState['shopping']) {
    const s = state.supplies, canBuy = game.canPrepareSupplies(), available = balance(s);
    const canAttach = state.phase === 'expression' && state.round === 2 && !state.speech;
    const card = (item: SupplyItem, suggested = false) => {
        const owned = s.purchases.includes(item.id), consumed = (s.consumed ?? []).includes(item.id), attached = s.attached.includes(item.id);
        return `<article class="supply-card"><header class="supply-card-heading"><h3>${esc(item.name)}</h3><strong>¥${money(item.price)}</strong></header>
          <span class="price-kind">${item.priceKind === 'configured' ? '标价' : item.priceKind === 'estimate' ? '估价 · 未核实' : '参考价'}</span>
          ${item.specification ? `<p class="supply-specification">${esc([item.specification.brand, item.specification.model, item.specification.variant, `${item.specification.quantity}${item.specification.unit}`].filter(Boolean).join(' · '))}</p>` : ''}
          <details><summary>详情</summary>${item.specification?.components.length ? `<p>${esc(item.specification.components.map(part => [part.item, part.brand, part.model, part.variant, `${part.quantity}${part.unit}`].filter(Boolean).join(' ')).join('；'))}</p>` : ''}${item.why ? `<p>${esc(item.why)}</p>` : ''}<p>${esc(item.ability)}</p><p class="supply-boundary">${esc(item.boundary)}</p><p>${item.priceKind === 'configured' ? '游戏标价' : item.priceKind === 'estimate' ? '估价' : item.priceKind === 'search' ? '检索参考价' : '参考价快照'} · ${esc(item.quote)} · ${item.date}</p>${item.source ? `<a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">报价来源</a>` : ''}
          ${item.searchState === 'unavailable' ? '<p>本次联网查询暂不可用，因此按常识估价。</p>' : item.priceKind === 'estimate' ? '<p>本次检索未核实对应规格的报价。</p>' : ''}
          ${item.sources?.length ? `<ul>${item.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a></li>`).join('')}</ul>` : ''}<p>成功用于一次交涉后整件消耗，套装整套消耗。附上、撤下或交涉失败不消耗。</p><p>虚拟购买，不产生真实订单。不计运费；标价和规格确认后随物品保存。</p></details>
          ${consumed ? '<span class="supply-owned">已消耗</span>' : owned ? `<span class="supply-owned">已购入</span><button id="phone-attach-${esc(item.id)}" data-attach-item="${esc(item.id)}" aria-pressed="${attached}" ${!canAttach || (!attached && s.attached.length >= 2) ? 'disabled' : ''}>${attached ? '撤下' : '附到这次发言'}</button>`
            : `<button ${suggested ? 'data-buy-offer' : 'data-buy-item'}="${esc(item.id)}" ${!canBuy || available < item.price ? 'disabled' : ''}>${available <= 0 ? '余额为0' : available < item.price ? `还差¥${money(item.price - available)}` : item.priceKind === 'estimate' ? '按估价购入' : '购入'}</button>`}</article>`;
    };
    const shown = new Set(shopping.messages.flatMap(m => m.products?.map(p => p.id) ?? []));
    const savedItems = s.purchases.filter(id => !shown.has(id));
    return `${saleHTML(s, canBuy, shopping.saleConfirm)}<div class="supply-shop phone-chat" aria-label="与手机助手的对话">
      ${!shopping.messages.length && !savedItems.length ? '<article class="phone-message assistant" aria-label="我的系统"><p>我在。</p></article>' : ''}
      ${savedItems.length ? `<article class="phone-message assistant" aria-label="已购物品"><div class="supply-grid">${savedItems.map(id => card(supplyById(id, s)!)).join('')}</div></article>` : ''}
      ${shopping.messages.map(m => `<article class="phone-message ${m.role === 'user' ? 'user' : 'assistant'}" aria-label="${m.role === 'user' ? '我' : '我的系统'}"><p>${esc(m.text)}</p>${m.products?.length ? `<div class="shopping-results supply-grid">${m.products.map(p => card(p, true)).join('')}</div>` : ''}</article>`).join('')}
      <p class="shopping-status ${shopping.status === 'waiting' ? 'is-waiting' : ''}" role="status" aria-live="polite">${esc(shopping.status === 'waiting' ? '助手正在回复…' : shopping.message)}</p></div>`;
}
export function phoneComposerHTML(game: PhoneHost, shopping: GameUIState['shopping']) {
    const disabled = !game.canPrepareSupplies(), empty = !shopping.query.replace(/^(帮我买|我想问问)[\s。.…]*/, '').trim();
    return `<section class="phone-composer"><div class="phone-suggestions" aria-label="对话提示"><button data-phone-prompt="buy" ${disabled ? 'disabled' : ''}>买东西</button><button data-phone-prompt="ask" ${disabled ? 'disabled' : ''}>问一问</button></div>
      <div class="phone-input"><textarea id="shopping-query" maxlength="600" rows="2" aria-label="给手机助手发消息" placeholder="想问什么，或买什么？">${esc(shopping.query)}</textarea>${shopping.status === 'waiting' ? btn('cancel-shopping', '停止', 'phone-send') : btn('search-supplies', '发送', 'phone-send', disabled || empty)}</div></section>`;
}
