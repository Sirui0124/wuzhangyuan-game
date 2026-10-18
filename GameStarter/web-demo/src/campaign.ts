// Player-level map progress. Deliberately has no NarrativeEngine or judge dependency.
export const CAMPAIGN_KEY = 'wuzhang-campaign-v1';
export const stages = ['video', 'ending', 'rewind', 'map'] as const;
export type Stage = typeof stages[number];
export type MapLevel = { id: string; title: string; summary: string; implemented: boolean; x: number; y: number };
export const levels: MapLevel[] = [
    { id: 'wuzhang', title: '五丈原守灯', summary: '第六夜 · 守灯与传报', implemented: true, x: 18, y: 68 },
    { id: 'grain', title: '北伐粮运危机', summary: '下一次时光倒流', implemented: false, x: 52, y: 40 },
    { id: 'valley', title: '谷中失机', summary: '尚未解锁', implemented: false, x: 82, y: 24 },
];
export type Campaign = {
    schemaVersion: 1;
    played: string[];
    completed: string[];
    unlocked: string[];
    presentation: { loopId: string; stage: Stage } | null;
};
export function freshCampaign(): Campaign {
    return { schemaVersion: 1, played: [], completed: [], unlocked: ['wuzhang'], presentation: null };
}
export function parseCampaign(raw: string | null): Campaign {
    if (!raw) return freshCampaign();
    const c = JSON.parse(raw);
    if (!c || c.schemaVersion !== 1 || !['played', 'completed', 'unlocked'].every(k => Array.isArray(c[k]) && c[k].every((id: unknown) => levels.some(l => l.id === id)))) throw new Error('Invalid campaign progress');
    if (c.presentation !== null && (!c.presentation || typeof c.presentation.loopId !== 'string' || !stages.includes(c.presentation.stage))) throw new Error('Invalid campaign presentation');
    // Unimplemented entrances cannot count as played/completed. Grain can only be unlocked by a safe clear.
    const completed = c.completed.filter((id: string) => id === 'wuzhang');
    return {
        schemaVersion: 1, played: c.played.filter((id: string) => id === 'wuzhang'), completed,
        unlocked: completed.includes('wuzhang') ? ['wuzhang', 'grain'] : ['wuzhang'],
        presentation: completed.includes('wuzhang') ? c.presentation : null,
    };
}
export function markPlayed(c: Campaign, id: string): Campaign {
    if (!levels.some(l => l.id === id && l.implemented) || !c.unlocked.includes(id)) return c;
    return { ...c, played: [...new Set([...c.played, id])] };
}
export function completeSafe(c: Campaign, state: { loopId: string; flags: Record<string, unknown> }, atBoundary: boolean): Campaign {
    if (!atBoundary || state.flags['loop.result'] !== 'safe' || state.flags['loop.completed_wuzhang'] !== true || state.flags['progress.tutorial_completed'] !== true || state.flags['loop.player_alive'] !== true || state.flags['loop.lamp_lit'] !== true) return c;
    // Refresh and re-render must not replay an already entered presentation.
    if (c.presentation?.loopId === state.loopId) return c;
    return { ...markPlayed(c, 'wuzhang'), completed: [...new Set([...c.completed, 'wuzhang'])], unlocked: ['wuzhang', 'grain'], presentation: { loopId: state.loopId, stage: 'video' } };
}
export function advancePresentation(c: Campaign): Campaign {
    if (!c.presentation || c.presentation.stage === 'map') return c;
    const stage = stages[stages.indexOf(c.presentation.stage) + 1];
    return { ...c, presentation: { ...c.presentation, stage } };
}
export function levelStatus(c: Campaign, l: MapLevel): 'locked' | 'history' | 'preparing' | 'available' {
    if (!c.unlocked.includes(l.id)) return 'locked';
    if (c.completed.includes(l.id)) return 'history';
    if (!l.implemented) return 'preparing';
    return 'available';
}
