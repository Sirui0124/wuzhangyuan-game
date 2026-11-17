import { esc } from '../game/view-common';

export function phoneLauncherHTML(hint = '') {
    return `<button class="phone-launcher" data-action="supplies" aria-label="打开手机" aria-haspopup="dialog"><svg viewBox="0 0 28 38" aria-hidden="true"><rect x="4" y="2" width="20" height="34" rx="5"/><path d="M11 6h6M12 31h4"/></svg><span>手机</span>${hint ? `<small>${esc(hint)}</small>` : ''}</button>`;
}
