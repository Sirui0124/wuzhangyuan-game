import type { Ending } from './endings';
import { achievementEmblem } from './achievements/emblems';

const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** Shared by the map shelf, album overview and expanded card. Copy stays in the ending catalog. */
const artwork: Record<string, string> = {
    safe: 'safe', 'tutorial-sacrifice': 'tutorial-sacrifice', 'tent-execution': 'tent-execution',
    'radio-relay': 'radio-relay', 'light-signal': 'light-signal', 'item-plan': 'item-plan', 'era-arrest': 'era-arrest',
};

export function achievementCardHTML(ending: Ending, revealed = true): string {
    const title = revealed || ending.category === 'milestone' ? ending.title : '尚未收录';
    const long = [...title].length > 7;
    // Break at the authored punctuation, never rewrite or truncate the achievement name.
    const parts = long ? title.match(/[^，、；：！？。]+[，、；：！？。]?/gu) ?? [title] : [title];
    const art = revealed ? artwork[ending.id] : undefined;
    return `<span class="collectible-card ${long ? 'has-long-title' : ''} ${revealed ? '' : 'is-sealed'}" data-card-ending="${esc(ending.id)}">
      ${art ? `<img class="collectible-art" src="/ui/achievements/${art}.png" alt="" loading="lazy" decoding="async">` : `<span class="collectible-art collectible-blank" aria-hidden="true"></span>${ending.emblem && (revealed || ending.category === 'milestone') ? achievementEmblem(ending.emblem, ending.chapter) : ''}`}
      <svg class="collectible-frame" viewBox="0 0 300 450" preserveAspectRatio="none" aria-hidden="true"><path d="M16 2H284L298 16V434L284 448H16L2 434V16Z"/><path d="M19 7H281L293 19V431L281 443H19L7 431V19Z"/></svg>
      <span class="collectible-copy"><strong class="collectible-title">${parts.map(part => `<span>${esc(part)}</span>`).join('')}</strong><span class="collectible-rule" aria-hidden="true">◇</span><small class="collectible-phase">${revealed ? esc(ending.phase) : '亲历之后，方可展开'}</small></span>
    </span>`;
}
