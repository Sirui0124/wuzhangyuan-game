import type { GameSessionState } from './session-state';
import type { Ending } from '../../endings';

export const tentStages = ['unheard', 'cough', 'heard', 'side', 'footsteps', 'caught', 'dead'] as const;
export type TentStage = typeof tentStages[number];
export const tentEnding: Ending = {
    id: 'tent-execution', number: '逸事·一', phase: '第一章', result: 'tent-execution', kind: '成就',
    title: '隔帐有耳，帐后有刀', description: '帐里的话，一句没听清。绕到帐后，却被巡营军士拿了个正着。军令如山，我以窥探中军之罪被处斩。',
    hint: '帐前的告示，原来不是摆设。',
};
export const tentLines = {
    cough: '帐篷里传来几声微弱的咳嗽。',
    side: '隔着帐布，似乎有人在念叨什么。听不真切。',
    footsteps: '我又绕到帐篷右面。暗处，隐约传来脚步声。',
    caught: '我刚绕到帐篷后面，一束火光便照上了脸。\n“什么人！在中军帐外鬼鬼祟祟，拿下！”\n还没来得及开口，双臂已被军士反剪到背后。',
};

export function canListenAtTent(state: GameSessionState) {
    return state.phase === 'explore' && state.scene === 'camp_gate' && state.finishedSections.includes('notice');
}

export function advanceTent(state: GameSessionState, action: string): boolean {
    if (action === 'listen' && canListenAtTent(state)) {
        state.phase = 'tent';
        state.tent = state.tent === 'heard' ? 'side' : 'cough';
    } else if (state.phase === 'tent') {
        if (action === 'leave' && (state.tent === 'side' || state.tent === 'footsteps')) {
            state.tent = 'heard'; state.phase = 'explore';
        } else if (action === 'continue' && state.tent === 'side') {
            state.tent = 'footsteps';
        } else if (action === 'next' && state.tent === 'cough') {
            state.tent = 'heard'; state.phase = 'explore';
        } else if (action === 'continue' && state.tent === 'footsteps') {
            state.tent = 'caught';
        } else if (action === 'next' && state.tent === 'caught') {
            state.tent = 'dead'; state.phase = 'death'; state.end = tentEnding.id as 'tent-execution';
        } else return false;
    } else if (action === 'retry' && state.phase === 'death' && state.end === 'tent-execution') {
        state.tent = 'unheard'; state.phase = 'explore'; state.end = null;
    } else return false;
    return true;
}
