type GraphNode = {
    id: string; next?: string; retry?: string;
    options?: { id: string; next: string }[];
    routes?: (string | { next: string })[];
};

/** Structural validation only; chapter-specific gates, evidence and endings remain in the chapter. */
export function indexStoryGraph<T extends GraphNode>(nodes: T[], start: string, label: string): Map<string, T> {
    const index = new Map<string, T>();
    for (const node of nodes) {
        if (!node.id || index.has(node.id)) throw new Error(`${label}节点重复或缺少编号：${node.id}`);
        index.set(node.id, node);
    }
    if (!index.has(start)) throw new Error(`${label}缺少入口：${start}`);
    for (const node of nodes) {
        const options = node.options ?? [];
        if (options.some(o => !o.id) || new Set(options.map(o => o.id)).size !== options.length) throw new Error(`${label}选项编号重复或为空：${node.id}`);
        const edges = [...options.map(o => o.next), ...(node.routes ?? []).map(r => typeof r === 'string' ? r : r.next)];
        if (node.next !== undefined) edges.push(node.next);
        if (node.retry !== undefined) edges.push(node.retry);
        for (const edge of edges) if (!index.has(edge)) throw new Error(`${label}去向不存在：${node.id} → ${edge}`);
    }
    return index;
}
