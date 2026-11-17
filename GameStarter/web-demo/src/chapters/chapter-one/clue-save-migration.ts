import type { GameSessionState } from './session-state';
import { currentClueSources, freshReview, commitRow, derive, inferenceRules, type Edge } from './thought-canvas-model';

/** A bounded migration for the immediately preceding, verified chapter data. */
export const sixClueMigration = {
    from: 'e3fbd99fd36ef1037d64a4b349addfcc28c52d12fa966afe03fb79ff7d58f875',
    to: 'c6bca106a0dfaeb1c068de4bac02429bde086657c71b9703f3f3fb52ecadfd35',
};
export function migrateSixClueSave(state: GameSessionState, currentVersion: string): void {
    if (state?.contentVersion !== sixClueMigration.from || currentVersion !== sixClueMigration.to) return;
    const story = state.story;
    if (!story || !Array.isArray(story.completed) || !Array.isArray(story.collected) || !Array.isArray(story.edges)
        || !Array.isArray(story.seen) || !Array.isArray(story.selected) || !Array.isArray(story.history)) throw new Error('旧线索存档不完整');
    const aliases: Record<string, string> = { T01: 'C06', T03: 'C05', C01: 'C03', C04: 'C03', C09: 'C06' };
    const removed = new Set(['C07', 'C10', 'I01', 'I02', 'I03']);
    const known = new Set(['T01', 'T02', 'T03', ...Array.from({ length: 10 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`), 'I01', 'I02', 'I03', 'R01', 'R02']);
    const map = (ids: string[]) => [...new Set(ids.flatMap(id => {
        if (!known.has(id)) throw new Error('未知旧线索');
        return removed.has(id) ? [] : [aliases[id] ?? id];
    }))];
    const oldCollected = [...story.collected], oldSeen = [...story.seen];
    story.collected = map(story.collected);
    for (const id of story.collected) {
        if (!currentClueSources(id, story.completed).length || (state.round === 2 && id === 'C05' && !story.completed.includes('D26'))
            || (state.round === 2 && id === 'C06' && !story.completed.includes('D02'))) throw new Error('旧线索缺少本轮实际来源');
    }
    story.selected = map(story.selected);
    story.seen = map(story.seen).filter(id => id.startsWith('R'));
    story.edges = story.edges.flatMap(edge => {
        if (!Array.isArray(edge) || edge.length !== 2) throw new Error('旧线索关系不完整');
        const pair = map(edge); return pair.length === 2 ? [pair as Edge] : [];
    });
    // Only a previously earned result with its original required facts may survive.
    if (oldSeen.includes('R01') && ['C02', 'C03', 'C04'].every(id => oldCollected.includes(id))) story.edges.push(['C02', 'C03']);
    if (oldSeen.includes('R02') && ['C02', 'C03', 'C04', 'C06', 'C07'].every(id => oldCollected.includes(id))) story.edges.push(['R01', 'C06']);
    story.positions = Object.fromEntries(Object.entries(story.positions ?? {}).flatMap(([id, pos]) => map([id]).map(id => [id, pos])));
    const adaptTurn = (turn: { classification: { evidenceIds: string[] } } | undefined) => {
        if (turn && Array.isArray(turn.classification?.evidenceIds)) turn.classification.evidenceIds = map(turn.classification.evidenceIds);
    };
    for (const entry of story.history) { if (entry.evidence) entry.evidence = map(entry.evidence); adaptTurn(entry.npcTurn); }
    if (state.speech) { state.speech.selected = map(state.speech.selected); adaptTurn(state.speech.npcTurn); }
    if (state.composition?.evidenceIds) state.composition.evidenceIds = map(state.composition.evidenceIds);
    const rebuilt = freshReview(story.version);
    for (const id of story.completed) commitRow(rebuilt, id);
    if (rebuilt.collected.includes('C07')) story.collected.push('C07');
    if (oldSeen.includes('R02') && ['C02', 'C03', 'C04', 'C06', 'C07'].every(id => oldCollected.includes(id))) story.edges.push(['C06', 'C07']);
    const graph = derive(story.collected, story.edges, inferenceRules, rebuilt);
    story.seen = story.seen.filter(id => graph[id]);
    if (state.thinking) {
        const placed = map(state.thinking.placed).filter(id => story.collected.includes(id) || graph[id]);
        const history = ['R01', 'R02'].filter(id => graph[id] && story.seen.includes(id)).map(id => ({
            inputs: id === 'R01' ? ['C02', 'C03'] : ['R01', 'C06', 'C07'],
            outputs: [{ id, used: id === 'R01' ? ['C02', 'C03'] : ['R01', 'C06', 'C07'] }],
            added: [id === 'R01' ? ['C02', 'C03'] : ['R01', 'C06']] as Edge[],
        }));
        state.thinking = { version: 2, placed, history, recipientOpen: !!graph.R02 || !!state.thinking.recipientOpen, feedback: '' };
    }
}
