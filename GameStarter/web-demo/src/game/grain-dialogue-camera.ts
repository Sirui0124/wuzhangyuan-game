import { captureCinematicFrame, holdCinematicFrame } from '../cinematic-frame';
import type { Clip } from '../cinematics';
import { trackWatchedFilm } from '../film-history';
import { esc } from './view-common';

// L01 circles across the tent; L02's last second pushes into an extreme close-up.
// The selected 0–3s section of L02 keeps the bed's axis, with no generated/replaced dialogue.
export const grainReplyStill = '/video/stills/CH2-listening-end-20261026.jpg';
const poster = '/video/stills/CH2-listening-start-20261026.jpg';
// The listening insert is three seconds long; a stalled decoder must not hold a returned answer.
export const GRAIN_LISTENER_MAX_WAIT_MS = 8000;
export function createGrainDialogueCamera() {
    let held: { node: string; frame: HTMLCanvasElement } | null = null;
    let releaseTransition = () => {};
    let stopListening = () => {};
    return {
        listen(root: HTMLElement, clips: Clip[], node: string, words: string, signal: AbortSignal, record: (event: string) => void = () => {}, archivePlayback = true) {
            stopListening();
            const clip = clips.find(c => c.id === 'CH2-LISTEN-STEADY');
            held = null;
            if (!clip || signal.aborted) return Promise.resolve();
            root.querySelector('main')?.setAttribute('inert', '');
            root.insertAdjacentHTML('beforeend', `<section class="grain-listener" aria-label="等待苟安回应" aria-busy="true"><video autoplay muted playsinline poster="${poster}" src="${esc(clip.src)}"></video><p>${esc(words)}</p><div class="grain-listener-controls"><span role="status" aria-live="polite">正在等待回应……</span><button data-action="cancel-speech">停止等待</button></div></section>`);
            root.querySelector<HTMLButtonElement>('.grain-listener [data-action="cancel-speech"]')?.focus();
            const video = root.querySelector<HTMLVideoElement>('.grain-listener video')!;
            const releaseHistory = archivePlayback ? trackWatchedFilm(video, clip) : () => {};
            record('listener-mounted');
            return new Promise<void>(resolve => {
                let finished = false;
                const finish = (reason: string) => {
                    if (finished) return;
                    finished = true;
                    clearTimeout(deadline);
                    video.pause();
                    releaseHistory();
                    if (!signal.aborted) {
                        const frame = captureCinematicFrame(video);
                        if (frame) held = { node, frame };
                    }
                    video.removeEventListener('ended', ended); video.removeEventListener('error', failed);
                    signal.removeEventListener('abort', aborted);
                    stopListening = () => {};
                    record('listener-' + reason);
                    resolve();
                };
                const ended = () => finish('ended'), failed = () => finish('error'), aborted = () => finish('aborted');
                const deadline = setTimeout(() => finish('media-timeout'), GRAIN_LISTENER_MAX_WAIT_MS);
                stopListening = () => finish('disposed');
                video.addEventListener('ended', ended, { once: true });
                video.addEventListener('error', failed, { once: true });
                signal.addEventListener('abort', aborted, { once: true });
                void video.play().catch(() => finish('play-failed'));
            });
        },
        disposeListening() { stopListening(); },
        mountReply(root: HTMLElement, node: string) {
            const scene = root.querySelector('.grain-reply .scene-image');
            if (!scene || held?.node !== node) return;
            // Reuse decoded pixels through menus and revisions. Reloads use the exported end frame.
            held.frame.className = 'scene-image grain-reply-frame';
            scene.replaceWith(held.frame);
        },
        transitionToFilm(frame: HTMLCanvasElement | null, video: HTMLVideoElement | null) {
            releaseTransition();
            if (!frame || !video) return;
            frame.className = 'cinema-transition-frame';
            releaseTransition = holdCinematicFrame(frame, video, () => video.isConnected);
        },
    };
}
