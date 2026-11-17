/** Player preference shared by chapters; independent of story progress/content versions. */
export const playbackRates = [1, 1.25, 1.5, 2] as const;
const key = 'wuzhang-playback-rate-v1';
let sessionRate: number | undefined;
const valid = (value: unknown): value is number => typeof value === 'number' && playbackRates.some(rate => rate === value);

export function savePlaybackRate(rate: number): void {
    if (!valid(rate)) return;
    sessionRate = rate;
    try { localStorage.setItem(key, String(rate)); } catch { /* Retain this session's choice. */ }
}

export function preferredPlaybackRate(legacyRate?: unknown): number {
    try {
        const saved = localStorage.getItem(key);
        if (saved !== null && valid(Number(saved))) { sessionRate = Number(saved); return sessionRate; }
    } catch { /* Playback remains available without persistent storage. */ }
    // Adopt a pre-upgrade player's saved selection once, even after a content update.
    if (sessionRate === undefined && valid(legacyRate)) savePlaybackRate(legacyRate);
    return sessionRate ?? 1;
}
