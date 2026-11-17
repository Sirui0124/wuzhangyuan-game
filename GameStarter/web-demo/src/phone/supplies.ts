import { restoreWorldInventory, freshWorldInventory, saleIncome, type WorldInventory } from '../inventory/world-items';
import { parseSupplyItem, type SupplyItem } from './supply-product';
import { parseEraFailure, type EraFailure } from './era-judgment';
export type { SupplyItem } from './supply-product';
/** Legacy quick choices are retained for existing saves; custom products are stored with their quote. */
export const supplyCatalog = [
    { id: 'radio-pair', name: '小米对讲机2S · 两台', price: 53800, icon: '讯',
        ability: '两台配对后可在营地附近直接通话，不依赖手机网络。',
        boundary: '需要两端各有人操作、先试通；不能跨越任意距离，不能证明丞相生死或代替本人授权。',
        source: 'https://www.xiaomiyoupin.com/detail?gid=157450', quote: '单台参考价269元，两台538元', date: '2026-10-24' },
    { id: 'flashlight', name: '米家多功能手电筒', price: 19900, icon: '光',
        ability: '可开关照明，在可视范围内配合预先约定的灯号。',
        boundary: '收发双方须事先约定含义并试验视线；光不能自行表达整份军报，也不是神迹或生死证据。',
        source: 'https://m.mi.com/commodity/list/1600', quote: '采用页面划线参考价199元，不计优惠券', date: '2026-10-24' },
    { id: 'batteries', name: '5号彩虹电池 · 十粒', price: 1390, icon: '电',
        ability: '为兼容5号电池的器具供电。',
        boundary: '本目录的对讲机和手电筒使用内置充电电池，不能用这些电池直接替换；不能凭电池生成新器具。',
        source: 'https://m.mi.com/commodity/list/1600', quote: '页面参考价13.9元', date: '2026-10-24' },
] as const;
export type SupplyId = string;
export type ItemRoute = 'radio-relay' | 'light-signal' | 'item-plan';
export type ItemDecision = { version: 1; route: ItemRoute | null; itemIds: SupplyId[]; quote: string; reason: string; eraFailure?: EraFailure; mainlineAccepted?: true };
export const CHAPTER_ALLOWANCE = 5000;
export const ACTION_TOPUP = 'weiyan-action';
export const PHONE_PENALTY = 5000;
export type PhonePenalty = { id: string; amount: number };
export type PhonePenaltyReceipt = PhonePenalty & { reason: string };
export const validPhoneRequestId = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
export type Supplies = { version: 2; worldItems?: WorldInventory; rewards: string[]; purchases: SupplyId[]; attached: SupplyId[]; agreement: ItemDecision | null; custom?: SupplyItem[]; legacyPurchases?: SupplyId[]; penalties: PhonePenalty[]; consumed?: SupplyId[] };
export const freshSupplies = (): Supplies => ({ version: 2, worldItems: freshWorldInventory(), rewards: [], purchases: [], attached: [], agreement: null, custom: [], penalties: [], consumed: [] });
export const supplyById = (id: string, supplies?: Supplies): SupplyItem | undefined => supplyCatalog.find(item => item.id === id) ?? supplies?.custom?.find(item => item.id === id);
export const isAvailableSupply = (id: string, supplies: Supplies) => supplies.purchases.includes(id) && !(supplies.consumed ?? []).includes(id);
/** Consumption never removes the purchase ledger or refunds its settled price. */
export function consumeSupplies(supplies: Supplies, ids: readonly string[]) {
    if (ids.some(id => !supplies.purchases.includes(id))) throw new Error('消耗物品缺少采购记录');
    supplies.consumed = [...new Set([...(supplies.consumed ?? []), ...ids])];
    supplies.attached = supplies.attached.filter(id => !supplies.consumed!.includes(id));
}
export const money = (fen: number) => (fen / 100).toFixed(2).replace(/\.00$/, '');
export const balance = (supplies: Supplies) => Math.max(supplies.rewards.reduce((sum, id) => sum + (id === 'gouan-action' ? 2000 : CHAPTER_ALLOWANCE), 0),
    (supplies.legacyPurchases ?? []).reduce((sum, id) => sum + supplyById(id, supplies)!.price, 0))
    + saleIncome(supplies.worldItems)
    - supplies.purchases.reduce((sum, id) => sum + supplyById(id, supplies)!.price, 0)
    - (supplies.penalties ?? []).reduce((sum, entry) => sum + entry.amount, 0);
export function parsePhonePenaltyReceipt(raw: unknown): PhonePenaltyReceipt {
    const value = raw as PhonePenaltyReceipt;
    if (!value || !validPhoneRequestId(value.id) || value.amount !== PHONE_PENALTY
        || typeof value.reason !== 'string' || !value.reason.trim() || value.reason.length > 240
        || /[\u0000-\u001f]/.test(value.reason)) throw new Error('系统核验回执无效，请重试。');
    return { id: value.id, amount: PHONE_PENALTY, reason: value.reason };
}
export function applyPhonePenalty(supplies: Supplies, raw: unknown) {
    const receipt = parsePhonePenaltyReceipt(raw), previous = (supplies.penalties ?? []).find(entry => entry.id === receipt.id);
    if (previous) return { applied: false, amount: previous.amount, balance: balance(supplies) };
    const available = balance(supplies);
    if (!Number.isSafeInteger(available) || available < 0) throw new Error('行动资金记录无效');
    const amount = Math.min(available, receipt.amount);
    (supplies.penalties ??= []).push({ id: receipt.id, amount });
    return { applied: true, amount, balance: available - amount };
}
export function rechargeSupplies(supplies: Supplies, reward = ACTION_TOPUP) {
    if (!supplies.rewards.includes(reward)) supplies.rewards.push(reward);
}
export function buySupply(supplies: Supplies, id: string): boolean {
    const item = supplyById(id, supplies);
    if (!item || supplies.purchases.includes(item.id) || balance(supplies) < item.price) return false;
    supplies.purchases.push(item.id);
    return true;
}
export function buySuggestedSupply(supplies: Supplies, raw: unknown): boolean {
    const item = parseSupplyItem(raw);
    if (supplies.purchases.includes(item.id) || balance(supplies) < item.price) return false;
    supplies.custom ??= [];
    if (supplies.custom.length >= 100) return false;
    supplies.custom.push(item); supplies.purchases.push(item.id); return true;
}
export function parseItemDecision(value: unknown, items: readonly string[], words: string): ItemDecision {
    const d = value as ItemDecision;
    if (!d || d.version !== 1 || ![null, 'radio-relay', 'light-signal', 'item-plan'].includes(d.route)
        || !Array.isArray(d.itemIds) || d.itemIds.length > 2 || new Set(d.itemIds).size !== d.itemIds.length
        || d.itemIds.some(id => typeof id !== 'string' || !items.includes(id))
        || typeof d.quote !== 'string' || d.quote.length > 1200 || (d.quote && !words.includes(d.quote))
        || typeof d.reason !== 'string' || !d.reason.trim() || d.reason.length > 240)
        throw new Error('物品判断不兼容');
    if (d.route && (!d.quote.trim() || !d.itemIds.length)) throw new Error('方案缺少实际物品或原话');
    const eraFailure = d.eraFailure === undefined ? undefined : parseEraFailure(d.eraFailure, items, words);
    // An incidental item does not become an adopted plan. This marker is set only after the normal dialogue judge accepts.
    if (d.mainlineAccepted !== undefined && (d.mainlineAccepted !== true || d.route !== null || d.itemIds.length || d.quote || eraFailure))
        throw new Error('主线接受与物品方案冲突');
    if (eraFailure && (d.route !== null || JSON.stringify(d.itemIds) !== JSON.stringify(eraFailure.itemIds) || d.quote !== eraFailure.quote || d.reason !== eraFailure.reason))
        throw new Error('时代失败与物品方案冲突');
    return { version: 1, route: d.route, itemIds: [...d.itemIds], quote: d.quote, reason: d.reason, ...(eraFailure ? { eraFailure } : {}), ...(d.mainlineAccepted ? { mainlineAccepted: true } : {}) };
}
export function restoreSupplies(raw: unknown, earned: string[], unlocked: boolean, reward = ACTION_TOPUP, grantReward = true): Supplies {
    if (raw === undefined) { const fresh = freshSupplies(); if (unlocked && grantReward) rechargeSupplies(fresh, reward); return fresh; }
    const s = raw as Omit<Supplies, 'version'> & { version: number };
    if (!s || (s.custom !== undefined && (!Array.isArray(s.custom) || s.custom.length > 100))) throw new Error('动态物品记录不完整');
    const custom = (s.custom ?? []).map(parseSupplyItem);
    if (new Set(custom.map(item => item.id)).size !== custom.length) throw new Error('动态物品编号重复');
    if (s.penalties !== undefined && (!Array.isArray(s.penalties) || s.penalties.length > 10000
        || s.penalties.some(entry => !entry || !validPhoneRequestId(entry.id) || !Number.isSafeInteger(entry.amount) || entry.amount < 0 || entry.amount > PHONE_PENALTY)
        || new Set(s.penalties.map(entry => entry.id)).size !== s.penalties.length)) throw new Error('资金扣款记录无效');
    const penalties = (s.penalties ?? []).map(entry => ({ id: entry.id, amount: entry.amount }));
    if (penalties.length && (!unlocked || s.version !== 2)) throw new Error('资金扣款缺少手机解锁记录');
    const candidate = { ...s, version: 2 as const, custom, penalties, worldItems: restoreWorldInventory(s.worldItems) };
    const ids = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === 'string') && new Set(value).size === value.length;
    if (!s || ![1, 2].includes(s.version) || !ids(s.rewards)
        || !ids(s.purchases) || s.purchases.some(id => !supplyById(id, candidate)) || custom.some(item => !s.purchases.includes(item.id)) || !ids(s.attached) || s.attached.length > 2
        || s.attached.some(id => !s.purchases.includes(id as SupplyId)))
        throw new Error('采购记录缺少资金或物品来源');
    if (s.consumed !== undefined && (!ids(s.consumed) || s.consumed.some(id => !s.purchases.includes(id))))
        throw new Error('物品消耗记录无效');
    if (s.version === 1) {
        const cost = s.purchases.reduce((sum, id) => sum + supplyById(id, candidate)!.price, 0);
        if (s.rewards.some(id => !['R01', 'R02'].includes(id) || !earned.includes(id)) || cost > s.rewards.length * 30000)
            throw new Error('旧采购记录缺少资金来源');
        candidate.rewards = unlocked ? [ACTION_TOPUP] : [];
        // Preserve settled old purchases without carrying the former 600-yuan spending power forward.
        candidate.legacyPurchases = [...s.purchases];
    } else {
        if (s.rewards.some(id => id !== reward || !unlocked)
            || (s.legacyPurchases !== undefined && (!ids(s.legacyPurchases) || s.legacyPurchases.some(id => !s.purchases.includes(id)))))
            throw new Error('行动充值缺少解锁记录');
        if (unlocked && grantReward) rechargeSupplies(candidate, reward);
    }
    if (balance(candidate) < 0) throw new Error('采购超过本关资金');
    return { ...candidate, rewards: [...candidate.rewards], purchases: [...s.purchases], attached: [...s.attached], consumed: [...(s.consumed ?? [])] };
}
