import { captureCinematicFrame, holdCinematicFrame, onCinematicFrame } from './cinematic-frame';
import { watchCinematicMedia, type CinematicDiagnostic } from './cinematic-diagnostics';
import { playbackRates, preferredPlaybackRate, savePlaybackRate } from './playback-preference';
import { FILM_AUDIO_EVENT, FILM_AUDIO_KEY, readFilmAudio, saveFilmAudio } from './film-audio';
import { mountCinematicSubtitles } from './cinematic-subtitles';
export type Clip = { id: string; src: string; title: string; subtitles?: string; poster?: string };
export type Cinematics = { opening: Clip[]; execution: Clip[]; safe: Clip[]; sacrifice?: Clip[] };
type Active = { key: string; index: number; time: number; rate: number };
type Progress = { version: string; completed: string[]; active: Active | null };
const KEY = 'wuzhang-cinematics-v1';
const rates: readonly number[] = playbackRates;
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const clock = (time: number) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
/** Playback progress has no access to narrative state, evidence, actions, or AI. */
export class CinematicPlayer {
    private progress: Progress;
    private mounted: { key: string; index: number; host: HTMLElement; video: HTMLVideoElement; release: () => void } | null = null;
    private still: { key: string; host: HTMLElement; release: () => void } | null = null;
    private prepared: { src: string; video: HTMLVideoElement } | null = null;
    private handoff: { frame: HTMLCanvasElement; muted: boolean } | null = null;
    private diagnostics: CinematicDiagnostic[] = [];
    constructor(private version: string, private storageKey = KEY, private menuEnabled = false, private mutedAutoplayFallback = true) {
        this.progress = { version, completed: [], active: null };
        try {
            const p = JSON.parse(localStorage.getItem(this.storageKey) ?? 'null');
            preferredPlaybackRate(p?.active?.rate);
            if (p?.version === version && Array.isArray(p.completed) && p.completed.every((id: unknown) => typeof id === 'string')) {
                this.progress.completed = p.completed;
                const a = p.active;
                if (a && typeof a.key === 'string' && Number.isInteger(a.index) && a.index >= 0 && Number.isFinite(a.time) && a.time >= 0 && rates.includes(a.rate)) this.progress.active = a;
            }
        } catch { /* Playback can continue even when storage is unavailable. */ }
    }
    private persist() { try { localStorage.setItem(this.storageKey, JSON.stringify(this.progress)); } catch { /* Keep playback usable. */ } }
    done(key: string) { return this.progress.completed.includes(key); }
    getDiagnostics() { return this.diagnostics.map(record => ({ ...record })); }
    /** Only preload a single successor already determined by the chapter. Never starts playback. */
    prepareNext(clip?: Clip) {
        if (clip?.src === this.prepared?.src) return;
        if (this.prepared) { this.prepared.video.removeAttribute('src'); this.prepared.video.load(); this.prepared = null; }
        if (!clip) return;
        const video = document.createElement('video'); video.preload = 'auto'; video.playsInline = true;
        if (clip.poster) video.poster = clip.poster;
        video.src = clip.src; video.load(); this.prepared = { src: clip.src, video };
    }
    resetPlayback() {
        this.dispose();
        this.progress.active = null;
        this.persist();
    }
    forget(key: string) {
        if (!this.done(key)) return;
        this.progress.completed = this.progress.completed.filter(id => id !== key);
        this.persist();
    }
    dispose(preserveFrame = false, preservePrepared = false) {
        this.still?.release(); this.still = null;
        if (this.mounted) {
            const frame = captureCinematicFrame(this.mounted.video);
            if (frame) {
                const handoff = { frame, muted: this.mounted.video.muted }; this.handoff = handoff;
                // Only a synchronous successor may inherit the picture, never a later menu/new game.
                queueMicrotask(() => { if (this.handoff === handoff) this.handoff = null; });
            }
            const old = this.mounted;
            old.video.pause(); old.release(); this.mounted = null;
            // Story films may await an explicit action after playback. Keep their decoded
            // picture on screen while releasing the decoder; a synchronous next film reuses it.
            if (preserveFrame && frame) old.video.after(frame);
            // Release the decoder and range request after capturing the handoff frame.
            // Paused, detached videos otherwise retain resources across a long chapter.
            old.video.removeAttribute('src'); old.video.load(); old.video.remove();
        }
        if (this.prepared && !preservePrepared) {
            this.prepared.video.removeAttribute('src'); this.prepared.video.load(); this.prepared = null;
        }
    }
    /** A still illustrates an earned outcome without playing or advancing narrative state. */
    mountStill(host: HTMLElement, key: string, picture: { src: string; alt: string }, finish: () => void) {
        if (this.still?.key === key && this.still.host === host && host.querySelector('.ending-still')) return;
        this.dispose(); this.handoff = null;
        this.progress.active = { key, index: 0, time: 0, rate: preferredPlaybackRate() }; this.persist();
        host.innerHTML = `<main class="ending-still" aria-label="${escape(picture.alt)}"><img src="${escape(picture.src)}" alt="${escape(picture.alt)}"><div class="ending-still-footer"><p role="status" hidden>画面暂时无法载入，可以继续。</p><button type="button" data-cinema-still-continue>继续 <span aria-hidden="true">→</span></button></div></main>`;
        const events = new AbortController();
        this.still = { key, host, release: () => events.abort() };
        const image = host.querySelector('img')!;
        const failed = () => { host.querySelector<HTMLElement>('[role=status]')!.hidden = false; };
        image.addEventListener('error', failed, { signal: events.signal });
        if (image.complete && !image.naturalWidth) failed();
        const button = host.querySelector<HTMLButtonElement>('[data-cinema-still-continue]')!;
        button.addEventListener('click', event => {
            event.stopPropagation();
            if (this.still?.key !== key || this.still.host !== host) return;
            this.progress.completed = [...new Set([...this.progress.completed, key])];
            this.progress.active = null; this.persist(); this.dispose(); finish();
        }, { signal: events.signal });
        button.focus({ preventScroll: true });
    }
    mount(host: HTMLElement, key: string, clips: Clip[], kind: string, finish: (skipped?: boolean) => void) {
        if (this.mounted?.key === key && this.mounted.index === this.progress.active?.index && this.mounted.host === host && this.mounted.video.isConnected) return;
        if (this.progress.active?.key !== key) this.progress.active = { key, index: 0, time: 0, rate: preferredPlaybackRate() };
        const active = this.progress.active!;
        active.rate = preferredPlaybackRate();
        if (active.index >= clips.length) { active.index = 0; active.time = 0; }
        const resumeTime = active.time;
        const prepared = this.prepared?.src === clips[active.index]?.src ? this.prepared.video : null;
        if (prepared) this.prepared = null;
        this.dispose();
        const handoff = this.handoff; this.handoff = null;
        this.persist();
        const clip = clips[active.index];
        host.innerHTML = `<main class="cinema-screen" data-cinematic="${escape(kind)}" data-media-state="loading" ${kind === 'safe' ? 'data-campaign="video"' : ''}>${this.menuEnabled ? '<button class="cinema-menu" data-action="pause">菜单</button>' : ''}<section class="cinema-frame" aria-label="${escape(clip?.title ?? '剧情动画')}"><video id="ending-video" autoplay playsinline preload="auto"></video><div class="cinema-controls" aria-label="视频控制"><button type="button" data-cinema-action="toggle" aria-label="播放或暂停">播放</button><button type="button" data-cinema-action="sound" aria-pressed="false">静音</button><label class="cinema-volume"><span>音量</span><input type="range" min="0" max="100" step="1" aria-label="影片音量"><output></output></label><button type="button" data-cinema-action="retry" hidden>重试播放</button><span class="cinema-time">0:00 / 0:00</span><input class="cinema-seek" type="range" min="0" max="0" value="0" step="0.1" aria-label="视频进度" disabled><div class="cinema-rates" aria-label="播放倍速">${rates.map(rate=>`<button type="button" data-cinema-rate="${rate}" aria-pressed="${rate === active.rate}">${rate}×</button>`).join('')}</div><button type="button" data-cinema-action="skip">跳过动画</button></div><p id="video-status" class="video-status" role="status">${clip ? '正在载入动画……' : '动画尚未提供，可以跳过继续。'}</p></section></main>`;
        const placeholder = host.querySelector<HTMLVideoElement>('video')!;
        const video = prepared ?? placeholder;
        if (prepared) { prepared.id = 'ending-video'; placeholder.replaceWith(prepared); }
        else if (clip) video.src = clip.src;
        if (clip?.poster) video.poster = clip.poster;
        video.defaultPlaybackRate = active.rate;
        video.playbackRate = active.rate;
        let firstFrame = false, failed = false;
        const subtitles = mountCinematicSubtitles(video, clip?.subtitles);
        const filmAudio = readFilmAudio();
        video.volume = filmAudio.volume / 100;
        video.muted = filmAudio.muted || filmAudio.volume === 0 || (handoff?.muted ?? false);
        const seek = host.querySelector<HTMLInputElement>('.cinema-seek')!, play = host.querySelector<HTMLButtonElement>('[data-cinema-action=toggle]')!, time = host.querySelector<HTMLElement>('.cinema-time')!, status = host.querySelector<HTMLElement>('#video-status')!;
        this.mounted = { key, index: active.index, host, video, release: () => {} };
        const current = () => this.mounted?.video === video && video.isConnected && this.progress.active?.key === key;
        const diagnostic = watchCinematicMedia(video, clip?.id ?? key, record => {
            this.diagnostics.push(record); if (this.diagnostics.length > 240) this.diagnostics.shift();
            host.dispatchEvent(new CustomEvent('cinema-diagnostic', { detail: { ...record } }));
        });
        const releaseHold = holdCinematicFrame(handoff?.frame ?? null, video, current);
        const screen = host.querySelector<HTMLElement>('.cinema-screen')!;
        const retry = host.querySelector<HTMLButtonElement>('[data-cinema-action=retry]')!;
        const mediaFailure = () => {
            if (!current()) return;
            failed = true; video.pause();
            subtitles.hide();
            screen.dataset.mediaState = 'error'; retry.hidden = false;
            status.textContent = '视频暂时无法载入，可重试或跳过继续。';
        };
        const releaseFirstFrame = onCinematicFrame(video, current, () => {
            if (failed) return;
            firstFrame = true; screen.dataset.mediaState = 'ready';
            subtitles.show();
            diagnostic.record('first-frame'); soundStatus();
        });
        const next = clips[active.index + 1];
        if (next) {
            this.prepareNext(next);
        }
        const sound = host.querySelector<HTMLButtonElement>('[data-cinema-action=sound]')!;
        const volume = host.querySelector<HTMLInputElement>('.cinema-volume input')!;
        const volumeOutput = host.querySelector<HTMLOutputElement>('.cinema-volume output')!;
        const soundStatus = () => {
            if (!current() || failed) return;
            const silent = video.muted || video.volume === 0;
            sound.textContent = silent ? '开启声音' : '静音';
            sound.setAttribute('aria-label', silent ? '开启影片声音' : '静音影片');
            sound.setAttribute('aria-pressed', String(silent));
            volume.value = String(Math.round(video.volume * 100)); volumeOutput.value = volume.value + '%';
            // The sound button already exposes mute state; a permanent notice would cover cues.
            if (firstFrame && !video.paused) status.textContent = '';
        };
        const syncAudio = () => { if (!current()) return; const preference = readFilmAudio(); video.volume = preference.volume / 100; video.muted = preference.muted || preference.volume === 0; soundStatus(); };
        const syncStoredAudio = (event: StorageEvent) => { if (event.key === FILM_AUDIO_KEY || event.key === null) syncAudio(); };
        window.addEventListener(FILM_AUDIO_EVENT, syncAudio);
        window.addEventListener('storage', syncStoredAudio);
        const update = () => {
            if (!current() || failed) return;
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            seek.disabled = duration <= 0; seek.max = String(duration); seek.value = String(video.currentTime);
            time.textContent = `${clock(video.currentTime)} / ${clock(duration)}`; play.textContent = video.paused ? '播放' : '暂停';
            if (video.readyState >= 1) { active.time = video.currentTime; active.rate = video.playbackRate; } this.persist();
        };
        let resumeAfterVisibility = false;
        const attemptPlay = async () => {
            if (!current() || failed) return;
            if (document.hidden) { resumeAfterVisibility = true; return; }
            try { await video.play(); }
            catch (error) {
                if (!current() || failed) return;
                // Fresh browser visits can reject audible autoplay; keep the film moving.
                if (this.mutedAutoplayFallback && error instanceof DOMException && error.name === 'NotAllowedError' && !video.muted) {
                    video.muted = true;
                    try { await video.play(); soundStatus(); return; }
                    catch { /* Retain manual playback and skip if muted playback is also blocked. */ }
                }
                if (video.error) mediaFailure();
                else if (current()) { status.textContent = '点击播放，开始观看影片'; play.textContent = '播放影片'; screen.dataset.mediaState = 'blocked'; }
            }
        };
        const complete = (skipped = false) => {
            if (!current() || (failed && !skipped)) return;
            screen.dataset.mediaState = skipped ? 'skipped' : 'ended';
            this.progress.completed = [...new Set([...this.progress.completed, key])]; this.progress.active = null; this.persist(); this.dispose(kind === 'story', true); finish(skipped);
        };
        host.querySelector('[data-cinema-action=toggle]')!.addEventListener('click', e => { e.stopPropagation(); if (video.paused) void attemptPlay(); else video.pause(); });
        sound.addEventListener('click', e => {
            e.stopPropagation(); if (!current()) return;
            const silent = video.muted || video.volume === 0;
            saveFilmAudio({ muted: !silent, volume: silent && video.volume === 0 ? 100 : Math.round(video.volume * 100) });
        });
        volume.addEventListener('input', e => { e.stopPropagation(); saveFilmAudio({ volume: Number(volume.value), muted: Number(volume.value) === 0 }); });
        retry.addEventListener('click', e => {
            e.stopPropagation(); if (!current()) return;
            const muted = video.muted;
            this.dispose(false, true); this.mount(host, key, clips, kind, finish);
            if (this.mounted) this.mounted.video.muted = muted;
        });
        host.querySelector('[data-cinema-action=skip]')!.addEventListener('click', e => { e.stopPropagation(); complete(true); });
        for (const button of Array.from(host.querySelectorAll<HTMLButtonElement>('[data-cinema-rate]'))) button.addEventListener('click', e => {
            e.stopPropagation();
            const rate = Number(button.dataset.cinemaRate);
            savePlaybackRate(rate); active.rate = rate;
            video.defaultPlaybackRate = rate; video.playbackRate = rate;
            for (const b of Array.from(host.querySelectorAll<HTMLButtonElement>('[data-cinema-rate]'))) b.setAttribute('aria-pressed', String(b === button)); update();
        });
        seek.addEventListener('input', e => { e.stopPropagation(); if (Number.isFinite(video.duration)) video.currentTime = Math.min(video.duration, Math.max(0, Number(seek.value))); update(); });
        const restore = () => { if (!current()) return; video.defaultPlaybackRate = video.playbackRate = preferredPlaybackRate(); if (resumeTime > 0) video.currentTime = Math.min(resumeTime, Math.max(0, video.duration - .05)); update(); };
        video.addEventListener('loadedmetadata', restore);
        if (video.readyState >= 1) restore();
        video.addEventListener('timeupdate', update); video.addEventListener('play', update); video.addEventListener('pause', update);
        video.addEventListener('playing', soundStatus); video.addEventListener('volumechange', soundStatus);
        video.addEventListener('waiting', () => { if (current() && !failed) { screen.dataset.mediaState = 'loading'; status.textContent = '正在载入动画……'; } });
        video.addEventListener('playing', () => { if (current() && !failed && firstFrame) screen.dataset.mediaState = 'ready'; });
        video.addEventListener('error', mediaFailure);
        video.addEventListener('ended', () => {
            if (!current() || failed) return;
            if (document.hidden) { resumeAfterVisibility = false; status.textContent = '影片已播完，可重看或跳过继续。'; return; }
            if (active.index + 1 < clips.length) { active.index++; active.time = 0; this.persist(); this.mount(host, key, clips, kind, finish); }
            else complete();
        });
        const pauseInBackground = () => {
            if (!current()) return;
            resumeAfterVisibility ||= !video.paused && !video.ended;
            video.pause(); update();
        };
        const visibility = () => {
            if (document.hidden) pauseInBackground();
            else if (resumeAfterVisibility && current() && !video.closest('[inert]')) { resumeAfterVisibility = false; void attemptPlay(); }
        };
        const guardBackgroundPlay = () => { if (document.hidden && current()) { resumeAfterVisibility = true; video.pause(); } };
        document.addEventListener('visibilitychange', visibility);
        window.addEventListener('pagehide', pauseInBackground);
        window.addEventListener('pageshow', visibility);
        video.addEventListener('play', guardBackgroundPlay);
        this.mounted.release = () => {
            releaseHold(); releaseFirstFrame(); diagnostic.dispose(); subtitles.dispose();
            window.removeEventListener(FILM_AUDIO_EVENT, syncAudio); window.removeEventListener('storage', syncStoredAudio);
            document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pauseInBackground); window.removeEventListener('pageshow', visibility);
            video.removeEventListener('play', guardBackgroundPlay);
        };
        soundStatus();
        if (clip) void attemptPlay();
        else play.disabled = true;
    }
}
