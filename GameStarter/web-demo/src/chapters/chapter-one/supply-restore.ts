import type { GameSessionState } from './session-state';
import { consumeSupplies, isAvailableSupply, parseItemDecision, restoreSupplies, type ItemDecision } from './supplies';
import { validAuthorization } from './thought-canvas-model';
import { eraArrestReply } from '../../phone/era-judgment';

export function restoreSupplyState(state: GameSessionState, grantReward = true) {
    const legacyConsumption = state.supplies?.consumed === undefined;
    const needed: Record<string, string[]> = { R01: ['C02', 'C03'], R02: ['C02', 'C03', 'C06'] };
    const earned = Object.keys(needed).filter(id => state.round === 2 && state.story.seen.includes(id)
        && needed[id].every(clue => state.story.collected.includes(clue)));
    const unlocked = state.round === 2 && state.finishedSections.includes('weiyan-approach') && state.panelOpened.includes('P2') && validAuthorization(state.story);
    state.supplies = restoreSupplies(state.supplies, earned, unlocked, undefined, grantReward);
    for (const id of state.supplies.worldItems?.acquired ?? []) {
        if (state.round !== 2 || (id === 'jiang-headscarf' ? !state.finishedSections.includes('jiang-commitment')
            : id === 'worn-wine-cup' ? !state.finishedSections.includes('rewind') : true)) throw new Error('物品缺少本章获取来源');
    }
    if (state.supplies.worldItems?.sold.length && !unlocked) throw new Error('出售记录缺少手机解锁');
    const owned = state.supplies.purchases;
    function check(items: unknown, decision: unknown, words: string, accepted?: boolean): ItemDecision | undefined {
        if (items === undefined && decision === undefined) return;
        if (!Array.isArray(items) || items.length > 2 || new Set(items).size !== items.length
            || items.some(id => !owned.includes(id)) || (items.length && state.round !== 2)) throw new Error('提交物品缺少采购记录');
        if (!items.length && decision !== undefined) throw new Error('判断缺少已提交物品');
        if (decision === undefined) { if (items.length && accepted !== undefined) throw new Error('缺少物品判断'); return; }
        const checked = parseItemDecision(decision, items, words);
        if (accepted !== undefined && accepted !== (!!checked.route || checked.mainlineAccepted === true)) throw new Error('物品方案与回应不一致');
        return checked;
    }
    let agreement: ItemDecision | null = null;
    for (const entry of state.story.history) {
        const decision = check(entry.items, entry.itemDecision, entry.text, entry.accepted);
        if (decision?.eraFailure && (entry.npcTurn?.classification.code !== 'P2-F1' || entry.feedback !== eraArrestReply)) throw new Error('时代失败历史不一致');
        if (decision?.mainlineAccepted && (entry.round !== 2 || entry.npcTurn?.classification.code !== 'ok')) throw new Error('主线接受缺少第二轮回应');
        if (decision?.route) {
            if (entry.round !== 2 || !entry.npcTurn || entry.npcTurn.classification.code !== 'ok') throw new Error('方案缺少第二轮回应');
            agreement = decision;
        }
    }
    const speech = state.speech;
    if (speech) {
        const speechPhase = state.phase === 'thoughts' ? state.notesReturn : state.phase;
        check(speech.items, speech.itemDecision, speech.text, speech.status === 'ready' ? speech.result === 'ok' : undefined);
        if (speech.items?.length && JSON.stringify(speech.items) !== JSON.stringify(state.supplies.attached)) throw new Error('提交后物品被更换');
        if (speech.itemDecision && !speech.npcTurn) throw new Error('缺少物品回应');
        if (speech.itemDecision?.eraFailure && (speech.result !== 'P2-F1' || speech.npcTurn?.reply.text !== eraArrestReply
            || !['spoken', 'reply', 'death'].includes(speechPhase ?? '') || (state.phase === 'death' && state.end !== 'era-arrest'))) throw new Error('时代失败阶段不一致');
        if (['reply', 'death'].includes(speechPhase ?? '') && speech.items?.length) {
            const previous = state.story.history.at(-1);
            if (JSON.stringify(previous?.items) !== JSON.stringify(speech.items)
                || JSON.stringify(previous?.itemDecision) !== JSON.stringify(speech.itemDecision)) throw new Error('物品回应历史不一致');
        }
    }
    if (JSON.stringify(state.supplies.agreement) !== JSON.stringify(agreement)) throw new Error('物品方案缺少实际同意');
    // Only an acknowledged agreement can migrate an old save into consumed items.
    // Historical speech remains tied to purchases, not the remaining inventory.
    if (legacyConsumption && agreement) consumeSupplies(state.supplies, agreement.itemIds);
    else if (agreement?.itemIds.some(id => !(state.supplies.consumed ?? []).includes(id))) throw new Error('成功交涉缺少物品消耗记录');
    if (state.supplies.attached.some(id => !isAvailableSupply(id, state.supplies))
        || speech?.items?.some(id => !isAvailableSupply(id, state.supplies))) throw new Error('已消耗物品不能再次用于发言');
    if (['radio-relay', 'light-signal', 'item-plan'].includes(state.end ?? '') && (!['ending', 'map'].includes(state.phase)
        || state.end !== agreement?.route || !state.story.flags.REPORT_CLOSED)) throw new Error('物品结局缺少交接');
    if (state.end === 'safe' && agreement?.route) throw new Error('结局与物品方案不一致');
}
