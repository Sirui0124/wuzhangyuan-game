import { emptyResult, type ChapterResult, type ResultStore } from './results';

export const YILING_CAMPAIGN_KEY = 'yiling-command-chapter-v1';
export const EIGHT_ROUTE_VERSION = 'eight-front-20261118-v4';
const fronts = { sha: '沙摩柯', camp: '冯习、张南', fu: '傅肜', ma: '马良', cheng: '程畿', du: '杜路、刘宁', wang: '王甫', huang: '黄权' };
type Front = keyof typeof fronts;
type Stage = { name: string; status: string };
export type CommandSession = {
    scenarioId: string; revision: number; round: number; ended: boolean; routeVersion: string; roundLimit: number;
    fronts: Record<Front, { status: string; stages?: Stage[] }>; dead: number;
};

export function commandId(store: Pick<ResultStore, 'getItem'>, key = YILING_CAMPAIGN_KEY): string | null {
    try {
        const id = JSON.parse(store.getItem(key) ?? 'null')?.id;
        return typeof id === 'string' && /^[\da-f-]{36}$/i.test(id) ? id : null;
    } catch { return null; }
}
export function isCurrentCommand(s: CommandSession | undefined, id: string): s is CommandSession {
    return !!s && s.scenarioId === id && s.routeVersion === EIGHT_ROUTE_VERSION && s.roundLimit === 8
        && Number.isSafeInteger(s.revision) && s.revision >= 0 && !!s.fronts
        && Object.keys(s.fronts).length === 8 && Object.keys(fronts).every(key => Object.hasOwn(s.fronts, key));
}
export async function loadCommand(id: string) {
    const response = await fetch('/api/yiling-command/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: id }),
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || '营救进度暂时无法读取。'), { status: response.status });
    return data.session as CommandSession;
}
export const commandSource = (id: string) => 'yiling-command:' + id + ':';
export function commandResult(s: CommandSession): ChapterResult {
    if (!isCurrentCommand(s, s.scenarioId)) throw new Error('这份军报与当前八路营救不符。');
    const result = emptyResult('yiling', s.ended ? 'completed' : 'in-progress');
    result.source = commandSource(s.scenarioId) + s.revision;
    if (!s.ended) return result;
    const safe = (status: string) => status === 'safe' || status === 'home';
    const routes = Object.entries(fronts) as [Front, string][];
    const saved = routes.filter(([id]) => safe(s.fronts[id].status)).length;
    result.ending = saved === routes.length ? 'eight-front-rescued' : 'eight-front-deadline';
    result.detail = `共接应八路，${saved}路全部脱险。`;
    result.dead = s.dead;
    result.people = routes.flatMap(([id, name]) => {
        const route = s.fronts[id];
        const groups = route.stages?.length ? route.stages : [{ name, status: route.status }];
        return groups.map(group => {
            const fate = safe(group.status) ? 'saved' : ['dead', 'killed'].includes(group.status) ? 'dead' : 'unknown';
            const detail = group.name + (fate === 'saved' ? '已脱险。' : fate === 'dead' ? '已确认阵亡。' : '尚无脱险的回报。');
            return { name: group.name, fate, detail } as const;
        });
    });
    return result;
}
