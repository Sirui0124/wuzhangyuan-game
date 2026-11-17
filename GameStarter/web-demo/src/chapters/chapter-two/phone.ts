import type { GrainSession } from './session';
import { buySuggestedSupply, isAvailableSupply, applyPhonePenalty, money, parsePhonePenaltyReceipt } from '../../phone/supplies';
import { restorePhone } from '../../phone/phone-state';
import type { PhoneHost } from '../../phone/host';
export function grainPhone(session: () => GrainSession, persist: () => void, enabled: () => boolean = () => true): PhoneHost {
    return {
        scene: {title: '永安 · 苟安伤帐'},
        snapshot() { const s = session(); return { supplies: s.state.supplies, phone: s.state.phone, phase: s.current.kind === 'open' ? 'expression' : 'dialogue', round: 2, story: {run: s.state.run, requestSeq: 0} }; },
        canPrepareSupplies() { return enabled() && session().current.kind === 'open' && !session().eraFailure && !session().state.end; },
        sellWorldItem(id) { if (!this.canPrepareSupplies()) return false; const ok = session().sellWorldItem(id); persist(); return ok; },
        rememberPhone(value) { session().state.phone = restorePhone(value); persist(); },
        expressionContext() { return { evidence: session().clues }; },
        buySuggestedItem(item) { if (!this.canPrepareSupplies()) return false; const ok = buySuggestedSupply(session().state.supplies, item); persist(); return ok; },
        applyPhonePenalty(raw) {
            const s = session().state, receipt = parsePhonePenaltyReceipt(raw);
            if (!s.supplies.penalties.some(p => p.id === receipt.id) && s.phone.pendingGuard?.requestId !== receipt.id) throw new Error('系统核验回执与消息不符');
            const result = applyPhonePenalty(s.supplies, receipt);
            if (result.applied) s.phone.messages.push({role:'assistant',text:`不能更改系统规则。已扣除¥${money(result.amount)}，余额¥${money(result.balance)}。`});
            delete s.phone.pendingGuard; s.phone.pending = false; persist(); return result;
        }
    };
}
export function toggleGrainItem(session: GrainSession, id: string) {
    if (!session.phoneAllowed || session.current.kind !== 'open' || session.eraFailure || session.state.end || !isAvailableSupply(id, session.state.supplies)) return;
    const s = session.state.supplies;
    if (s.attached.includes(id)) s.attached = s.attached.filter(i => i !== id);
    else if (s.attached.length < 2) s.attached.push(id);
}
