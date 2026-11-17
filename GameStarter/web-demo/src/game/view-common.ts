import { characterImage, type CharacterMood } from '../character-art';
export type Media = { characters: Record<string, string>; scenes: Record<string, string> };
export const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const btn = (action: string, label: string, cls = '', disabled = false) => `<button data-action="${action}" class="${cls}" ${disabled ? 'disabled' : ''}>${label}</button>`;
export const personName = (speaker: string) => speaker.startsWith('演出') || speaker === '旁白' ? '眼前所见' : /^(结果|结算)/.test(speaker) ? '此夜的命运' : /^(主角|我)/.test(speaker) ? speaker.includes('心声') ? '我（心声）' : '我' : ({ '甲': '守帐军士（甲）', '乙': '传报军士（乙）' } as Record<string, string>)[speaker.split(/[·（]/)[0]] ?? speaker.split(/[·（]/)[0];
export function createPortrait(media: Media) {
    const portrait = (id: string, cls = '', mood: CharacterMood = 'neutral') => id && characterImage(media.characters, id, mood) ? `<img class="character-art ${cls}" data-character="${id}" data-expression="${mood}" src="${characterImage(media.characters, id, mood)}" alt="${esc(({ guard: '守帐军士（甲）', relay: '传报军士（乙）', scout: '斥候', weiyan: '魏延', jiangwei: '姜维', zhugeliang: '诸葛亮', jiangwei_guard: '亲兵' } as Record<string, string>)[id] ?? id)}" draggable="false">` : '';
    return portrait;
}
