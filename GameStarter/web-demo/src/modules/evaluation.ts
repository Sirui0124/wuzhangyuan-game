export type Evaluator<I, O> = (input: I, signal: AbortSignal) => Promise<O>;
/** Replace providers at composition time; unloading cancels work and rejects late results. */
export function createEvaluationModule<I, O>(options: {
    enabled(): boolean; online: Evaluator<I, O>; offline?: Evaluator<I, O>;
}) {
    const requests = new Set<AbortController>();
    let disposed = false;
    function cancel() { for (const request of requests) request.abort(); requests.clear(); }
    return {
        async evaluate(input: I, signal: AbortSignal): Promise<O> {
            if (disposed) throw new DOMException('评估模块已卸载', 'AbortError');
            const provider = options.enabled() ? options.online : options.offline;
            if (!provider) throw new Error('AI 评估未启用，请使用当前可选对白。');
            const request = new AbortController(); requests.add(request);
            const combined = AbortSignal.any([signal, request.signal]);
            try { combined.throwIfAborted(); const value = await provider(input, combined); combined.throwIfAborted(); return value; }
            finally { requests.delete(request); }
        },
        cancel,
        dispose() { disposed = true; cancel(); },
    };
}
