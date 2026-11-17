import type { GameSessionState } from '../../../chapter-session';
import { esc, btn } from '../../../game/view-common';
import { supplyEndings, supplyEpilogues } from '../supply-endings';
export function supplyEndingHTML(state: GameSessionState) {
    const route = state.supplies.agreement?.route;
    if (!route || state.end !== route) return '';
    const ending = supplyEndings.find(e => e.id === route)!;
    return `<main class="chapter-ending supply-ending"><div class="ending-copy"><span class="ending-kicker">第一章 · 物品交涉结局</span><h1>${esc(ending.title)}</h1><p>${esc(ending.description)}</p>
      <div class="supply-epilogue" aria-label="交接后的对话">${supplyEpilogues[route].map(row => `<p><strong>${row.speaker}</strong><span>${esc(row.text)}</span></p>`).join('')}</div>
      <div>${btn('map', '继续往前', 'ending-primary')}${btn('chapters', '查看成就')}</div></div><footer>${btn('menu', '返回开始页')}<span>原有军报与回令交接已完成</span></footer></main>`;
}
