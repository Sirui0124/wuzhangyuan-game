import { esc } from './view-common';
import type { MaterialAppearance } from '../chapters/chapter-two/materials';

export function materialView(text: string, appearance?: MaterialAppearance) {
    const prop = appearance ? `<figure class="evidence-prop evidence-prop--${appearance.kind}" aria-label="${esc(appearance.title)}">
        <div class="evidence-paper" aria-hidden="true" style="--ink-length:${Math.max(...appearance.inscription.map(line => [...line].length)) + 1}"><img src="/ui/evidence-paper-v1.png" alt="" draggable="false">
        <div class="evidence-inscription">${appearance.inscription.map(line => `<span>${esc(line)}</span>`).join('')}</div></div>
    </figure>` : '';
    return `<div class="evidence-layout ${appearance ? '' : 'evidence-layout--explanation'}">${prop}
        <section class="dialogue-box evidence-reading" aria-label="${esc(appearance?.title ?? '粮食流转说明')}">
            ${appearance ? `<h1 class="dialogue-speaker">${esc(appearance.title)}</h1>` : ''}
            <div class="dialogue-reading" tabindex="0"><p class="dialogue-text">${esc(text)}</p></div>
        </section></div><p class="dialogue-key-hint">点击屏幕继续 · 空格</p>`;
}
