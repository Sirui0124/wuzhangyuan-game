import type { GameSessionState } from './session-state';
import type { NarrativeDecision } from '../../narrative/presentation';
import { inferenceRules } from './thought-canvas-model';

export function chapterOneDecision(state: GameSessionState): NarrativeDecision {
    const review = state.notesPurpose === 'review' && state.notesReturn && state.notesReturn !== 'explore';
    const plan = inferenceRules.find(rule => rule.id === 'R02')!;
    const canRequest = state.round === 2 && !state.finishedSections.includes('jiang-commitment')
        && plan.requires.every(id => state.story.collected.includes(id))
        && (plan.requiresStory ?? []).every(id => state.story.completed.includes(id));
    return {
        id: `wuzhang:${state.round}:${state.phase}`,
        text: review ? '回到眼前的事情。' : canRequest ? '军情不能耽误，也不能擅入中军帐。' : '先把眼前的事情问清。',
        choices: review || !canRequest
            ? [{ id: 'return-to-story', text: review ? '继续交谈' : '回到营地' }]
            : [{ id: 'continue-story', text: '请亲兵通传姜维，当面请求他接报' }, { id: 'return-to-story', text: '再看看营地' }],
    };
}
