import { derive, edgeKey, inferenceRules, type Derived, type Edge, type InferenceContext } from './thought-canvas-model';
export type ThoughtOutput = {
    id: string;
    used: string[];
};
export type ThoughtRecord = {
    inputs: string[];
    outputs: ThoughtOutput[];
    added: Edge[];
};
export type ThoughtWorkspace = {
    version: 2;
    recipientOpen?: boolean;
    placed: string[];
    history: ThoughtRecord[];
    feedback: string;
};
/* Only the inherited question answer is fixed; partial insights remain removable evidence. */
export const fixedThoughts = (board: ThoughtWorkspace | null) => board?.history.some(record => record.outputs.some(output => output.id === 'R01')) ? ['R01'] : [];
const carryThoughts = (history: ThoughtRecord[], placed: string[]) => [...new Set([...(history.some(record => record.outputs.some(output => output.id === 'R01')) ? ['R01'] : []), ...placed])];
export const thoughtLabels: Record<string, string> = {
    C02: '此前袭扰，闻号即退', C03: '今夜闻号不退，交替试探两翼', C05: '魏军探问丞相与发令者',
    C06: '帐前禁令', C07: '姜维可以代为处理军务', C08: '姜维已答应帐外接报', T02: '营门尚未失守',
    R01: '今夜敌军有变，可能在试探', R02: '向姜维请求接报',
};
export const thoughtInsights: Record<string, string> = {
    R01: '往日闻号即退，今夜却不退，还交替逼近两翼。可能是在试探我军反应，需及时交有权者判断。',
    R02: '军情有变，帐前禁令不能擅改。乙已说明姜维可以代为处理军务及通传路径，可以先请他在帐外听报，当面问准。',
};
const frontier = (ids: string[]) => inferenceRules.filter(rule => ids.includes(rule.id) && !inferenceRules.some(other => other.id !== rule.id && ids.includes(other.id) && rule.requires.every(id => other.requires.includes(id))));
export function freshThoughtWorkspace(collected: string[], graph: Record<string, Derived>): ThoughtWorkspace {
    const known = frontier(Object.keys(graph));
    // Older graph saves keep their understanding as a read-only starting point.
    const history: ThoughtRecord[] = known.length ? [{
            inputs: [...new Set(known.flatMap(rule => rule.requires))],
            outputs: known.map(rule => ({
                id: rule.id, used: [...rule.requires]
            })), added: []
        }] : [];
    return {
        version: 2, recipientOpen: !!graph.R01, history, placed: known.length ? known.map(rule => rule.id) : ['C02', 'C03'].filter(id => collected.includes(id)), feedback: ''
    };
}
/** The selected evidence determines the inference; there is no prescribed order or target step. */
export function thinkFromEvidence(placed: string[], collected: string[], graph: Record<string, Derived>, existing: Edge[], context: InferenceContext = {}) {
    const available = [...new Set(placed)].filter(id => collected.includes(id) || !!graph[id]);
    const sources = (id: string) => collected.includes(id) ? [id] : graph[id]?.evidence ?? [];
    const evidence = new Set(available.flatMap(sources));
    const eligible = inferenceRules.filter(rule => (rule.id !== 'R02' || !!graph.R01) && (rule.requiresStory ?? []).every(id => context.completed?.includes(id)) && !graph[rule.id] && rule.requires.every(id => evidence.has(id)));
    const targets = frontier(eligible.map(rule => rule.id));
    const outputs = targets.map(rule => ({
        id: rule.id, used: available.filter(id => sources(id).some(source => rule.requires.includes(source)))
    }));
    const edges: Edge[] = outputs.flatMap(output => output.used.slice(1).map(id => [output.used[0], id] as Edge));
    const supported = derive(collected, [...existing, ...edges], inferenceRules, context);
    const valid = outputs.filter(output => supported[output.id]);
    const feedback = valid.length ? ''
        : available.length === 0 ? '先放入你想一起考虑的线索。'
            : graph.R01 && evidence.has('C06') && !inferenceRules[1].requiresStory!.every(id => context.completed?.includes(id))
                ? '还需要向乙问清今夜谁当值，以及怎样通传。'
                : evidence.has('C05') && !evidence.has('C03') ? '探问发令者，还不能证明敌军知道丞相病情。可以再结合今夜敌骑实际的行动。'
                    : '这些线索还不足以支持新的判断。可以补充相关见闻，或换一个方向想。';
    return {
        outputs: valid, edges: valid.length ? edges : [], feedback
    };
}
/** Migrate the former wizard without resetting the player's facts, graph, or unfinished input. */
export function restoreThoughtWorkspace(value: unknown, collected: string[], graph: Record<string, Derived>, edges: Edge[], context: InferenceContext = {}): ThoughtWorkspace {
    if (value == null)
        return freshThoughtWorkspace(collected, graph);
    const board = value as Record<string, unknown>;
    const validIds = new Set(Object.keys(thoughtLabels));
    const ids = (items: unknown): items is string[] => Array.isArray(items) && items.every(id => typeof id === 'string' && validIds.has(id));
    const links = (items: unknown): items is Edge[] => Array.isArray(items) && items.every(edge => ids(edge) && edge.length === 2);
    const known = (id: string) => collected.includes(id) || !!graph[id];
    const fail = () => {
        throw new Error('思绪画布记录不完整');
    };
    if (!ids(board.placed) || typeof board.feedback !== 'string')
        return fail();
    if (board.version === 2) {
        if (!Array.isArray(board.history) || board.history.some(record => !record || !ids(record.inputs) || !links(record.added)
            || !Array.isArray(record.outputs) || !record.outputs.length || record.outputs.some((output: ThoughtOutput) => !output || !inferenceRules.some(rule => rule.id === output.id) || !ids(output.used) || output.used.some(id => !record.inputs.includes(id)))))
            return fail();
        const history = (board.history as ThoughtRecord[]).filter(record => record.outputs.every(output => !!graph[output.id]) && record.inputs.every(known));
        return {
            version: 2, recipientOpen: typeof board.recipientOpen === 'boolean' ? board.recipientOpen : !!graph.R01, placed: carryThoughts(history, board.placed.filter(known)), history, feedback: board.feedback
        };
    }
    const oldTargets: Record<string, string> = {
        compare: 'I01', pattern: 'R01', route: 'R02'
    };
    if (typeof board.step !== 'string' || !Object.hasOwn(oldTargets, board.step) || !ids(board.used) || !links(board.added)
        || (board.result !== null && board.result !== oldTargets[board.step]))
        return fail();
    const removed = new Set(board.added.map(edgeKey));
    const prior = freshThoughtWorkspace(collected, derive(collected, edges.filter(edge => !removed.has(edgeKey(edge))), inferenceRules, context));
    if (typeof board.result === 'string' && graph[board.result]) {
        prior.history.push({
            inputs: board.placed.filter(known), outputs: [{
                    id: board.result, used: board.used.length ? board.used.filter(known) : board.placed.filter(known)
                }], added: board.added
        });
        prior.placed = [board.result];
    }
    else
        prior.placed = board.placed.filter(known);
    prior.feedback = board.feedback;
    prior.placed = carryThoughts(prior.history, prior.placed);
    return prior;
}
