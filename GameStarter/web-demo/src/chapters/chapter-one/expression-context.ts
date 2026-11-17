import { isAvailableSupply, supplyById } from './supplies';
import type { ExpressionGenerationInput, ExpressionMaterial, ExpressionSource } from '../../expression-contract';
import { currentEnemyObservation, JIANG_CONFIRMED_CONSENT_FACT } from '../../weiyan-facts';
import type { ChapterSessionContext } from './session-context';
import { speechHistoryRound, type GameSessionState } from './session-state';
import { currentClueSources, clueSources, inferenceRules, validAuthorization, type StoryRow } from './thought-canvas-model';

/** Match the turn visible above the editor without passing the whole story to the model. */
export function expressionListenerTurn(state: GameSessionState, row: (id: string) => StoryRow | undefined): string {
    return state.lastFeedback || [...state.story.completed].reverse().map(row)
        .find(item => item?.speaker === '魏延' || item?.speaker.startsWith('魏延（'))?.text || '';
}

export function buildExpressionInput(context: ChapterSessionContext): ExpressionGenerationInput {
    const { state, content, rows } = context, graph = context.graph();
    const acquired = new Set(context.collected), completed = new Set(state.story.completed);
    const hasConsent = validAuthorization(state.story);
    const selectedEvidence: ExpressionMaterial[] = [], verificationSources: ExpressionSource[] = [];
    for (const id of new Set(state.story.selected)) {
        const clue = content.clues.find(item => item.id === id), node = graph[id];
        if (!acquired.has(id) && !node) continue;
        // A graph's connected component may contain unrelated notes. Only this rule's actual bases verify it.
        const rule = inferenceRules.find(item => item.id === id);
        const basisIds = node && rule ? rule.requires.filter(source => acquired.has(source)) : [id];
        const originals = [...new Set(basisIds.flatMap(source => currentClueSources(source, state.story.completed)))]
            .filter(source => completed.has(source)).map(source => {
                const row = rows.get(source)!;
                return { id: row.id, speaker: row.speaker, text: row.text };
            });
        if (node && rule) for (const source of rule.requiresStory ?? []) {
            if (!completed.has(source) || originals.some(row => row.id === source)) continue;
            const row = rows.get(source)!; originals.push({ id: row.id, speaker: row.speaker, text: row.text });
        }
        if (!originals.length || (!clue && !node)) continue;
        const historicalPlan = id === 'R02' || id === 'I03';
        let meaning = node?.full ?? clue!.summary;
        let limit = clue?.boundary ?? '有据推论，保留不确定性，不是新事实或授权。';
        // C03 now contains several observations. Its short card title must not erase
        // the acquired movement evidence when a player selects that card or its conclusion.
        const sourceIds = new Set(originals.map(row => row.id));
        const knowsFollowing = sourceIds.has('D22') && sourceIds.has('D23');
        if (id === 'C03') meaning = currentEnemyObservation(meaning, originals);
        if (id === 'R01' && knowsFollowing)
            meaning = meaning.replace('交替逼近两翼，', '交替逼近两翼，并随我军调兵换向，');
        if (id === 'C06') {
            const known = new Set(originals.map(row => row.id));
            if (known.has('A-17')) meaning = '今夜帐中正在处理要事，未经允许不能进帐。';
            if (known.has('D02')) meaning = '丞相已下口谕，今晚禁止任何人进帐求见。';
            if (known.has('D05') && known.has('D06')) {
                meaning += '急报仍须及时递送。';
                limit += '守帐卒甲只有守门和传话职责，无权处置军情或改变禁令；这是他的权限边界，不是玩家必须背诵的台词，更不能改成玩家自称。';
            }
        }
        if (historicalPlan) {
            // Do not mutate the original thought card or infer consent from a plan.
            meaning = id === 'R02' ? '此前形成的方案：军情有变，不能擅入帐，可请求受命的姜维接报判断。'
                : '此前形成的认识：遵守禁令，也可向有职责的姜维请求接报。';
            limit = hasConsent ? '这是此前的方案，不描述当前应允状态；不得说仍未问准。承诺详情只能引用本次选中的C08。'
                : '方案本身不证明已行动或已获本人应允。';
        }
        const priorRunMemory = id === 'C05' && state.round === 2;
        const listenerAlreadyKnows = !priorRunMemory && originals.every(row => row.speaker === '魏延');
        // Keep source relations in typed metadata, not in the words the writer must cover.
        // Wrapping meaning in "魏延此前已向我说明" made prose repeat a report to its own speaker.
        if (priorRunMemory) {
            meaning = '我的记忆中，敌军曾探问丞相与发令者；没有这次会面的新报告可以确认他们此刻仍在叫嚷。';
            limit = '可作为我的回忆来说明，不冒充当前刚取得的军情，也不说是魏延方才告诉我的；不证明敌军已知病情。';
        }
        if (id === 'C08') {
            if (!hasConsent) continue;
            meaning = JIANG_CONFIRMED_CONSENT_FACT;
            limit = '承诺已取得；不等于军报已送达、已处置或准许闯帐。';
        }
        selectedEvidence.push({
            id, kind: id === 'C08' ? 'commitment' : historicalPlan ? 'plan' : node ? 'inference' : 'fact',
            meaning, limit, time: priorRunMemory ? 'prior-run-memory' : historicalPlan ? 'historical-plan' : 'current',
            attribution: priorRunMemory ? '我对上一回见闻的回忆，不是这次会面魏延刚说的话'
                : node ? '我依据已得见闻形成的认识' : listenerAlreadyKnows ? '听者魏延在本轮亲口告知' : clue!.kind,
            listenerAlreadyKnows,
        });
        verificationSources.push({ evidenceId: id, basisIds, originals });
    }
    const attachedItems = state.supplies.attached.map(id => {
        const item = supplyById(id, state.supplies);
        if (!item || !isAvailableSupply(id, state.supplies)) throw new Error('物品尚未购买或已消耗');
        return { kind: 'item' as const, id: item.id, name: item.name, ability: item.ability, boundary: item.boundary };
    });
    const listenerText = expressionListenerTurn(state, id => rows.get(id));
    const previousTurns = state.story.history
        .filter(turn => speechHistoryRound(turn, state.round) === state.round
            && turn.text.trim() && turn.feedback.trim()
            && turn.npcTurn?.classification.disposition !== 'execute' && !turn.itemDecision?.eraFailure)
        .map(turn => ({ text: turn.text, reply: turn.feedback }));
    const draft = state.story.draft.trim(), focus = state.composition.focus.trim();
    const words = draft || focus;
    return {
        brief: {
            schemaVersion: 2,
            conversation: {
                stage: state.round === 1 ? 'first' : 'authorized', location: state.scene,
                speaker: '我（守卒）', listener: '魏延',
                situation: state.round === 1 ? '首次在营前拦下要见丞相的魏延，正在回应他。'
                    : '再次与魏延当面对话，说明此刻的判断与接报安排；此前形成的方案不是当前事件状态。',
                listenerTurn: listenerText ? { speaker: '魏延', text: listenerText } : null,
                ...(previousTurns.length ? { previousTurns } : {}),
            },
            playerIntent: { mode: words ? selectedEvidence.length ? 'compose-selected-with-intent' : 'polish-player-words' : 'compose-from-selected', words, draft, focus },
            selectedEvidence,
            ...(attachedItems.length ? { attachedItems } : {}),
        },
        verificationSources,
    };
}
