import type { GrainSession } from './session';

/** Place each confirmed conversation at its own node, alongside the ordinary lines it followed. */
export function grainHistory(session: GrainSession): { speaker: string; text: string }[] {
    const nodes = new Map(session.story.nodes.map(node => [node.id, node]));
    return [...new Set([...session.state.visited, session.state.node])].flatMap(id => {
        const node = nodes.get(id);
        if (!node) return [];
        if (node.kind === 'open') {
            const judgment = session.state.judgments[id];
            return judgment ? [{ speaker: '我', text: judgment.input }, { speaker: '苟安', text: judgment.reply }] : [];
        }
        if (!session.state.visited.includes(id)) return [];
        if (node.kind === 'line') return [{ speaker: node.speaker, text: node.text }];
        if (node.kind === 'choice') return (node.options ?? []).filter(option => session.state.chosen.includes(option.id)).map(option => ({ speaker: '我', text: option.text }));
        return [];
    });
}
