/** Local, bounded developer records. Never render these records in the player UI. */
export const dialogueDiagnosticStorageKey = 'wuzhang-grain-dialogue-diagnostics-v1';
const maxRecords = 24, maxBytes = 240000;
const clockSession = globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const n = Math.random() * 16 | 0; return (char === 'x' ? n : (n & 3) | 8).toString(16);
});
const monotonicNow = () => typeof performance === 'undefined' ? null : performance.now();
export type DialogueDiagnosticContext = {
    input: string; rubricVersion: string; scene?: string; nodeId?: string; storyVersion?: string; run?: number;
    evidence?: unknown[]; selected?: unknown[]; offeredItemIds?: string[]; rubric?: unknown;
};
export type DialogueDiagnosticOptions = Pick<DialogueDiagnosticContext, 'nodeId' | 'storyVersion' | 'run' | 'selected'> & { requestId?: string };
export type DialogueDiagnosticEvent = 'submitted' | 'model-requested' | 'model-returned' | 'validated' | 'failed' | 'cancelled'
    | 'listener-started' | 'listener-ended' | 'reply-visible' | 'committed' | 'route-snapshot' | 'late-result-ignored' | 'response-audit-requested' | 'response-audit-returned'
    | 'quote-repair-requested' | 'quote-repair-returned' | 'quote-repair-failed' | 'audit-quote-references-resolved' | 'candidate-adjusted';
type Failure = { kind: string; code: string; field?: string };
export type DialogueDiagnosticUpdate = { raw?: string; responseId?: string | null; auditRaw?: string; auditResponseId?: string | null; quoteRepairRaw?: string; quoteRepairResponseId?: string | null; failure?: Failure; snapshot?: unknown };
export type DialogueDiagnosticRecord = {
    id: string; startedAt: number; startedMonotonicMs?: number | null; startedClockSession?: string; input: string; rubricVersion: string; scene?: string; nodeId?: string; storyVersion?: string; run?: number;
    evidenceJson: string; selectedJson: string; rubricJson: string; offeredItemIds: string[]; raw?: string; rawTruncated?: boolean; responseId: string | null; auditRaw?: string; auditResponseId?: string | null;
    quoteRepairRaw?: string; quoteRepairResponseId?: string | null;
    // elapsedMs is the legacy clamped wall-clock difference. Use monotonicElapsedMs for timing.
    events: { event: DialogueDiagnosticEvent; at: number; elapsedMs: number; wallElapsedMs?: number; clockSession?: string; monotonicMs?: number | null; monotonicElapsedMs?: number | null; failure?: Failure; snapshotJson?: string }[];
};
let memory: DialogueDiagnosticRecord[] = [];
let storageUnavailable = false;
function safeText(value: string, limit: number) {
    return value.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
        .replace(/\b(?:sk|sess)-[A-Za-z0-9_-]{12,}\b/g, '[redacted]')
        .replace(/("(?:api[_-]?key|authorization|cookie|password|secret|token)"\s*:\s*")[^"]*/gi, '$1[redacted]')
        .slice(0, limit);
}
function safeJson(value: unknown, limit: number) {
    try { return safeText(JSON.stringify(value, (key, item) => /^(?:api[_-]?key|authorization|cookie|password|secret|token)$/i.test(key) ? '[redacted]' : item) ?? '', limit); }
    catch { return '[unserializable]'; }
}
function load() {
    if (storageUnavailable) return memory;
    try {
        const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(dialogueDiagnosticStorageKey);
        if (raw && raw.length <= maxBytes) {
            const saved = JSON.parse(raw);
            if (Array.isArray(saved) && saved.every(r => r && typeof r.id === 'string' && Number.isFinite(r.startedAt) && Array.isArray(r.events))) memory = saved.slice(-maxRecords);
        }
    } catch { storageUnavailable = true; }
    return memory;
}
function save(records: DialogueDiagnosticRecord[]) {
    memory = records.slice(-maxRecords);
    while (memory.length && new TextEncoder().encode(JSON.stringify(memory)).length > maxBytes) memory.shift();
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(dialogueDiagnosticStorageKey, JSON.stringify(memory)); }
    catch { storageUnavailable = true; /* Keep the bounded in-memory copy. */ }
}
export function beginDialogueDiagnostic(context: DialogueDiagnosticContext) {
    const id = 'gouan-' + (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
    const startedAt = Date.now();
    const startedMonotonicMs = monotonicNow();
    save([...load(), {
        id, startedAt, startedMonotonicMs, startedClockSession: clockSession, input: safeText(context.input, 1500), rubricVersion: safeText(context.rubricVersion, 120),
        scene: context.scene, nodeId: context.nodeId, storyVersion: context.storyVersion, run: context.run,
        evidenceJson: safeJson(context.evidence ?? [], 18000), selectedJson: safeJson(context.selected ?? [], 6000), rubricJson: safeJson(context.rubric ?? null, 18000), responseId: null,
        offeredItemIds: (context.offeredItemIds ?? []).slice(0, 20).map(id => safeText(id, 100)),
        events: [{ event: 'submitted', at: startedAt, elapsedMs: 0, wallElapsedMs: 0, clockSession, monotonicMs: startedMonotonicMs, monotonicElapsedMs: startedMonotonicMs === null ? null : 0 }],
    }]);
    return id;
}
export function recordDialogueDiagnostic(id: string | undefined, event: DialogueDiagnosticEvent, update: DialogueDiagnosticUpdate = {}) {
    if (!id) return;
    const records = load(), record = records.find(r => r.id === id);
    if (!record) return;
    if (update.raw !== undefined) { record.raw = safeText(update.raw, 18000); record.rawTruncated = update.raw.length > 18000; }
    if (update.responseId !== undefined) record.responseId = typeof update.responseId === 'string' ? safeText(update.responseId, 200) : null;
    if (update.auditRaw !== undefined) record.auditRaw = safeText(update.auditRaw, 18000);
    if (update.auditResponseId !== undefined) record.auditResponseId = typeof update.auditResponseId === 'string' ? safeText(update.auditResponseId, 200) : null;
    if (update.quoteRepairRaw !== undefined) record.quoteRepairRaw = safeText(update.quoteRepairRaw, 18000);
    if (update.quoteRepairResponseId !== undefined) record.quoteRepairResponseId = typeof update.quoteRepairResponseId === 'string' ? safeText(update.quoteRepairResponseId, 200) : null;
    const at = Date.now();
    const monotonicMs = monotonicNow(), wallElapsedMs = at - record.startedAt;
    const monotonicElapsedMs = record.startedClockSession === clockSession && typeof record.startedMonotonicMs === 'number' && monotonicMs !== null
        ? Math.max(0, monotonicMs - record.startedMonotonicMs) : null;
    record.events.push({ event, at, elapsedMs: Math.max(0, wallElapsedMs), wallElapsedMs, clockSession, monotonicMs, monotonicElapsedMs,
        ...(update.failure ? { failure: { kind: safeText(update.failure.kind, 80), code: safeText(update.failure.code, 100), field: safeText(update.failure.field ?? '', 120) } } : {}),
        ...(update.snapshot !== undefined ? { snapshotJson: safeJson(update.snapshot, 10000) } : {}) });
    record.events = record.events.slice(-32);
    save(records);
}
/** Explicit developer export; no console output or automatic upload. */
export function exportDialogueDiagnostics(): string { return JSON.stringify(load(), null, 2); }
