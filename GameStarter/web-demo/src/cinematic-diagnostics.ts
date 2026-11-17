export type CinematicDiagnostic = {
    clipId: string; event: string; elapsedMs: number; currentTime: number;
    readyState: number; networkState: number; errorCode: number | null;
    subtitleState: number | null; subtitleMode: TextTrackMode | null;
};

/** In-memory technical evidence only: no narrative text, player input or credentials. */
export function watchCinematicMedia(video: HTMLVideoElement, clipId: string, emit: (record: CinematicDiagnostic) => void) {
    const start = performance.now();
    const lifetime = new AbortController();
    const record = (event: string) => {
        const track = video.querySelector<HTMLTrackElement>('track');
        emit({ clipId, event, elapsedMs: Math.round(performance.now() - start), currentTime: video.currentTime,
            readyState: video.readyState, networkState: video.networkState, errorCode: video.error?.code ?? null,
            subtitleState: track?.readyState ?? null, subtitleMode: track?.track.mode ?? null });
    };
    for (const event of ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'playing', 'waiting', 'stalled', 'error', 'ended']) {
        video.addEventListener(event, () => record(event), { signal: lifetime.signal });
    }
    const track = video.querySelector<HTMLTrackElement>('track');
    track?.addEventListener('load', () => record('subtitle-load'), { signal: lifetime.signal });
    track?.addEventListener('error', () => record('subtitle-error'), { signal: lifetime.signal });
    record('mount');
    return { record, dispose: () => lifetime.abort() };
}
