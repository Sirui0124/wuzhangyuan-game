/** One subtitle lifecycle per mounted video; old loads cannot reveal a disposed track. */
export function mountCinematicSubtitles(video: HTMLVideoElement, src?: string) {
    let visible = false, disposed = false;
    const events = new AbortController();
    const track = src ? document.createElement('track') : null;
    const update = () => { if (track) track.track.mode = visible && !disposed ? 'showing' : 'hidden'; };
    if (track) {
        track.kind = 'subtitles'; track.srclang = 'zh'; track.label = '中文字幕'; track.default = true; track.src = src!;
        track.addEventListener('load', () => {
            for (const cue of Array.from(track.track.cues ?? [])) {
                if (cue instanceof VTTCue && cue.line === 'auto') { cue.snapToLines = true; cue.line = -2; }
            }
            update();
        }, { signal: events.signal });
        video.append(track); update();
    }
    return {
        show() { visible = true; update(); },
        hide() { visible = false; update(); },
        dispose() { disposed = true; events.abort(); update(); track?.remove(); },
    };
}
