import { AI_VOICE_ENABLED_KEY, readAiVoiceEnabled, saveAiVoiceEnabled } from './voice-preference';

export const voiceEndpoint = 'http://127.0.0.1:8787/api/game/tts';
export type VoiceTrack = { play(): void; stop(): void; finished: Promise<'ended' | 'cancelled' | 'unavailable'> };

/** 24 kHz signed little-endian PCM. HTTP chunks may split a sample or a JSON line. */
export class StreamingVoice {
    private context: AudioContext | null = null;
    private tracks = new Set<VoiceTrack>();
    private muted = !readAiVoiceEnabled();
    private receivedBytes = 0;
    diagnostics() { return { state: this.context?.state ?? 'not-created', time: this.context?.currentTime ?? 0, receivedBytes: this.receivedBytes, muted: this.muted, tracks: this.tracks.size }; }
    constructor(private notice: (text: string) => void) {
        document.addEventListener('pointerdown', () => this.unlock(), { capture: true });
        document.addEventListener('keydown', () => this.unlock(), { capture: true });
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); });
        window.addEventListener('pagehide', () => this.stop());
        window.addEventListener('storage', event => {
            if (event.key !== AI_VOICE_ENABLED_KEY && event.key !== null) return;
            this.muted = !readAiVoiceEnabled();
            if (this.muted) this.stop();
        });
    }
    unlock() {
        if (this.muted) return;
        try { this.context ??= new AudioContext(); void this.context.resume().catch(() => {}); } catch {}
    }
    stop() { for (const track of this.tracks) track.stop(); this.tracks.clear(); }
    setMuted(value: boolean) {
        this.muted = value; if (value) this.stop();
        saveAiVoiceEnabled(!value);
    }
    prepare(text: string, role: 'player' | 'weiyan', playing = false): VoiceTrack {
        const controller = new AbortController(), sources = new Set<AudioBufferSourceNode>();
        const queue: Float32Array[] = [];
        let stopped = false, nextTime = 0, odd: number | undefined, complete = false;
        let settle!: (result: 'ended' | 'cancelled' | 'unavailable') => void;
        const finished = new Promise<'ended' | 'cancelled' | 'unavailable'>(resolve => { settle = resolve; });
        const finishPlayback = () => {
            if (!stopped && complete && !sources.size && !queue.length) { this.tracks.delete(track); settle('ended'); }
        };
        const drain = () => {
            const ctx = this.context;
            if (!playing || stopped || !ctx || ctx.state !== 'running') return;
            while (queue.length) {
                const samples = queue.shift()!, buffer = ctx.createBuffer(1, samples.length, 24000);
                buffer.getChannelData(0).set(samples);
                const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(ctx.destination);
                nextTime = Math.max(nextTime, ctx.currentTime + 0.04); source.start(nextTime); nextTime += buffer.duration;
                sources.add(source); source.onended = () => { sources.delete(source); source.disconnect(); finishPlayback(); };
            }
        };
        const track: VoiceTrack = {
            finished,
            play: () => { playing = true; this.unlock(); void this.context?.resume().then(drain).catch(() => {}); },
            stop: () => { stopped = true; settle('cancelled'); controller.abort(); queue.length = 0; for (const source of sources) { source.stop(); source.disconnect(); } sources.clear(); this.tracks.delete(track); }
        };
        if (this.muted) { settle('unavailable'); return track; }
        this.tracks.add(track);
        const accept = (encoded: string) => {
            this.receivedBytes += atob(encoded).length;
            const raw = atob(encoded), bytes = new Uint8Array(raw.length + (odd === undefined ? 0 : 1));
            let offset = 0; if (odd !== undefined) bytes[offset++] = odd;
            for (let i = 0; i < raw.length; i++) bytes[offset + i] = raw.charCodeAt(i);
            odd = bytes.length % 2 ? bytes[bytes.length - 1] : undefined;
            const samples = new Float32Array(Math.floor(bytes.length / 2)), view = new DataView(bytes.buffer);
            for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
            if (samples.length) queue.push(samples); drain();
        };
        void (async () => {
            const response = await fetch(voiceEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, role }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50000)]) });
            if (!response.ok) throw new Error((await response.json()).error || '语音暂不可用');
            if (!response.body) throw new Error('语音流不可用');
            const reader = response.body.getReader(), decoder = new TextDecoder(); let pending = '', ended = false;
            while (true) {
                const { value, done } = await reader.read(); if (done) break;
                pending += decoder.decode(value, { stream: true });
                let split: number;
                while ((split = pending.indexOf('\n')) >= 0) {
                    const item = JSON.parse(pending.slice(0, split)); pending = pending.slice(split + 1);
                    if (item.error) throw new Error(item.error);
                    if (item.audio) accept(item.audio);
                    if (item.done) ended = true;
                }
            }
            if (!ended || odd !== undefined) throw new Error('语音流中断，可继续阅读文字。');
            complete = true;
            finishPlayback();
        })().catch(error => {
            if (!stopped) { settle('unavailable'); track.stop(); this.notice(error instanceof Error ? error.message : '语音暂不可用，可继续阅读文字。'); }
        });
        if (playing) track.play();
        return track;
    }
}

