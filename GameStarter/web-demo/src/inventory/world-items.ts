/** Authored objects acquired in the world; distinct from phone purchases and evidence. */
export const worldItems = [
    { id: 'jiang-headscarf', chapter: 'wuzhang', name: '姜维赠予的头巾', value: 2000,
        description: '姜维在交谈后递来的头巾。', receipt: '姜维递来一条头巾：“看你满头是汗，拿去擦擦。”\n获得：姜维赠予的头巾。' },
    { id: 'worn-wine-cup', chapter: 'wuzhang', name: '破旧的酒杯', value: 500,
        description: '在营地野草中拾到，杯沿已有磨损。', receipt: '拨开野草，亮光来自一只破旧的酒杯。你将它拾起，放进物品栏。' },
    { id: 'tent-candlestick', chapter: 'grain', name: '军帐里的蜡烛台', value: 1000,
        description: '从自己的军帐里带走的蜡烛台。', receipt: '你拿起案上的蜡烛台，收进随身物品中。' },
    { id: 'fuhu-wood-tiger', chapter: 'jieting', name: '伏虎木雕', value: 50000,
        description: '马谡随手赏的小木虎，背上磨得发亮。可出售500元。', receipt: '我接过伏虎木雕，小心收进衣里。' },
] as const;
export type WorldItemId = typeof worldItems[number]['id'];
export type WorldInventory = { acquired: WorldItemId[]; sold: WorldItemId[] };
export const freshWorldInventory = (): WorldInventory => ({ acquired: [], sold: [] });
export const worldItem = (id: string) => worldItems.find(item => item.id === id);
export const ownedWorldItems = (inventory?: WorldInventory) => worldItems.filter(item => inventory?.acquired.includes(item.id) && !inventory.sold.includes(item.id));
export const saleIncome = (inventory?: WorldInventory) => (inventory?.sold ?? []).reduce((sum, id) => sum + (worldItem(id)?.value ?? 0), 0);
export function acquireWorldItem(inventory: WorldInventory, id: string) {
    const item = worldItem(id);
    if (!item || inventory.acquired.includes(item.id)) return false;
    inventory.acquired.push(item.id); return true;
}
export function sellWorldItem(inventory: WorldInventory, id: string) {
    const item = worldItem(id);
    if (!item || !inventory.acquired.includes(item.id) || inventory.sold.includes(item.id)) return false;
    inventory.sold.push(item.id); return true;
}
export function restoreWorldInventory(raw: unknown): WorldInventory {
    if (raw === undefined) return freshWorldInventory();
    const value = raw as WorldInventory;
    const ids = (list: unknown): list is WorldItemId[] => Array.isArray(list) && list.every(id => typeof id === 'string' && worldItem(id)) && new Set(list).size === list.length;
    if (!value || !ids(value.acquired) || !ids(value.sold) || value.sold.some(id => !value.acquired.includes(id))) throw new Error('物品或出售记录不完整');
    return { acquired: [...value.acquired], sold: [...value.sold] };
}
