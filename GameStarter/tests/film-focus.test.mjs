import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function fixture() {
    const document = Object.assign(new EventTarget(), { hidden: false, documentElement: {}, querySelector: () => null });
    const window = new EventTarget(), values = new Map(), sources = [], requests = [];
    const localStorage = { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    class FakeAudioContext {
        state = 'running'; currentTime = 0; destination = {};
        createGain() { const gain = { value: 1, cancelScheduledValues() {}, cancelAndHoldAtTime() {}, setValueAtTime(value) { this.value = value; }, linearRampToValueAtTime(value) { this.value = value; } }; return { gain, connect() {}, disconnect() {} }; }
        createBufferSource() { const source = { loop: false, loopStart: 0, loopEnd: 0, starts: [], stops: [], connect() {}, disconnect() {}, start(...args) { this.starts.push(args); }, stop(...args) { this.stops.push(args); } }; sources.push(source); return source; }
        resume() { this.state = 'running'; return Promise.resolve(); }
        suspend() { this.state = 'suspended'; return Promise.resolve(); }
        decodeAudioData() { return Promise.resolve({ duration: 10 }); }
    }
    const manifest = { sfx: { ui_click_a: '/sfx/click.wav' }, music: { home: { src: '/home.wav', loopStart: 4, loopEnd: 10 }, round1: { src: '/round1.wav', loopStart: 0, loopEnd: 10 } } };
    const sandbox = vm.createContext({ document, window, localStorage, AudioContext: FakeAudioContext, MutationObserver: class { constructor(callback) { document.syncFilm = callback; } observe() {} }, Event, CustomEvent, performance, queueMicrotask,
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

test('remote film owns sound until lease ends',async()=>{
 const {audio,values,window}=fixture();await settle();audio.setMusic('home');await settle();audio.context.currentTime=3;
 values.set('wzy-film-focus:test',String(Date.now()+6000));window.dispatchEvent(new Event('wzy-film-focus'));await settle();assert.equal(audio.musicVoices.size,0);
 audio.setVolume('music',80);await settle();assert.equal(audio.musicVoices.size,0);
 values.set('wzy-film-focus:test',String(Date.now()-1));window.dispatchEvent(new Event('wzy-film-focus'));await settle();assert.equal(audio.musicVoices.size,1);assert.deepEqual(Array.from(audio.musicVoice.source.starts[0]),[0,3]);
});
