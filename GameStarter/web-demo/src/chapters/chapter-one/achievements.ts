import type { GameSessionState } from './session-state';

export function chapterOneAchievementIds(state: GameSessionState): string[] {
    const ids: string[] = [];
    if (state.round === 2) ids.push('wuzhang-second-night');
    if (['C02', 'C03', 'C05', 'C06', 'C07'].every(id => state.story.collected.includes(id))) ids.push('wuzhang-inquiry');
    return ids;
}
