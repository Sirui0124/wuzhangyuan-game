import { esc } from './view-common';
/** Shared ornament and type layout for both chapter actions; decoration stays out of accessible names. */
export function commandActionContent(label: string, completed = false, leadingIcon = ''): string {
    const icon = completed ? 'M5 8A7 7 0 1 1 4 15M5 3V8H10' : 'M2 11H17M11 5L17 11L11 17';
    return `<svg class="map-action-frame" viewBox="0 0 240 50" preserveAspectRatio="none" aria-hidden="true"><path d="M8 1H232L239 8V42L232 49H8L1 42V8Z"/><path class="inner-rule" d="M23 5H217M23 45H217M5 17V33M235 17V33"/><path class="corner-rule" d="M18 5H10L5 10V14M222 5H230L235 10V14M18 45H10L5 40V36M222 45H230L235 40V36"/></svg><svg class="map-action-knot" viewBox="0 0 16 28" aria-hidden="true"><path d="M12 2H3V11H9V6H6M12 26H3V17H9V22H6M12 10L15 14L12 18L9 14Z"/></svg>${leadingIcon ? `<span class="pause-resume-content">${leadingIcon}<span class="map-action-label">${esc(label)}</span></span>` : `<span class="map-action-label">${esc(label)}</span>`}<svg class="map-action-icon" viewBox="0 0 20 22" aria-hidden="true"><path d="${icon}"/></svg>`;
}

export function mapActionContent(completed: boolean): string {
    return commandActionContent(completed ? '重玩这一章' : '继续这一章', completed);
}
