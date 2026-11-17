/** Authored art cues only. These do not judge speech or change narrative state. */
export type CharacterMood = 'neutral' | 'alert' | 'concerned' | 'weary' | 'resolved';

export function characterId(speaker: string): string {
    const names: [string, string][] = [['魏延', 'weiyan'], ['姜维', 'jiangwei'], ['诸葛亮', 'zhugeliang'], ['斥候', 'scout'], ['亲兵', 'jiangwei_guard'], ['甲', 'guard'], ['乙', 'relay']];
    return names.find(([name]) => speaker.startsWith(name))?.[1] ?? '';
}

const resolved = new Set(['A-40B', 'W07', 'E04', 'E04A', 'E04B', 'E10', 'J09A', 'J10', 'J10A', 'J11', 'J12', 'E03', 'E05', 'E06', 'E07', 'E08', 'E08B']);
const concerned = new Set(['J07', 'J08C', 'J09', 'B-14', 'B-15']);

export function characterMood(character: string, rowId = ''): CharacterMood {
    if (resolved.has(rowId)) return 'resolved';
    if (character === 'jiangwei' && concerned.has(rowId)) return 'concerned';
    if (character === 'weiyan' && (/^A-(28|30|32|33|34|37|40|50|51|53|55|56)$/.test(rowId) || /^W01|^P2-F/.test(rowId))) return 'alert';
    return 'neutral';
}

export function characterImage(characters: Record<string, string>, id: string, mood: CharacterMood = 'neutral'): string {
    return characters[`${id}_${mood}`] ?? characters[id] ?? '';
}
