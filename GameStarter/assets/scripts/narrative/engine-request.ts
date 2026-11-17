import type { Chapter, DialogueNode, JudgeDefinition, JudgeRequest } from '../../../../content/schema/narrative';
import { evaluate, type InteractionContext } from './conditions';
import { uniqueId, type RuntimeState } from './state';

/** Build the legacy judge snapshot without changing narrative state. */
export function createJudgeRequest(chapter: Chapter, state: RuntimeState, n: DialogueNode, def: JudgeDefinition, context: InteractionContext, intentId: string, text: string): JudgeRequest {
        // NPC owns only current-loop facts; player memory and other actors' histories are excluded.
        const caseFlags = new Set<string>();
        const inspect = (c: Parameters<typeof evaluate>[0]): void => {
            if ('flag' in c) caseFlags.add(c.flag);
            else if ('all' in c) c.all.forEach(inspect);
            else if ('any' in c) c.any.forEach(inspect);
            else if ('not' in c) inspect(c.not);
        };
        def.acceptanceCases.forEach(c => inspect(c.when));
        const constraints = chapter.initialFlags.filter(f => f.scope === 'loop' && caseFlags.has(f.id) && f.owner !== n.characterId)
            .map(f => `程序校验事实（不代表NPC已知）：${f.id}=${JSON.stringify(state.flags[f.id])}`);
        const facts = chapter.initialFlags.filter(f => f.scope === 'loop' && f.owner === n.characterId)
            .map(f => `${f.id}=${JSON.stringify(state.flags[f.id])}`);
        const history = state.history.filter(e => e.loopId === state.loopId && e.actorId === n.characterId).slice(-6)
            .map(e => `${e.kind}:${e.target}; evidence=${e.evidenceIds.join(',')}`);
        const request: JudgeRequest = { requestId: uniqueId('judge'), loopId: state.loopId, stateRevision: state.revision,
            nodeId: n.id, characterId: n.characterId, intentId, evidenceIds: context.evidenceIds, text,
            context: [chapter.characters.find(a => a.id === n.characterId)!.motivation,
                `当前目标证词：${n.targetStatement ?? ''}`, ...facts, ...constraints, ...(n.id === 'weiyan.negotiate' ? [] : history),
                ...(state.feedback[n.id]?.missingPoints ?? []).map(point => `上次待补充（须重新核验）：${point}`),
                ...Object.values(state.promises).filter(p => p.actorId === n.characterId).map(p => `本轮承诺 ${p.id}:${p.status}`)] };
        if (n.id === 'weiyan.negotiate' || n.id === 'tutorial.weiyan.negotiate') {
            request.context = [];
            request.weiyan = { engineFacts: { approval: state.flags['loop.jiangwei_approval'] === true } };
        }
    return request;
}
