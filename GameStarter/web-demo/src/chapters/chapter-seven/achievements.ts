import {recordAchievements} from '../../achievements/storage';
import type {PangtongSession} from './session';
/** Called after a committed formal save; investigation failures and playtests cannot award cards. */
export function recordPangtongEnding(session:PangtongSession, isolated=false, storage:Pick<Storage,'getItem'|'setItem'>=localStorage) {
    if(isolated || session.ending?.kind!=='complete')return true;
    return recordAchievements([`luofengpo-${session.ending.id}`],`luofengpo:${session.history.capturedAt}`,storage);
}
