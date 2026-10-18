export type Clip = { id: string; src: string; title: string };
export type Cinematics = { opening: Clip[]; execution: Clip[]; safe: Clip[]; sacrifice?: Clip[] };
type Active = { key: string; index: number; time: number; rate: number };
type Progress = { version: string; completed: string[]; active: Active | null };
const KEY = 'wuzhang-cinematics-v1';
const rates = [1, 1.5, 2];
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const clock = (time: number) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
/** Playback progress has no access to narrative state, evidence, actions, or AI. */
export class CinematicPlayer {
    private progress: Progress;
    private mounted: { key: string; host: HTMLElement; video: HTMLVideoElement } | null = null;
    constructor(private version: string) {
        this.progress = { version, completed: [], active: null };
        try {
            const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
            if (p?.version === version && Array.isArray(p.completed) && p.completed.every((id: unknown) => typeof id === 'string')) {
                this.progress.completed = p.completed;
                const a = p.active;
                if (a && typeof a.key === 'string' && Number.isInteger(a.index) && a.index >= 0 && Number.isFinite(a.time) && a.time >= 0 && rates.includes(a.rate)) this.progress.active = a;
            }
        } catch { /* Playback can continue even when storage is unavailable. */ }
    }
    private persist() { try { localStorage.setItem(KEY, JSON.stringify(this.progress)); } catch { /* Keep playback usable. */ } }
    done(key: string) { return this.progress.completed.includes(key); }
    dispose() { this.mounted?.video.pause(); this.mounted = null; }
    mount(host: HTMLElement, key: string, clips: Clip[], kind: string, finish: () => void) {
        if (this.mounted?.key === key && this.mounted.host === host && this.mounted.video.isConnected) return;
        this.dispose();
        if (this.progress.active?.key !== key) this.progress.active = { key, index: 0, time: 0, rate: 1 };
        const active = this.progress.active!;
        const resumeTime = active.time, resumeRate = active.rate;
        if (active.index >= clips.length) { active.index = 0; active.time = 0; }
        this.persist();
        const clip = clips[active.index];
        host.innerHTML = `<main class="cinema-screen" data-cinematic="${escape(kind)}" ${kind === 'safe' ? 'data-campaign="video"' : ''}><section class="cinema-frame" aria-label="${escape(clip?.title ?? '剧情动画')}"><video id="ending-video" autoplay playsinline preload="auto" ${clip ? `src="${escape(clip.src)}"` : ''}></video><div class="cinema-controls" aria-label="视频控制"><button type="button" data-cinema-action="toggle" aria-label="播放或暂停">播放</button><button type="button" data-cinema-action="sound" hidden>开启声音</button><span class="cinema-time">0:00 / 0:00</span><input class="cinema-seek" type="range" min="0" max="0" value="0" step="0.1" aria-label="视频进度" disabled><div class="cinema-rates" aria-label="播放倍速">${rates.map(rate=>`<button type="button" data-cinema-rate="${rate}" aria-pressed="${rate === active.rate}">${rate}×</button>`).join('')}</div><button type="button" data-cinema-action="skip">跳过动画</button></div><p id="video-status" class="video-status" role="status">${clip ? '正在载入动画……' : '动画尚未提供，可以跳过继续。'}</p></section></main>`;
        const video = host.querySelector<HTMLVideoElement>('video')!, seek = host.querySelector<HTMLInputElement>('.cinema-seek')!, play = host.querySelector<HTMLButtonElement>('[data-cinema-action=toggle]')!, time = host.querySelector<HTMLElement>('.cinema-time')!, status = host.querySelector<HTMLElement>('#video-status')!;
        this.mounted = { key, host, video };
        const current = () => this.mounted?.video === video && video.isConnected && this.progress.active?.key === key;
        const sound = host.querySelector<HTMLButtonElement>('[data-cinema-action=sound]')!;
        const soundStatus = () => {
            if (!current()) return;
            sound.hidden = !video.muted;
            if (!video.paused) status.textContent = video.muted ? '动画已自动播放，点击「开启声音」听取对白。' : '';
        };
        const update = () => {
            if (!current()) return;
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            seek.disabled = duration <= 0; seek.max = String(duration); seek.value = String(video.currentTime);
            time.textContent = `${clock(video.currentTime)} / ${clock(duration)}`; play.textContent = video.paused ? '播放' : '暂停';
            if (video.readyState >= 1) { active.time = video.currentTime; active.rate = video.playbackRate; } this.persist();
        };
        const attemptPlay = async () => {
            if (!current()) return;
            try { await video.play(); }
            catch (error) {
                if (!current()) return;
                // Fresh browser visits can reject audible autoplay; keep the film moving.
                if (error instanceof DOMException && error.name === 'NotAllowedError' && !video.muted) {
                    video.muted = true;
                    try { await video.play(); soundStatus(); return; }
                    catch { /* Retain manual playback and skip if muted playback is also blocked. */ }
                }
                if (current()) status.textContent = video.error ? '视频无法载入，可以跳过继续。' : '浏览器暂停了自动播放，点击播放或跳过继续。';
            }
        };
        const complete = () => {
            if (!current()) return;
            this.progress.completed = [...new Set([...this.progress.completed, key])]; this.progress.active = null; this.persist(); this.dispose(); finish();
        };
        host.querySelector('[data-cinema-action=toggle]')!.addEventListener('click', e => { e.stopPropagation(); if (video.paused) void attemptPlay(); else video.pause(); });
        sound.addEventListener('click', e => { e.stopPropagation(); if (!current()) return; video.muted = false; soundStatus(); void attemptPlay(); });
        host.querySelector('[data-cinema-action=skip]')!.addEventListener('click', e => { e.stopPropagation(); complete(); });
        for (const button of Array.from(host.querySelectorAll<HTMLButtonElement>('[data-cinema-rate]'))) button.addEventListener('click', e => {
            e.stopPropagation(); video.playbackRate = Number(button.dataset.cinemaRate);
            for (const b of Array.from(host.querySelectorAll<HTMLButtonElement>('[data-cinema-rate]'))) b.setAttribute('aria-pressed', String(b === button)); update();
        });
        seek.addEventListener('input', e => { e.stopPropagation(); if (Number.isFinite(video.duration)) video.currentTime = Math.min(video.duration, Math.max(0, Number(seek.value))); update(); });
        video.addEventListener('loadedmetadata', () => { if (!current()) return; video.playbackRate = resumeRate; video.currentTime = Math.min(resumeTime, Math.max(0, video.duration - .05)); update(); });
        video.addEventListener('timeupdate', update); video.addEventListener('play', update); video.addEventListener('pause', update);
        video.addEventListener('playing', soundStatus); video.addEventListener('volumechange', soundStatus);
        video.addEventListener('error', () => { if (current()) status.textContent = '视频无法载入，可以跳过继续。'; });
        video.addEventListener('ended', () => {
            if (!current()) return;
            if (active.index + 1 < clips.length) { active.index++; active.time = 0; this.persist(); this.mounted = null; this.mount(host, key, clips, kind, finish); }
            else complete();
        });
        if (clip) void attemptPlay();
        else play.disabled = true;
    }
}
