import type { Chapter, Effect, Value } from '../../../../content/schema/narrative';
import { evaluate, type InteractionContext } from './conditions';
import type { RuntimeState } from './state';

/** Transaction-owned mutations; the engine still controls rollback and dialogue order. */
export interface MutationHost {
    chapter: Chapter;
    state: RuntimeState;
    nodeId: string | null;
    pendingNext: string | null;
    log(kind: string, target: string, changes: Record<string, Value>, context: InteractionContext): string;
}

export function applyAction(host: MutationHost, id: string, context: InteractionContext): void {
        const action = host.chapter.actions.find(a => a.id === id);
        if (!action || !evaluate(action.availableWhen, host.state, context)) throw new Error(`Action unavailable ${id}`);
        applyEffects(host, action.effects.filter(e => e.type !== 'fulfillPromise'), context, id); host.state.actions.push(id);
        host.log('action', id, {}, context);
        for (const p of Object.values(host.state.promises)) if (p.status === 'pending') {
            const def = host.chapter.promises.find(x => x.id === p.id)!;
            if (def.requiredActionIds.includes(id) && !p.actions.includes(id)) p.actions.push(id);
            if (action.timeCost === 'delay') {
                p.delays++; host.log(p.delays >= def.delayBudget ? 'promise_break' : 'promise_warning', p.id, {}, context);
                if (p.delays >= def.delayBudget) { p.status = 'broken'; applyEffects(host, def.brokenEffects, context, id); }
            }
            if (p.status === 'pending' && def.requiredActionIds.every(a => p.actions.includes(a)) && evaluate(def.completedWhen, host.state, context)) p.status = 'fulfilled';
        }
        applyEffects(host, action.effects.filter(e => e.type === 'fulfillPromise'), context, id);
        settleEvents(host, context);
        if (!host.pendingNext && action.next) host.pendingNext = action.next;
    }
export function applyEffects(host: MutationHost, effects: Effect[], context: InteractionContext, target: string): void {
        const changes: Record<string, Value> = {};
        const granted: string[] = [];
        for (const effect of effects) {
            if (effect.type === 'setFlag') {
                const def = host.chapter.initialFlags.find(f => f.id === effect.flag);
                if (!def || typeof effect.value !== typeof def.initial || (def.allowedValues && !def.allowedValues.includes(effect.value))) throw new Error(`Invalid flag ${effect.flag}`);
                host.state.flags[effect.flag] = effect.value; changes[effect.flag] = effect.value;
            } else if (effect.type === 'grantEvidence') {
                if (!host.chapter.evidence.some(e => e.id === effect.evidenceId)) throw new Error('Unknown evidence');
                if (!host.state.evidence[effect.evidenceId]) {
                    host.state.evidence[effect.evidenceId] = { loopId: host.state.loopId, nodeId: host.nodeId ?? target, sourceEvent: '' };
                    granted.push(effect.evidenceId);
                }
            } else {
                const def = host.chapter.promises.find(p => p.id === effect.promiseId);
                if (!def) throw new Error('Unknown promise');
                const p = host.state.promises[def.id];
                if (effect.type === 'startPromise' && !p) host.state.promises[def.id] = { id: def.id, actorId: context.actorId ?? '', startedEvent: target, status: 'pending', actions: [], delays: 0 };
                if (effect.type === 'fulfillPromise') {
                    if (!p || p.status === 'broken' || !def.requiredActionIds.every(a => p.actions.includes(a)) || !evaluate(def.completedWhen, host.state, context)) throw new Error('Promise not actually fulfilled');
                    p.status = 'fulfilled';
                }
                if (effect.type === 'breakPromise' && p?.status === 'pending') { p.status = 'broken'; applyEffects(host, def.brokenEffects, context, target); }
            }
        }
        const eventId = host.log('effects', target, changes, context);
        for (const id of granted) host.state.evidence[id].sourceEvent = eventId;
    }
export function settleEvents(host: MutationHost, context: InteractionContext): void {
        for (let pass = 0; pass <= host.chapter.events.length; pass++) {
            const event = [...host.chapter.events].sort((a, b) => b.priority - a.priority)
                .find(e => !host.state.firedEvents.includes(e.id) && evaluate(e.when, host.state, context));
            if (!event) return;
            host.state.firedEvents.push(event.id); applyEffects(host, event.effects, context, event.id);
            host.log('event', event.id, {}, context); if (event.next && !host.pendingNext) host.pendingNext = event.next;
        }
        throw new Error('Event settlement failed');
    }
