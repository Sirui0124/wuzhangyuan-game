import { parseSupplyItem, type SupplyItem } from './supply-product';
import { validPhoneRequestId } from './supplies';
export type PhoneMessage = { role: 'user' | 'assistant'; text: string; products?: SupplyItem[] };
export type PendingPhoneGuard = { requestId: string; query: string };
export type PhoneSave = { version: 1; messages: PhoneMessage[]; intent: 'ask' | 'buy'; draft: string; pending: boolean; pendingGuard?: PendingPhoneGuard };
export const freshPhone = (): PhoneSave => ({ version: 1, messages: [], intent: 'ask', draft: '', pending: false });
/** Chat is part of this chapter save; it never grants ownership, money or story facts. */
export function restorePhone(value: unknown): PhoneSave {
    if (value === undefined) return freshPhone();
    const v = value as PhoneSave;
    if (!v || v.version !== 1 || !['ask', 'buy'].includes(v.intent) || typeof v.draft !== 'string' || v.draft.length > 600
        || typeof v.pending !== 'boolean' || !Array.isArray(v.messages)) throw new Error('手机聊天记录格式无效');
    if (v.pendingGuard !== undefined && (!v.pendingGuard || !validPhoneRequestId(v.pendingGuard.requestId)
        || typeof v.pendingGuard.query !== 'string' || !v.pendingGuard.query.trim() || v.pendingGuard.query.length > 600
        || !v.messages.some(m => m?.role === 'user' && m.text === v.pendingGuard!.query))) throw new Error('待核验消息格式无效');
    const ids = new Set<string>();
    const messages = v.messages.map(m => {
        if (!m || !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string' || !m.text.trim() || m.text.length > 2400
            || (m.products !== undefined && (!Array.isArray(m.products) || m.products.length > 3 || m.role !== 'assistant'))) throw new Error('手机消息格式无效');
        const products = m.products?.map(p => { const item = parseSupplyItem(p); if (ids.has(item.id)) throw new Error('手机报价重复'); ids.add(item.id); return item; });
        return { role: m.role, text: m.text, ...(products ? { products } : {}) };
    });
    return { version: 1, messages, intent: v.intent, draft: v.draft, pending: v.pending,
        ...(v.pendingGuard ? { pendingGuard: { requestId: v.pendingGuard.requestId, query: v.pendingGuard.query } } : {}) };
}
