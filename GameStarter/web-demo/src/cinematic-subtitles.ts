/** One subtitle lifecycle per mounted video; old loads cannot reveal a disposed track. */
export function mountCinematicSubtitles(video: HTMLVideoElement, src?: string) {
    let visible = false, disposed = false;
    const events = new AbortController();
    const track = src ? document.createElement('track') : null;
    const automaticCues: VTTCue[] = [];
    const position = () => {
        if (!video.clientHeight || !video.videoWidth) return;
        const pictureHeight = Math.min(video.clientHeight, video.clientWidth * video.videoHeight / video.videoWidth);
        const fontSize = Math.max(20, Math.min(34, window.innerWidth * .02));
        const bottom = (video.clientHeight + pictureHeight) / 2 - fontSize * 1.5;
        for (const cue of automaticCues) {
            cue.snapToLines = false; cue.lineAlign = 'end';
            cue.line = Math.max(0, Math.min(100, bottom / video.clientHeight * 100));
        }
    };
    const resize = new ResizeObserver(position);
    resize.observe(video);
    video.addEventListener('loadedmetadata', position, { signal: events.signal });
    const update = () => { if (track) track.track.mode = visible && !disposed ? 'showing' : 'hidden'; };
    if (track) {
        track.kind = 'subtitles'; track.srclang = 'zh'; track.label = '中文字幕'; track.default = true; track.src = src!;
        track.addEventListener('load', () => {
            for (const cue of Array.from(track.track.cues ?? [])) {
                // Follow the contained picture, including portrait letterboxing; keep authored positions.
                if (cue instanceof VTTCue && cue.line === 'auto') automaticCues.push(cue);
            }
            position();
            update();
        }, { signal: events.signal });
        video.append(track); update();
    }
    return {
        show() { visible = true; update(); },
        hide() { visible = false; update(); },
        dispose() { disposed = true; events.abort(); resize.disconnect(); update(); track?.remove(); },
    };
}
