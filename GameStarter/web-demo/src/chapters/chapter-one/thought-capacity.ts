/** Each canvas question declares its own capacity; extra slots never replace required evidence. */
export type EvidenceCapacityRule = { base: number; redundancy: 0 | 1; inherited: readonly string[] };
export const chapterThoughtCapacity: Record<'situation' | 'recipient', EvidenceCapacityRule> = {
    situation: { base: 2, redundancy: 0, inherited: [] },
    recipient: { base: 2, redundancy: 0, inherited: ['R01'] },
};
export function evidenceCapacity(placed: readonly string[], rule: EvidenceCapacityRule) {
    const count = new Set(placed.filter(id => !rule.inherited.includes(id))).size;
    const limit = rule.base + rule.redundancy;
    return { count, limit, full: count >= limit, exceeded: count > limit };
}
export function thoughtCapacity(placed: readonly string[], graph: Record<string, unknown>) {
    return evidenceCapacity(placed, chapterThoughtCapacity[graph.R01 ? 'recipient' : 'situation']);
}
export const capacityFeedback = (limit: number) => `本题最多添加${limit}条依据，先移除一条再添加。继承的答案不占名额。`;
