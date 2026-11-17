/** Persist user choices separately from temporary lack of an AI connection. */
import { gameModules } from './modules/config';
export type RuntimeMode = 'offline' | 'ai';
export const RUNTIME_MODE_KEY = 'wuzhang-runtime-mode-v1';
export const isRuntimeMode = (value: unknown): value is RuntimeMode => ['offline', 'ai'].includes(value as string);
export const aiEnabled = (mode: RuntimeMode) => gameModules.aiEvaluation && mode !== 'offline';
let connected = true;
let initialization: Promise<RuntimeMode> | undefined;
export function readRuntimePreference(): RuntimeMode {
    try { const value = localStorage.getItem(RUNTIME_MODE_KEY); return value === 'offline' ? 'offline' : 'ai'; }
    catch { return 'ai'; }
}
export function readRuntimeMode(): RuntimeMode {
    if (!gameModules.aiEvaluation || !connected || readRuntimePreference() === 'offline') return 'offline';
    return 'ai';
}
export function setRuntimeConnection(value: boolean): RuntimeMode { connected = value; return readRuntimeMode(); }
export function saveRuntimeMode(mode: RuntimeMode) {
    try {
        localStorage.setItem(RUNTIME_MODE_KEY, mode);
        return true;
    } catch { return false; }
}
/** Read only the proxy's configuration flag, never credentials or a billable model response. */
export function initializeRuntimeMode(): Promise<RuntimeMode> {
    if (!gameModules.aiEvaluation) return Promise.resolve('offline');
    return initialization ??= (async () => {
        try {
            const response = await fetch('http://127.0.0.1:8787/health', { cache: 'no-store', signal: AbortSignal.timeout(3000) });
            const status = await response.json();
            return setRuntimeConnection(response.ok && status.configured === true);
        } catch { return setRuntimeConnection(false); }
    })();
}
