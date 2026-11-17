/** Pure, chapter-configured graph evaluation. Generated prose never grants events. */
import type { NpcTurn } from '../../npc-dialogue';
export type Edge = [
    string,
    string
];
export type InferenceRule = {
    id: string;
    requires: string[];
    summary: string;
    full: string;
    requiresStory?: string[];
};
export type InferenceContext = { completed?: readonly string[] };
export const relationVersion = 'ch1-jiang-duty-20261026';
export const inferenceRules: InferenceRule[] = [
    {
        id: 'R01', requires: ['C02', 'C03'], summary: '今夜有变，可能在试探', full: '与以往闻号即退不同，今夜敌军闻号不退，交替逼近两翼，可能在试探我军反应，需及时交有权者判断。'
    },
    {
        id: 'R02', requires: ['C02', 'C03', 'C06', 'C07'], requiresStory: ['D08', 'D09', 'D11', 'D12', 'D13'], summary: '向姜维请求接报', full: '今夜军情有变，不能擅入帐；乙已说明姜维可代为处理军务及亲兵通传的路径，可先向他请求接报。这只是待执行的方案，尚未得到姜维应允。'
    },
];
export const edgeKey = ([a, b]: Edge) => [a, b].sort().join('|');
export type Derived = {
    id: string;
    evidence: string[];
    edgeKeys: string[];
    summary: string;
    full: string;
    supplements: string[];
};
export function derive(collected: string[], edges: Edge[], rules = inferenceRules, context: InferenceContext = {}): Record<string, Derived> {
    const originals = new Set(collected.filter(id => !rules.some(rule => rule.id === id)));
    const supported: Record<string, Derived> = {};
    // Least fixed point: stale conclusions cannot prove themselves through a cycle.
    for (let pass = 0; pass <= rules.length; pass++) {
        let changed = false;
        const allowed = new Set([...originals, ...Object.keys(supported)]);
        const adjacency = new Map<string, Set<string>>();
        for (const [a, b] of edges)
            if (a !== b && allowed.has(a) && allowed.has(b)) {
                if (!adjacency.has(a))
                    adjacency.set(a, new Set());
                if (!adjacency.has(b))
                    adjacency.set(b, new Set());
                adjacency.get(a)!.add(b);
                adjacency.get(b)!.add(a);
            }
        const visited = new Set<string>();
        for (const start of adjacency.keys()) {
            if (visited.has(start))
                continue;
            const group = new Set<string>(), queue = [start];
            while (queue.length) {
                const id = queue.pop()!;
                if (group.has(id))
                    continue;
                group.add(id);
                visited.add(id);
                queue.push(...(adjacency.get(id) ?? []));
            }
            const evidence = new Set<string>();
            for (const id of group) {
                if (originals.has(id))
                    evidence.add(id);
                else
                    for (const source of supported[id]?.evidence ?? [])
                        evidence.add(source);
            }
            for (const rule of rules)
                if (rule.requires.every(id => evidence.has(id)) && (rule.requiresStory ?? []).every(id => context.completed?.includes(id)) && !supported[rule.id]) {
                    const edgeKeys = edges.filter(([a, b]) => group.has(a) && group.has(b)).map(edgeKey);
                    for (const id of group)
                        edgeKeys.push(...(supported[id]?.edgeKeys ?? []));
                    supported[rule.id] = {
                        id: rule.id, evidence: [...evidence].sort(), edgeKeys: [...new Set(edgeKeys)], summary: rule.summary, full: rule.full, supplements: []
                    };
                    changed = true;
                }
            for (const id of ['R01', 'R02'])
                if (group.has(id) && supported[id]) {
                    const add = (source: string, text: string) => {
                        if (evidence.has(source)) {
                            if (!supported[id].supplements.includes(text))
                                supported[id].supplements.push(text);
                            supported[id].evidence = [...new Set([...supported[id].evidence, source])].sort();
                        }
                    };
                    if (id === 'R01') {
                        add('C05', '也许在探我军由谁指挥；这仍不能证明敌军已知丞相病情。');
                    }
                }
        }
        if (!changed)
            break;
    }
    return supported;
}
export function connectionFeedback(a: string, b: string, collected: string[], edges: Edge[], context: InferenceContext = {}): string {
    const result = derive(collected, edges, inferenceRules, context);
    const pair = new Set([a, b]);
    if (pair.has('C05') && pair.has('C03'))
        return '问了丞相，还不能断定来意。';
    if (pair.has('R01') && result.R01) {
        if (pair.has('C05'))
            return '也许在探我军由谁指挥。';
    }
    for (const node of Object.values(result).reverse())
        if (node.edgeKeys.includes(edgeKey([a, b])))
            return node.summary + '。';
    if (pair.has('R02'))
        return '职责在身，不等于已经应允；还要当面问准。';
    return '这两条暂时还说明不了更多。';
}
export type StoryRow = {
    id: string;
    speaker: string;
    text: string;
    clue: string;
    transition: string;
};
export type Clue = {
    id: string;
    kind: string;
    summary: string;
    collect: string;
    boundary: string;
};
export type ChapterReview = {
    version: string;
    source_url: string;
    rows: StoryRow[];
    clues: Clue[];
};
export const clueSources: Record<string, string[]> = {
    C02: ['D15', 'D16'], C03: ['D18', 'D19', 'D20', 'D22', 'D23', 'D24'],
    C05: ['A-33', 'A-34', 'D26'], C06: ['A-17', 'D02', 'D05', 'D06'],
    C07: ['D08', 'D09'], C08: ['J09', 'J09A', 'J10', 'J10A', 'J10B', 'J11'], T02: ['A-24'],
};
/** Only the current source version is visible; supplements unlock after their whole source group. */
export function currentClueSources(id: string, completed: readonly string[]): string[] {
    const has = (sources: string[]) => sources.every(source => completed.includes(source));
    if (id === 'C06') return completed.includes('D02') ? ['D02', ...(has(['D05', 'D06']) ? ['D05', 'D06'] : [])] : completed.includes('A-17') ? ['A-17'] : [];
    if (id === 'C07') return has(['D08', 'D09']) ? ['D08', 'D09', ...(has(['D11', 'D12', 'D13']) ? ['D11', 'D12', 'D13'] : [])] : [];
    if (id === 'C05') return has(['A-33', 'A-34']) ? ['A-33', 'A-34', ...(completed.includes('D26') ? ['D26'] : [])] : [];
    if (id === 'C03') return has(['D18', 'D19', 'D20']) ? ['D18', 'D19', 'D20', ...(has(['D22', 'D23']) ? ['D22', 'D23'] : []), ...(completed.includes('D24') ? ['D24'] : [])] : [];
    const sources = clueSources[id] ?? [];
    return has(sources) ? [...sources] : [];
}
export const collectionAt: Record<string, string> = {
    'A-17': 'C06', 'A-24': 'T02', 'A-34': 'C05', D02: 'C06', D09: 'C07', D16: 'C02', D20: 'C03', D26: 'C05', J11: 'C08'
};
export type ReviewSave = {
    version: string;
    run: string;
    current: string;
    mode: 'story' | 'canvas' | 'expression' | 'end';
    completed: string[];
    collected: string[];
    edges: Edge[];
    seen: string[];
    positions: Record<string, {
        x: number;
        y: number;
    }>;
    flags: Record<string, boolean>;
    selected: string[];
    draft: string;
    history: {
        text: string;
        feedback: string;
        accepted: boolean;
        evidence?: string[];
        npcTurn?: NpcTurn;
    }[];
    requestSeq: number;
    pending?: {
        text: string;
        verdict?: string | null;
        evidence?: string[];
    };
};
export function freshReview(version: string): ReviewSave {
    return {
        version, run: `night-${Date.now()}`, current: 'A-01', mode: 'story', completed: [], collected: [], edges: [], seen: [], positions: {}, flags: {}, selected: [], draft: '', history: [], requestSeq: 0
    };
}
export function commitRow(save: ReviewSave, id: string): void {
    if (save.completed.includes(id))
        return;
    save.completed.push(id);
    if (id === 'A-40B')
        save.flags.FIRST_TRANSFER_ACCEPTED = true;
    const clue = collectionAt[id];
    if (clue && currentClueSources(clue, save.completed).length && !save.collected.includes(clue))
        save.collected.push(clue);
    if (id === 'D09')
        save.flags.JIANG_DUTY_KNOWN = true;
    if (id === 'J11' && save.collected.includes('C08')) {
        save.flags.JIANG_AUTH_GRANTED = true;
        save.flags.JIANG_WAITING = true;
    }
    if (id === 'J14' && save.completed.includes('J13'))
        save.flags.COMPANION_PRESENT = true;
    if (id === 'W05')
        save.flags.AUTH_WITNESSED = true;
    if (id === 'E04C' && ['E03', 'E04'].every(row => save.completed.includes(row)))
        save.flags.FORMAL_REPORT_RECEIVED = true;
    if (id === 'E10' && save.flags.FORMAL_REPORT_RECEIVED && ['E05', 'E08', 'E08B', 'E09'].every(row => save.completed.includes(row)))
        save.flags.REPORT_CLOSED = true;
}
export function validAuthorization(save: ReviewSave): boolean {
    return !!save.flags.JIANG_AUTH_GRANTED && !!save.flags.COMPANION_PRESENT && save.collected.includes('C08') && clueSources.C08.every(id => save.completed.includes(id));
}
