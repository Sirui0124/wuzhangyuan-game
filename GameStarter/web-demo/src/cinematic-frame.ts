/** Hold the decoded outgoing picture until the incoming video submits a frame. */
export function captureCinematicFrame(video: HTMLVideoElement) {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return null;
    const frame = document.createElement('canvas');
    frame.width = video.videoWidth; frame.height = video.videoHeight;
    frame.className = 'cinema-transition-frame'; frame.setAttribute('aria-hidden', 'true');
    try { frame.getContext('2d')!.drawImage(video, 0, 0); return frame; }
    catch { return null; }
}

/** Observe an actually presented frame, also for a preloaded video or a paused seek. */
export function onCinematicFrame(video: HTMLVideoElement, current: () => boolean, ready: () => void) {
    let cancelled = false, callback = 0, raf = 0;
    const reveal = () => { if (!cancelled && current()) { cancelled = true; ready(); } };
    const fallback = () => {
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { raf = requestAnimationFrame(reveal); });
    };
    if (typeof video.requestVideoFrameCallback === 'function') callback = video.requestVideoFrameCallback(reveal);
    else { video.addEventListener('loadeddata', fallback); video.addEventListener('playing', fallback); fallback(); }
    return () => {
        cancelled = true;
        if (callback) video.cancelVideoFrameCallback(callback);
        cancelAnimationFrame(raf);
        video.removeEventListener('loadeddata', fallback); video.removeEventListener('playing', fallback);
    };
}

export function holdCinematicFrame(frame: HTMLCanvasElement | null, video: HTMLVideoElement, current: () => boolean) {
    if (!frame) return () => {};
    video.after(frame);
    const stop = onCinematicFrame(video, current, () => frame.remove());
    return () => { stop(); frame.remove(); };
}
