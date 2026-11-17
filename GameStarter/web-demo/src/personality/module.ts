import { loadPersonalityConfig, personalityNamespace } from './config.js';
import { createPersonalityStore } from './store.js';
import { createPersonalityAssessor, type PersonalityAssessmentInput } from './assess.js';
import type { AssessmentToken, PersonalityConfig, StoreOptions, Vector } from './types.js';

type OpenOptions = Omit<PersonalityAssessmentInput, 'chapterId' | 'nodeId' | 'input'>;
interface Envelope { checkpoint: unknown; sources: Record<string, PersonalityAssessmentInput> }

/** The narrative owns progress; this adapter only observes committed player actions. */
export async function createPersonalityTracker(chapterId: string, options: {
    enabled?: () => boolean;
    onSettled?: () => void;
    config?: PersonalityConfig;
    storage?: StoreOptions['storage'];
    namespace?: string;
    assess?: ReturnType<typeof createPersonalityAssessor>;
} = {}) {
    const namespace = options.namespace ?? personalityNamespace();
    const config = options.config ?? await loadPersonalityConfig();
    let store = createPersonalityStore({ namespace, storage: options.storage });
    store.configure(config);
    const assessor = options.assess ?? createPersonalityAssessor({ enabled: options.enabled });
    const listeners = new Set<() => void>();
    let unsubscribe = store.subscribe(() => listeners.forEach(fn => fn()));
    let sources: Envelope['sources'] = {}, attached = false, disposed = false;
    let preview = typeof location !== 'undefined' && new URLSearchParams(location.search).get('playtest') === 'personality';
    let sourceStorage = options.storage;
    if (sourceStorage === undefined) { try { sourceStorage = localStorage; } catch { sourceStorage = null; } }
    const sourceKey = `${namespace}:sources`;
    let bank: Record<string, PersonalityAssessmentInput> = {};
    try {
        const savedSources = JSON.parse(sourceStorage?.getItem(sourceKey) ?? '{}');
        if (savedSources && typeof savedSources === 'object' && !Array.isArray(savedSources)) bank = savedSources;
    } catch { /* Old saves may have no source metadata. */ }
    function saveSources() {
        const chapters = store.getState().chapters;
        for (const [key, input] of Object.entries(bank)) {
            if (!input || !chapters[input.chapterId]?.events.some(e => e.nodeId === input.nodeId && e.text === input.input)) delete bank[key];
        }
        for (const input of Object.values(sources)) {
            if (chapters[chapterId]?.events.some(e => e.nodeId === input.nodeId && e.text === input.input)) bank[`${chapterId}:${input.nodeId}`] = input;
        }
        try { sourceStorage?.setItem(sourceKey, JSON.stringify(bank)); } catch { /* The confirmed input remains in the core ledger. */ }
    }
    const jobs = new Map<string, AbortController>();
    const cancel = () => { jobs.forEach(job => job.abort()); jobs.clear(); };
    const current = () => store.getState().chapters[chapterId];
    const ensure = () => { if (!attached) { store.startChapter(chapterId); attached = true; } };
    const settle = () => { if (!disposed) options.onSettled?.(); };
    function run(token: AssessmentToken, input: PersonalityAssessmentInput) {
        if (disposed || options.enabled?.() === false || jobs.has(token.nodeId)) return;
        const job = new AbortController(); jobs.set(token.nodeId, job);
        void assessor.assess(input, job.signal).then(result => {
            if (!job.signal.aborted) store.recordOpen({ token, vector: result.vector as Vector, quotes: result.quotes });
        }).catch(() => {
            if (!job.signal.aborted) store.markOpenFailure(token);
        }).finally(() => {
            if (jobs.get(token.nodeId) === job) jobs.delete(token.nodeId);
            if (!job.signal.aborted) settle();
        });
    }
    function resume() {
        if (!attached || disposed) return;
        if (options.enabled?.() === false) { cancel(); return; }
        for (const pending of store.getPendingOpen()) {
            const saved = bank[`${pending.token.chapterId}:${pending.nodeId}`];
            run(pending.token, saved?.input === pending.input ? saved : {
                chapterId: pending.token.chapterId, nodeId: pending.nodeId, input: pending.input, origin: 'unknown',
            });
        }
    }
    function reopen() {
        const checkpoint = store.createCheckpoint(chapterId);
        store.restoreCheckpoint({ ...checkpoint, status: 'playing', endingId: null });
    }
    return {
        getView: () => ({ ...store.getView(), preview }),
        subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
        attach(saved: unknown, settings: { tutorial?: boolean } = {}) {
            cancel(); sources = {};
            const envelope = (saved as { personality?: Envelope } | null)?.personality;
            const restored = envelope && store.restoreCheckpoint(envelope.checkpoint);
            if (!restored?.accepted) store.restartChapter(chapterId, { ...settings, legacy: !!saved });
            else if (envelope?.sources && typeof envelope.sources === 'object') {
                for (const [nodeId, input] of Object.entries(envelope.sources)) {
                    if (input?.chapterId === chapterId && input.nodeId === nodeId && typeof input.input === 'string'
                        && current()?.events.some(e => e.nodeId === nodeId && e.text === input.input)) sources[nodeId] = input;
                }
            }
            attached = true; saveSources(); resume();
        },
        snapshot(): Envelope | undefined {
            if (!attached) return;
            const active = current()?.events ?? [];
            return { checkpoint: store.createCheckpoint(chapterId), sources: Object.fromEntries(Object.entries(sources)
                .filter(([nodeId, input]) => active.some(e => e.nodeId === nodeId && e.text === input.input))) };
        },
        restart(settings: { tutorial?: boolean } = {}) {
            cancel(); sources = {}; store.restartChapter(chapterId, settings); attached = true; saveSources(); resume();
        },
        finishTutorial() { ensure(); store.finishTutorial(chapterId); },
        choice(optionId: string, nodeId?: string, round?: number) {
            ensure(); if (round === 2) store.finishTutorial(chapterId);
            return store.recordChoice({ chapterId, optionId, nodeId, round });
        },
        open(nodeId: string, input: string, detail: OpenOptions = {}) {
            ensure(); if (detail.round === 2) store.finishTutorial(chapterId);
            const previous = current()?.events.find(e => e.kind === 'open' && e.nodeId === nodeId);
            if (previous?.text === input && previous.status !== 'cancelled') return;
            jobs.get(nodeId)?.abort(); jobs.delete(nodeId);
            const token = store.makeOpenToken({ chapterId, nodeId, input,
                round: typeof detail.round === 'number' ? detail.round : undefined });
            if (!token) return;
            const request = { chapterId, nodeId, input, ...detail };
            sources[nodeId] = request; saveSources(); run(token, request);
        },
        complete(endingId: string) { ensure(); store.completeChapter(chapterId, endingId); },
        death(endingId: string, title: string, text = '', nodeId = '') {
            ensure(); store.archiveDeath({ chapterId, endingId, title, text, nodeId });
        },
        retry(nodeIdOrDecisionId: string) {
            ensure(); cancel();
            if (!store.retryFromDecision(chapterId, nodeIdOrDecisionId).accepted) reopen();
            saveSources(); resume();
        },
        prune(kept: { choices: string[]; inputs: string[] }) {
            ensure(); cancel();
            const firstRemoved = current()?.events.find(e => e.kind === 'choice'
                ? !kept.choices.includes(e.optionId ?? '') : !kept.inputs.includes(e.text));
            if (firstRemoved) store.retryFromDecision(chapterId, firstRemoved.decisionId);
            else reopen();
            saveSources(); resume();
        },
        /** Only the explicitly isolated showcase can import prepared demonstration state. */
        seedDemo(raw: unknown) {
            if (new URLSearchParams(location.search).get('playtest') !== 'personality' || !namespace.includes(':playtest:')) return;
            cancel(); unsubscribe();
            try { (options.storage ?? localStorage)?.setItem(namespace, JSON.stringify(raw)); } catch { return; }
            store = createPersonalityStore({ namespace, storage: options.storage }); store.configure(config);
            unsubscribe = store.subscribe(() => listeners.forEach(fn => fn())); preview = true;
        },
        resume,
        dispose() { disposed = true; cancel(); assessor.dispose(); unsubscribe(); listeners.clear(); },
    };
}
