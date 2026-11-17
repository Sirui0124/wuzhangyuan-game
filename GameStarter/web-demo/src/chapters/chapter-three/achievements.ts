import type { JietingSession } from './session';

export function jietingAchievementIds(session: JietingSession): string[] {
    const ids: string[] = [], s = session.state;
    if (['wang', 'ma', 'camp'].every(place => s.visits.some(p => p === place))) ids.push('jieting-visits');
    if (Object.values(s.roundResults).some(r => r?.arrived && r.tasks.includes('water'))) ids.push('jieting-water');
    if (session.below >= 10000) ids.push('jieting-ten-thousand');
    if (s.flags.withdrawalVerified === true) ids.push('jieting-verified-withdrawal');
    if (session.current.kind === 'ending' && s.ending) ids.push(`jieting-${s.ending}`);
    return ids;
}
