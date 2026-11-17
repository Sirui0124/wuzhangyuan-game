export type Sound = 'ui_click_a' | 'ui_click_b' | 'dialogue_next' | 'panel_open' | 'panel_close' | 'paper_turn' | 'evidence_select' | 'evidence_present' | 'evidence_gain' | 'submit' | 'ui_warning' | 'response_ready';
import { readFilmAudio, saveFilmAudio } from './film-audio';
export type Music = 'home' | 'round1' | 'round2' | 'weiyan';
export type AudioBus = 'music' | 'sfx' | 'film';
type Track = { src: string; loopStart?: number; loopEnd?: number };
type AudioManifest = { sfx: Partial<Record<Sound, string>>; music: Partial<Record<Music, Track | null>> };
const KEY = 'wuzhang-audio-v1';
const defaults = { music: 35, sfx: 45 };
const MUSIC_FADE_SECONDS = 2.5;
const priority = (sound: Sound) => sound === 'evidence_gain' ? 30 : sound === 'ui_warning' ? 25 : ['submit', 'evidence_present', 'response_ready'].includes(sound) ? 20 : sound === 'dialogue_next' ? 1 : 10;
export const volumeLabel = (value: number) => value === 0 ? '静音' : `${value}%`;

/** Independent preferences survive saves/restarts. Audio failure never blocks gameplay. */
export class GameAudio {
    private volumes = { ...defaults };
    private context: AudioContext | null = null;
    private sfxGain: GainNode | null = null;
    private musicGain: GainNode | null = null;
    private buffers = new Map<string, Promise<AudioBuffer | null>>();
    private readyBuffers = new Map<string, AudioBuffer>();
    private manifest: AudioManifest = { sfx: {}, music: {} };
    private unlocked = false;
    private pending: Sound | null = null;
    private voices = new Set<AudioBufferSourceNode>();
    private lastSoundAt = -Infinity;
    private effectsEpoch = 0;
    private desiredMusic: Music | null = null;
    private musicVoice: { id: Music; source: AudioBufferSourceNode; gain: GainNode; startedAt: number; offset: number } | null = null;
    private musicVoices = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();
    private musicRequest = 0;
    private musicPaused = false;
    private pageInactive = document.hidden;
    private musicPosition: { id: Music; offset: number } | null = null;
    private cachedMusic: { src: string; promise: Promise<AudioBuffer | null> } | null = null;

    constructor() {
        try {
            const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null');
            for (const bus of ['music', 'sfx'] as const) {
                if (typeof stored?.[bus] === 'number' && Number.isFinite(stored[bus])) this.volumes[bus] = Math.round(Math.min(100, Math.max(0, stored[bus])));
            }
        } catch { /* use quiet defaults */ }
        try {
            this.context = new AudioContext();
            // Start immediately when browser autoplay policy already permits audio.
            this.unlocked = this.context.state === 'running';
            this.sfxGain = this.context.createGain(); this.musicGain = this.context.createGain();
            this.sfxGain.connect(this.context.destination); this.musicGain.connect(this.context.destination);
            this.applyVolume('sfx', true); this.applyVolume('music', true);
        } catch { /* unsupported/blocked audio stays silent */ }
        void fetch('/audio/manifest.json').then(r => { if (!r.ok) throw new Error('Audio unavailable'); return r.json(); }).then((m: AudioManifest) => {
            this.manifest = m;
            for (const src of Object.values(m.sfx)) if (src) void this.buffer(src);
            void this.updateMusic();
        }).catch(() => {});
        document.addEventListener('pointerdown', () => this.unlock(), { capture: true });
        document.addEventListener('keydown', () => this.unlock(), { capture: true });
        const visibility = () => {
            this.pageInactive = document.hidden;
            this.effectsEpoch++;
            this.pending = null;
            if (this.pageInactive) { this.stopEffects(); this.parkMusic(); void this.context?.suspend().catch(() => {}); }
            else if (this.unlocked) void this.context?.resume().then(() => this.updateMusic()).catch(() => {});
            this.applyVolume('sfx'); this.applyVolume('music');
        };
        document.addEventListener('visibilitychange', visibility);
        window.addEventListener('pagehide', () => { this.pageInactive = true; this.effectsEpoch++; this.pending = null; this.stopEffects(); this.parkMusic(); void this.context?.suspend().catch(() => {}); });
        window.addEventListener('pageshow', visibility);
    }
    volume(bus: AudioBus) { return bus === 'film' ? readFilmAudio().volume : this.volumes[bus]; }
    setVolume(bus: AudioBus, value: number) {
        if (!Number.isFinite(value)) return;
        if (bus === 'film') { saveFilmAudio({ volume: value, muted: value <= 0 }); return; }
        this.volumes[bus] = Math.round(Math.max(0, Math.min(100, value)));
        this.applyVolume(bus);
        if (bus === 'sfx' && !this.volumes.sfx) { this.effectsEpoch++; this.pending = null; this.stopEffects(); }
        if (bus === 'music') { if (!this.volumes.music) this.parkMusic(); else void this.updateMusic(); }
        try { localStorage.setItem(KEY, JSON.stringify(this.volumes)); } catch { /* retain in memory */ }
    }
    private applyVolume(bus: 'music' | 'sfx', immediate = false) {
        const gain = bus === 'music' ? this.musicGain : this.sfxGain, ctx = this.context;
        if (!gain || !ctx) return;
        const value = this.pageInactive || (bus === 'music' && this.musicPaused) ? 0 : this.volumes[bus] / 100 * (bus === 'sfx' ? .65 : .6);
        gain.gain.cancelScheduledValues(ctx.currentTime);
        if (value === 0) { gain.gain.value = 0; gain.gain.setValueAtTime(0, ctx.currentTime); return; }
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        if (immediate) gain.gain.setValueAtTime(value, ctx.currentTime);
        else gain.gain.linearRampToValueAtTime(value, ctx.currentTime + .025);
    }
    private unlock() {
        if (this.pageInactive) return;
        this.unlocked = true;
        if (this.context?.state === 'suspended') void this.context.resume().then(() => this.updateMusic()).catch(() => {});
        else void this.updateMusic();
    }
    private buffer(src: string, music = false): Promise<AudioBuffer | null> {
        if (!this.context) return Promise.resolve(null);
        if (music) {
            if (this.cachedMusic?.src !== src) {
                const ctx = this.context;
                this.cachedMusic = { src, promise: fetch(src).then(r => { if (!r.ok) throw new Error('Missing music'); return r.arrayBuffer(); }).then(data => ctx.decodeAudioData(data)).catch(() => null) };
            }
            return this.cachedMusic.promise;
        }
        if (!this.buffers.has(src)) {
            const ctx = this.context;
            this.buffers.set(src, fetch(src).then(r => { if (!r.ok) throw new Error('Missing audio'); return r.arrayBuffer(); }).then(data => ctx.decodeAudioData(data)).then(b => {
                this.readyBuffers.set(src, b); return b;
            }).catch(() => null));
        }
        return this.buffers.get(src)!;
    }
    play(sound: Sound) {
        if (!this.unlocked || !this.volumes.sfx || this.pageInactive) return;
        // One operation may advance dialogue AND grant evidence; keep the richer cue only.
        if (this.pending) { if (priority(sound) > priority(this.pending)) this.pending = sound; return; }
        this.pending = sound;
        const epoch = this.effectsEpoch, requestedAt = performance.now();
        queueMicrotask(async () => {
            const next = this.pending; this.pending = null;
            if (!next) return;
            const ctx = this.context, buffer = this.readyBuffers.get(this.manifest.sfx[next] ?? '');
            // The very first pointer gesture may still be resolving resume at click time.
            if (ctx?.state === 'suspended') await ctx.resume().catch(() => {});
            // Do not replay clicks late when decoding finishes or the browser unlocks.
            if (!ctx || ctx.state !== 'running' || !buffer || !this.sfxGain || epoch !== this.effectsEpoch || performance.now() - requestedAt > 120 || !this.volumes.sfx || this.pageInactive || ctx.currentTime - this.lastSoundAt < .085) return;
            this.lastSoundAt = ctx.currentTime;
            if (this.voices.size >= 2) { const oldest = this.voices.values().next().value; oldest?.stop(); if (oldest) this.voices.delete(oldest); }
            const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(this.sfxGain);
            this.voices.add(source);
            source.onended = () => { this.voices.delete(source); source.disconnect(); };
            source.start();
        });
    }
    action(action: string) {
        if (['next', 'submit', 'present', 'generate-polish'].includes(action)) return;
        if (['settings', 'save', 'help', 'records', 'logic', 'new-confirm', 'restart-confirm', 'retry-ending', 'ending-collection', 'evidence', 'browse-evidence', 'reply-evidence', 'open-composer'].includes(action)) this.play('panel_open');
        else if (['close', 'close-composer', 'back', 'return-game'].includes(action)) this.play('panel_close');
        else if (['tab', 'inspect-evidence'].includes(action)) this.play('paper_turn');
        else if (['toggle-evidence', 'reply-clue'].includes(action)) this.play('evidence_select');
        else this.play('ui_click_a');
    }
    private stopEffects() { for (const voice of this.voices) voice.stop(); this.voices.clear(); }
    private parkMusic() {
        this.musicRequest++;
        const voice = this.musicVoice;
        if (voice && this.context) {
            const elapsed = voice.offset + Math.max(0, this.context.currentTime - voice.startedAt);
            const start = voice.source.loopStart, end = voice.source.loopEnd;
            this.musicPosition = { id: voice.id, offset: elapsed < end ? elapsed : start + (elapsed - end) % (end - start) };
        }
        for (const voice of this.musicVoices) { voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); }
        this.musicVoices.clear(); this.musicVoice = null;
    }
    /** Films own the soundtrack: stop loops/fades and invalidate pending music loads. */
    setMusicPaused(paused: boolean) {
        if (paused === this.musicPaused) return;
        this.musicPaused = paused;
        this.applyVolume('music');
        if (paused) this.parkMusic();
        else void this.updateMusic();
    }
    setMusic(id: Music | null) {
        if (id === this.desiredMusic) return;
        this.desiredMusic = id; this.musicRequest++; this.musicPosition = null;
        if (!id) this.cachedMusic = null;
        void this.updateMusic();
    }
    private async updateMusic() {
        const ctx = this.context, id = this.desiredMusic, track = id ? this.manifest.music[id] : null;
        if (!ctx || !this.musicGain || this.musicPaused || this.pageInactive || !this.volumes.music) return;
        if (!track || !id) { this.fadeMusic(); return; }
        if (!this.unlocked || ctx.state !== 'running' || this.musicVoice?.id === id) return;
        const request = this.musicRequest, buffer = await this.buffer(track.src, true);
        if (!buffer || this.musicPaused || this.pageInactive || !this.volumes.music || request !== this.musicRequest || this.desiredMusic !== id || this.musicVoice?.id === id) return;
        this.fadeMusic();
        const source = ctx.createBufferSource(), gain = ctx.createGain();
        source.buffer = buffer; source.loop = true;
        const start = Math.min(Math.max(0, track.loopStart ?? 0), Math.max(0, buffer.duration - .01));
        source.loopStart = start; source.loopEnd = Math.min(buffer.duration, Math.max(start + .01, track.loopEnd ?? buffer.duration));
        source.connect(gain); gain.connect(this.musicGain);
        gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.linearRampToValueAtTime(1, ctx.currentTime + MUSIC_FADE_SECONDS);
        const voice = { source, gain }; this.musicVoices.add(voice);
        source.onended = () => { this.musicVoices.delete(voice); source.disconnect(); gain.disconnect(); };
        // Play the opening once; later wraps use the configured loopStart.
        const offset = this.musicPosition?.id === id ? Math.min(this.musicPosition.offset, buffer.duration - .01) : 0;
        this.musicPosition = null;
        this.musicVoice = { id, source, gain, startedAt: ctx.currentTime, offset }; source.start(0, offset);
    }
    private fadeMusic() {
        if (!this.musicVoice || !this.context) return;
        const { source, gain } = this.musicVoice, now = this.context.currentTime;
        this.musicVoice = null;
        // Hold the actual point on an interrupted fade-in before fading out.
        gain.gain.cancelAndHoldAtTime(now); gain.gain.linearRampToValueAtTime(0, now + MUSIC_FADE_SECONDS);
        source.stop(now + MUSIC_FADE_SECONDS);
    }
}
