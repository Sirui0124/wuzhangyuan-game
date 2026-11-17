import { speechHistoryRound, type GameSessionState } from './session-state';
import { validAuthorization } from './thought-canvas-model';

/** Authored opt-in speech, available only after actual clarification replies in this round. */
export function expressionHelp(state: GameSessionState): string | null {
    if (!['expression', 'spoken'].includes(state.phase)
       ) return null;
    const attempts = state.story.history.filter(h => speechHistoryRound(h, state.round) === state.round
        && !h.accepted && h.npcTurn?.classification.disposition === 'revise');
    if (attempts.length < 2) return null;
    const known = new Set(state.story.collected);
    if (!known.has('C06')) return null;
    if (state.round === 1) return '将军，先前说得不妥，我重新说明：帐前禁令不能违，军情也不能耽误。我这就替您转呈，请您稍候。';
    if (!validAuthorization(state.story) || !['C02', 'C03', 'C08'].every(id => known.has(id))) return null;
    return '将军，先前说得不妥，我重新说明：伯约已亲口答应在帐外接报。今夜敌军跟着我军调动变向，与前几夜不同，恐怕是在试探。请您现在随我到帐外，当面把军报交给伯约，不进丞相帐。';
}
