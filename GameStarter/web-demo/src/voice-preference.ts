/** Local playtesting starts in text mode. Only an explicit opt-in enables generated dialogue audio. */
export const AI_VOICE_ENABLED_KEY = 'wuzhang-ai-voice-enabled';
export function readAiVoiceEnabled(): boolean {
    try { return localStorage.getItem(AI_VOICE_ENABLED_KEY) === '1'; } catch { return false; }
}
export function saveAiVoiceEnabled(enabled: boolean): void {
    try { localStorage.setItem(AI_VOICE_ENABLED_KEY, enabled ? '1' : '0'); } catch { /* Usable for this session. */ }
}
