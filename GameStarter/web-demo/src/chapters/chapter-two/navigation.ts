/** Read-only map projection of this chapter's own save and authored terminal nodes. */
export const GRAIN_SAVE_KEY = 'grain-chapter-two-films-v1';
export const GRAIN_COMPLETED_KEY = 'grain-chapter-two-completed-v1';
export type GrainNavigationStory = { version: string; nodes: { id: string; kind: string }[] };
export function grainHasCompleted(story: GrainNavigationStory, raw: string | null, completed: string | null): boolean {
    if (completed === 'true') return true;
    try {
        const saved = JSON.parse(raw ?? 'null');
        return saved?.version === story.version && !saved.end && Array.isArray(saved.visited)
            && story.nodes.some(node => node.id === saved.node && node.kind === 'finish');
    } catch { return false; }
}
