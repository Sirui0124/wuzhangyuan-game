import type { GrainSession } from './session';

export function grainAchievementIds(session: GrainSession): string[] {
    const ids: string[] = [], s = session.state, read = (id: string) => s.visited.includes(id);
    if (read('V04') && read('CH2-LY02-014')) ids.push('grain-dates');
    if ([1, 2, 3, 4, 5, 6].every(n => read(`CH2-LY04-D0${n}`))) ids.push('grain-ledgers');
    if (s.supplies.worldItems?.acquired.includes('tent-candlestick')) ids.push('grain-candlestick');
    if (read('UI-SEND')) ids.push('grain-letter');
    if (session.current.kind === 'finish' && session.current.ending) ids.push(`grain-${session.current.ending}`);
    if (s.end === 'era-arrest') ids.push('grain-era-arrest');
    return ids;
}
