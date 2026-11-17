import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function fixture() {
    const document = Object.assign(new EventTarget(), { hidden: false });
    const window = new EventTarget(), values = new Map(), sources = [], requests = [];
    const localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    class FakeAudioContext {
        state = 'running'; currentTime = 0; destination = {};
        createGain() { const gain = { value: 1, cancelScheduledValues() {}, cancelAndHoldAtTime() {}, setValueAtTime(value) { this.value = value; }, linearRampToValueAtTime(value) { this.value = value; } }; return { gain, connect() {}, disconnect() {} }; }
        createBufferSource() { const source = { loop: false, loopStart: 0, loopEnd: 0, starts: [], stops: [], connect() {}, disconnect() {}, start(...args) { this.starts.push(args); }, stop(...args) { this.stops.push(args); } }; sources.push(source); return source; }
        resume() { this.state = 'running'; return Promise.resolve(); }
        suspend() { this.state = 'suspended'; return Promise.resolve(); }
        decodeAudioData() { return Promise.resolve({ duration: 10 }); }
    }
    const manifest = { sfx: { ui_click_a: '/sfx/click.wav' }, music: { home: { src: '/home.wav', loopStart: 4, loopEnd: 10 }, round1: { src: '/round1.wav', loopStart: 0, loopEnd: 10 } } };
    const sandbox = vm.createContext({ document, window, localStorage, AudioContext: FakeAudioContext, Event, CustomEvent, performance, queueMicrotask,
        fetch: async src => { requests.push(src); return { ok: true, json: async () => manifest, arrayBuffer: async () => new ArrayBuffer(16) }; } });
    const modules = new Map();
    const load = name => {
        const file = resolve(name);
        if (modules.has(file)) return modules.get(file).exports;
        const module = { exports: {} }; modules.set(file, module);
        const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
        const execute = vm.runInContext(`(function(require,module,exports){${compiled}\n})`, sandbox, { filename: file });
        execute(specifier => load(resolve(dirname(file), specifier + '.ts')), module, module.exports);
        return module.exports;
    };
    const { GameAudio } = load('GameStarter/web-demo/src/audio.ts');
    return { audio: new GameAudio(), document, window, sources, requests, load, values };
}
const settle = async () => { for (let i = 0; i < 3; i++) await new Promise(ok => setImmediate(ok)); };

test('music pause resumes the same loop position rather than restarting the intro', async () => {
    const { audio } = fixture(); await settle();
    audio.setMusic('home'); await settle();
    audio.context.currentTime = 12.25;
    audio.setMusicPaused(true);
    assert.equal(audio.musicPosition.offset, 6.25);
    assert.equal(audio.musicVoices.size, 0);
    audio.context.currentTime = 30;
    audio.setMusicPaused(false); await settle();
    assert.deepEqual(Array.from(audio.musicVoice.source.starts[0]), [0, 6.25]);
});

test('backgrounding stops audio and preserves the offset; menu pause stays paused on return', async () => {
    const { audio, document } = fixture(); await settle();
    audio.setMusic('home'); await settle(); audio.context.currentTime = 3.5;
    document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(audio.musicVoices.size, 0); assert.equal(audio.context.state, 'suspended');
    audio.context.currentTime = 20; document.hidden = false; document.dispatchEvent(new Event('visibilitychange')); await settle();
    assert.equal(audio.musicVoice.offset, 3.5);
    audio.setMusicPaused(true); document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    document.hidden = false; document.dispatchEvent(new Event('visibilitychange')); await settle();
    assert.equal(audio.musicVoice, null); assert.equal(audio.musicPaused, true);
});

test('music finishing its decode after a film begins cannot start playing', async () => {
    const { audio } = fixture(); await settle();
    let finish; audio.buffer = () => new Promise(ok => { finish = ok; });
    audio.setMusic('home'); audio.setMusicPaused(true); finish({ duration: 10 }); await settle();
    assert.equal(audio.musicVoice, null); assert.equal(audio.musicVoices.size, 0);
});

test('only the current BGM is retained in the decode cache; effects remain separate', async () => {
    const { audio } = fixture(); await settle();
    audio.setMusic('home'); await settle(); assert.equal(audio.cachedMusic.src, '/home.wav');
    audio.setMusic('round1'); await settle(); assert.equal(audio.cachedMusic.src, '/round1.wav');
    assert.deepEqual(Array.from(audio.buffers.keys()), ['/sfx/click.wav']);
    assert.deepEqual(Array.from(audio.readyBuffers.keys()), ['/sfx/click.wav']);
});

test('muted music does not fetch a new BGM, and unmuting resumes playback', async () => {
    const { audio, requests } = fixture(); await settle();
    audio.setVolume('music', 0); audio.setMusic('round1'); await settle();
    assert.equal(requests.includes('/round1.wav'), false);
    audio.setVolume('music', 40); await settle(); assert.equal(audio.musicVoice.id, 'round1');
    audio.context.currentTime = 2; audio.setVolume('music', 0); audio.setVolume('music', 40); await settle();
    assert.equal(audio.musicVoice.offset, 2);
});

test('film volume persists independently and emits a live change without changing music', async () => {
    const { audio, window, load } = fixture(); await settle();
    const film = load('GameStarter/web-demo/src/film-audio.ts');
    let changes = 0; window.addEventListener(film.FILM_AUDIO_EVENT, () => changes++);
    audio.setVolume('film', 25); assert.equal(film.readFilmAudio().volume, 25); assert.equal(film.readFilmAudio().muted, false);
    audio.setVolume('film', 0); assert.equal(film.readFilmAudio().muted, true);
    assert.equal(audio.volume('music'), 35); assert.equal(changes, 2);
});

test('chapter mappings use existing music and suspend all BGM for films and explicit silent endings', () => {
    const { load } = fixture(), { chapterMusic, updateChapterAudio } = load('GameStarter/web-demo/src/chapter-audio.ts');
    assert.equal(chapterMusic('grain', { kind: 'line' }), 'round1');
    assert.equal(chapterMusic('grain', { kind: 'line' }, true), 'round2');
    assert.equal(chapterMusic('grain', { kind: 'open' }), 'weiyan');
    assert.equal(chapterMusic('jieting', { kind: 'line', act: 2 }), 'round2');
    assert.equal(chapterMusic('jieting', { kind: 'line', scene: 'jieting_masu_tent' }), 'weiyan');
    const calls = [], audio = { setMusic: value => calls.push(['music', value]), setMusicPaused: value => calls.push(['paused', value]) };
    updateChapterAudio(audio, 'grain', { kind: 'video' });
    updateChapterAudio(audio, 'jieting', { kind: 'ending' }, { silent: true });
    assert.deepEqual(calls, [['paused', true], ['paused', true]]);
});
