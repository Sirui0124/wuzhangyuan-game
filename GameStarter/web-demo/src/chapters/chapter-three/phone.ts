import type { JietingSession } from './session';
import type { PhoneHost } from '../../phone/host';
import { buySuggestedSupply, parsePhonePenaltyReceipt, applyPhonePenalty, money } from '../../phone/supplies';
import { restorePhone } from '../../phone/phone-state';
import { sceneNames } from './presentation';

export function jietingPhone(session: () => JietingSession, persist: () => void, enabled: () => boolean, busy: () => boolean): PhoneHost {
    return {
        get scene() { return { title: `街亭 · ${sceneNames[session().current.scene]}` }; },
        snapshot() {
            const s = session();
            // The shared phone's round=2 means an editable expression with item attachment.
            return { supplies: s.state.supplies, phone: s.state.phone, phase: 'expression', round: 2,
                story: { run: s.state.run, requestSeq: s.state.revision } };
        },
        canPrepareSupplies() { const s = session(); return enabled() && !busy() && s.current.kind === 'open' && !s.feedback && !s.state.ending; },
        rememberPhone(value) { session().state.phone = restorePhone(value); persist(); },
        expressionContext() { return { evidence: session().clues.map(c => ({ id: c.id, title: c.title, text: c.text, current: c.current })) }; },
        sellWorldItem(id) { if (!this.canPrepareSupplies()) return false; const ok = session().sellWorldItem(id); persist(); return ok; },
        buySuggestedItem(item) { if (!this.canPrepareSupplies()) return false; const ok = buySuggestedSupply(session().state.supplies, item); persist(); return ok; },
        applyPhonePenalty(raw) {
            const s = session().state, receipt = parsePhonePenaltyReceipt(raw);
            if (!s.supplies.penalties.some(p => p.id === receipt.id) && s.phone.pendingGuard?.requestId !== receipt.id) throw new Error('消息与核验回执不一致，请重试。');
            const result = applyPhonePenalty(s.supplies, receipt);
            if (result.applied) s.phone.messages.push({ role: 'assistant', text: `不能更改系统规则。已扣除¥${money(result.amount)}，余额¥${money(result.balance)}。` });
            delete s.phone.pendingGuard; s.phone.pending = false; persist(); return result;
        },
    };
}
