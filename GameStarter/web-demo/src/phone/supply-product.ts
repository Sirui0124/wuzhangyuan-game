export type SupplySpecificationPart = { item: string; brand: string; model: string; variant: string; quantity: number; unit: string };
export type SupplySpecification = SupplySpecificationPart & { components: SupplySpecificationPart[] };
export type SupplyItem = {
    id: string; name: string; price: number; icon: string; ability: string; boundary: string;
    source: string; quote: string; date: string;
    priceKind?: 'search' | 'estimate' | 'configured'; why?: string; request?: string;
    searchState?: 'searched' | 'empty' | 'unavailable' | 'not-needed';
    sources?: { title: string; url: string; snippet: string }[];
    specification?: SupplySpecification; priceKey?: string; pricingVersion?: 1;
};
function link(value: unknown) {
    if (typeof value !== 'string') return false;
    try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password && !u.port
        && u.hostname.includes('.') && !/[\[\]:]/.test(u.hostname) && !/^[\d.]+$/.test(u.hostname) && !/(^|\.)(localhost|local|internal)$/.test(u.hostname); } catch { return false; }
}
const prose = (v: unknown, max: number): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\u0000-\u001f]/.test(v);
const requestText = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.length <= 600
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(v);
const units = ['件', '套', '个', '支', '本', '张', '米', '厘米', '公斤', '克', '升', '毫升', '对', '台', '盒', '包', '卷', '条', '瓶', '枚', '双', '把', '桶', '片', '块'];
function specificationPart(raw: unknown): SupplySpecificationPart {
    const value = raw as SupplySpecificationPart;
    if (!value || !prose(value.item, 32) || !['brand', 'model', 'variant'].every(key => {
        const field = value[key as 'brand' | 'model' | 'variant']; return field === '' || prose(field, key === 'brand' ? 32 : key === 'model' ? 48 : 80);
    }) || !Number.isFinite(value.quantity) || value.quantity <= 0 || value.quantity > 1000000
        || Number(value.quantity.toFixed(3)) !== value.quantity || !units.includes(value.unit)) throw new Error('商品规格不完整，请重新查询。');
    return { item: value.item, brand: value.brand, model: value.model, variant: value.variant, quantity: value.quantity, unit: value.unit };
}
function specification(raw: unknown): SupplySpecification {
    const value = raw as SupplySpecification;
    const part = specificationPart(raw);
    if (!Array.isArray(value.components) || value.components.length > 12) throw new Error('商品规格不完整，请重新查询。');
    return { ...part, components: value.components.map(specificationPart) };
}
/** No model-supplied HTML, arbitrary URLs, nonfinite prices or static item ID collisions. */
export function parseSupplyItem(value: unknown): SupplyItem {
    const v = value as SupplyItem;
    if (!v || !/^shop-[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/.test(v.id) || !prose(v.name, 80)
        || !Number.isSafeInteger(v.price) || v.price <= 0 || v.price > 100000000000 || !prose(v.ability, 220)
        || !prose(v.boundary, 300) || !prose(v.quote, 200) || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)
        || !['search', 'estimate', 'configured'].includes(v.priceKind ?? '') || !prose(v.why, 160) || !requestText(v.request)
        || !(v.priceKind === 'configured' ? v.searchState === 'not-needed' : ['searched', 'empty', 'unavailable'].includes(v.searchState ?? ''))
        || !Array.isArray(v.sources) || v.sources.length > 6 || v.sources.some(s => !prose(s.title, 160) || typeof s.snippet !== 'string' || s.snippet.length > 420 || !link(s.url))
        || (v.priceKind === 'search' ? !link(v.source) || !v.sources.some(s => s.url === v.source && (s.title.includes(v.quote) || s.snippet.includes(v.quote))) : v.source !== '')
        || (v.priceKind === 'configured' && v.sources.length !== 0))
        throw new Error('商品信息或报价不完整，请重新查询。');
    const hasPricing = v.specification !== undefined || v.priceKey !== undefined || v.pricingVersion !== undefined || v.priceKind === 'configured';
    if (hasPricing && (v.pricingVersion !== 1 || typeof v.priceKey !== 'string' || !/^[a-f\d]{64}$/.test(v.priceKey))) throw new Error('商品价格记录不完整，请重新查询。');
    const spec = hasPricing ? specification(v.specification) : undefined;
    return { id: v.id, name: v.name, price: v.price, icon: '物', ability: v.ability, boundary: v.boundary,
        source: v.source, quote: v.quote, date: v.date, priceKind: v.priceKind, why: v.why, request: v.request,
        searchState: v.searchState, sources: v.sources.map(s => ({ title: s.title, url: s.url, snippet: s.snippet })),
        ...(spec ? { specification: spec, priceKey: v.priceKey, pricingVersion: 1 as const } : {}) };
}
