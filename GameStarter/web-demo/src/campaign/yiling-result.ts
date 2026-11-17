import { emptyResult, type ChapterResult } from './results';

export const YILING_BASE_KEY = 'wzy:chapter-results:v1:yiling-base';
export const YILING_CAMPAIGN_KEY = 'yiling-rescue-campaign-session-v1';
const names: Record<string, string> = {front:'张南、冯习',fu:'傅肜',huang:'黄权',sha:'沙摩柯',ma:'马良',cheng:'程畿',du:'杜路、刘宁',wang:'王甫',sun:'孙夫人'};
/** Explicitly adopted finished rescue, not an automatic scan of independent playtests. */
export function adoptedYilingResult(value: unknown): ChapterResult {
    const s = value as {id:string;revision:number;phase:string;routes:{id:string;status:string;outcome:string}[]};
    if (!s || !/^[\da-f-]{36}$/i.test(s.id) || !Number.isSafeInteger(s.revision) || s.revision<0 || s.phase!=='ended'
        || !Array.isArray(s.routes) || s.routes.length!==9 || new Set(s.routes.map(r=>r.id)).size!==9
        || s.routes.some(r=>!names[r.id] || !['saved','failed'].includes(r.status) || typeof r.outcome!=='string' || !r.outcome || r.outcome.length>4000)) throw new Error('这次营救还没有完整结算。');
    return {...emptyResult('yiling'), status:'completed', ending:'adopted-rescue', source:`yiling-rescue-adopted:${s.id}:${s.revision}`,
        detail:'已采用这一夜的营救结果；降魏、降吴不计作死亡，接应兵力不计作救回人数。',
        people:s.routes.map(r=>({name:names[r.id],fate:r.status==='saved'?'saved':['huang','du'].includes(r.id)?'unknown':'dead',detail:r.outcome}))};
}
