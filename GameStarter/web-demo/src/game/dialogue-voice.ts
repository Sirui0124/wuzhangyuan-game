import type { ChapterSession } from '../chapter-session';
import { StreamingVoice, type VoiceTrack } from '../streaming-voice';

/** Presentation-only: judgment starts immediately in confirmExpression, independently of audio. */
export function createDialogueVoice(game: ChapterSession, notice: (text: string) => void, canPresent = () => true) {
    const voice = new StreamingVoice(notice);
    let speechKey = '', rowKey = '', cachedText = '', cached: VoiceTrack | undefined, active: VoiceTrack | undefined;
    let playerEnded = false, epoch = 0;
    function stop() { epoch++; playerEnded = false; voice.stop(); speechKey = ''; rowKey = ''; cachedText = ''; cached = undefined; active = undefined; }
    function handoff() {
        if ((!isEnabled() || playerEnded) && canPresent() && !document.hidden && game.snapshot().phase === 'spoken' && game.snapshot().speech?.status === 'ready') game.acknowledgeReply();
    }
    function isEnabled() { return game.aiEnabled() && !voice.diagnostics().muted; }
    function setEnabled(enabled: boolean) {
        // Invalidate playback completion handlers as well as aborting synth/prefetch requests.
        stop(); voice.setMuted(!enabled);
    }
    function sync() {
        if (!canPresent() || document.hidden) return;
        if (!isEnabled()) { stop(); handoff(); return; }
        const state = game.snapshot(), speech = state.speech;
        if (state.phase === 'spoken' && speech) {
            if (['cancelled', 'failed'].includes(speech.status)) { stop(); return; }
            const key = `${state.story.run}:${state.round}:${state.story.history.length}:${speech.text}`;
            if (key !== speechKey) {
                stop(); speechKey = key;
                active = voice.prepare(speech.text, 'player', true);
                const currentEpoch = epoch;
                void active.finished.then(() => {
                    // Unavailable audio falls back to text. Background cancellation resumes
                    // the handoff only when the page is visible again; stale tracks cannot act.
                    if (currentEpoch !== epoch) return;
                    playerEnded = true; handoff();
                });
            }
            const reply = speech.npcTurn?.reply.text;
            if (speech.status === 'ready' && reply && reply !== cachedText) {
                cached?.stop(); cachedText = reply; cached = voice.prepare(reply, 'weiyan');
                const track = cached;
                void track.finished.then(result => {
                    if (result !== 'ended' && cached === track) { cached = undefined; cachedText = ''; }
                });
            }
            handoff();
            return;
        }
        const row = state.phase === 'reply' ? game.currentReply() : ['dialogue','branch'].includes(state.phase) ? game.row() : null;
        // Only the post-canvas exchange and its continuation; no narration/video overdubs.
        const speaker = row?.speaker.split(/[（·]/)[0];
        if ((!speechKey && state.phase!=='branch') || !row || !speaker || !['魏延', '我', '主角'].includes(speaker) || row.speaker.includes('心声')) { stop(); return; }
        const key = `${row.id}:${row.text}`;
        if (rowKey === key) return;
        rowKey = key; active?.stop();
        if (row.text === cachedText && cached) { active = cached; cached = undefined; active.play(); }
        else { cached?.stop(); cached = undefined; active = voice.prepare(row.text, speaker === '魏延' ? 'weiyan' : 'player', true); }
    }
    return { sync, stop, isEnabled, setEnabled };
}
