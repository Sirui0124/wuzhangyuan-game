import { worldItem } from '../inventory/world-items';
import type { PhoneHost } from '../phone/host';
import type { GameUIState } from './ui-state';
import { balance, money, parsePhonePenaltyReceipt } from '../phone/supplies';
import { parseSupplyItem } from '../phone/supply-product';
import type { PendingPhoneGuard } from '../phone/phone-state';
import { answerPhoneQuestion, phoneHistory } from './phone-assistant';

export function createShoppingController(root: HTMLElement, game: PhoneHost, ui: GameUIState, render: () => void, persist: () => void) {
    const lifetime = new AbortController();
    let request: AbortController | null = null, purchaseRequest: AbortController | null = null;
    let guardRequest: AbortController | null = null;
    let pendingPurchasePrice: number | null = null;
    let sequence = 0, generation = 0, pendingContext = '', chatRun = game.snapshot().story.run;
    let guardFlight: { id: string; generation: number; promise: Promise<'allowed' | 'blocked' | 'stale'> } | null = null;
    const sessionScope = () => { const s = game.snapshot(); return `${s.story.run}:${s.story.requestSeq}:${s.phase}`; };
    const fingerprint = () => `${sessionScope()}:${balance(game.snapshot().supplies)}`;
    const fundsMessage = (price: number) => {
        const available = balance(game.snapshot().supplies);
        return available >= price ? '' : available <= 0 ? '余额为¥0，暂时无法购买。' : `余额不足，还差¥${money(price - available)}。`;
    };
    const scrollChat = () => { const node = root.querySelector('.phone-content'); if (node) node.scrollTop = node.scrollHeight; };
    function remember(pendingGuard = game.snapshot().phone.pendingGuard) {
        game.rememberPhone({ version: 1, messages: ui.shopping.messages, intent: ui.shopping.intent, draft: ui.shopping.query,
            pending: ['waiting', 'failed'].includes(ui.shopping.status), ...(pendingGuard ? { pendingGuard } : {}) });
        persist();
    }
    function cancel(redraw = true) {
        request?.abort(); request = null; purchaseRequest?.abort(); purchaseRequest = null; sequence++;
        pendingPurchasePrice = null;
        if (ui.shopping.status === 'waiting') { ui.shopping.status = 'idle'; ui.shopping.message = '已停止回复，输入已保留。'; }
        if (ui.shopping.message === '正在确认价格…') ui.shopping.message = '';
        if (redraw) { remember(); render(); }
    }
    function reset() { ui.shopping.saleConfirm = ''; cancel(false); guardRequest?.abort(); guardRequest = null; generation++; guardFlight = null; ui.shopping.intent = 'ask'; ui.shopping.query = ''; ui.shopping.messages = []; ui.shopping.offers = []; ui.shopping.message = ''; ui.shopping.status = 'idle'; }
    function restore() {
        ui.shopping.saleConfirm = '';
        cancel(false); guardRequest?.abort(); guardRequest = null; generation++; guardFlight = null;
        const state = game.snapshot(), phone = state.phone; chatRun = state.story.run;
        ui.shopping.intent = phone.intent; ui.shopping.query = phone.draft; ui.shopping.messages = phone.messages;
        ui.shopping.offers = phone.messages.flatMap(m => m.products ?? []); ui.shopping.status = 'idle';
        ui.shopping.message = phone.pending ? '上次回复尚未完成，原话已保留，可以重新发送。' : '';
        game.rememberPhone({ ...phone, pending: false });
        if (phone.pendingGuard && game.canPrepareSupplies()) void resumeGuard(phone.pendingGuard);
    }
    function sessionChanged() {
        if (ui.restoring) return;
        const run = game.snapshot().story.run;
        if (run !== chatRun) restore();
        else if ((request || purchaseRequest) && pendingContext !== fingerprint()) {
            const price = pendingPurchasePrice;
            cancel(false);
            if (price !== null && game.canPrepareSupplies()) ui.shopping.message = fundsMessage(price) || '余额已变化，请重新确认购买。';
        }
    }
    // The guard survives closing/cancelling this UI. Its receipt is applied only to
    // this loaded session; refresh/restore retries the persisted request ID alone.
    function checkGuard(pending: PendingPhoneGuard): Promise<'allowed' | 'blocked' | 'stale'> {
        if (guardFlight?.id === pending.requestId && guardFlight.generation === generation) return guardFlight.promise;
        const run = game.snapshot().story.run, currentGeneration = generation;
        const sameSession = () => currentGeneration === generation && run === game.snapshot().story.run;
        const controller = new AbortController(); guardRequest = controller;
        const promise = (async () => {
            const response = await fetch('http://127.0.0.1:8787/api/game/phone/guard', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pending), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]), keepalive: true });
            const result = await response.json();
            if (!sameSession()) return 'stale' as const;
            if (!response.ok) throw new Error('消息核验暂不可用，原话已保留，请重试。');
            if (!result || typeof result.blocked !== 'boolean' || (!result.blocked && result.penalty !== undefined)) throw new Error('消息核验未完成，请重试。');
            if (result.blocked) {
                const receipt = parsePhonePenaltyReceipt(result.penalty);
                if (receipt.id !== pending.requestId) throw new Error('系统核验回执与消息不符，请重试。');
                game.applyPhonePenalty(receipt);
                ui.shopping.messages = game.snapshot().phone.messages;
                ui.shopping.status = 'ready'; ui.shopping.message = '';
                remember(); if (ui.overlay === 'supplies') { render(); scrollChat(); }
                return 'blocked' as const;
            }
            const phone = game.snapshot().phone;
            if (phone.pendingGuard?.requestId === pending.requestId) { game.rememberPhone({ ...phone, pendingGuard: undefined }); persist(); }
            return 'allowed' as const;
        })();
        guardFlight = { id: pending.requestId, generation: currentGeneration, promise };
        void promise.finally(() => { if (guardFlight?.promise === promise) guardFlight = null; }).catch(() => {});
        return promise;
    }
    async function resumeGuard(pending: PendingPhoneGuard) {
        const currentGeneration = generation;
        try {
            const result = await checkGuard(pending);
            if (currentGeneration !== generation || result !== 'allowed') return;
            ui.shopping.status = 'idle'; ui.shopping.message = '原话已保留，可以重新发送。';
            remember(); if (ui.overlay === 'supplies') render();
        } catch {
            if (currentGeneration !== generation) return;
            ui.shopping.status = 'failed'; ui.shopping.message = '消息核验暂不可用，原话已保留，请重试。';
            remember(); if (ui.overlay === 'supplies') render();
        }
    }
    function updateInput() {
        const button = root.querySelector<HTMLButtonElement>('[data-action=search-supplies]');
        if (button) { button.disabled = !ui.shopping.query.replace(/^(帮我买|我想问问)[\s。.…]*/, '').trim() || !game.canPrepareSupplies(); button.textContent = '发送'; }
    }
    async function send() {
        const words = ui.shopping.query.trim();
        if (request || purchaseRequest || !game.canPrepareSupplies() || !words.replace(/^(帮我买|我想问问)[\s。.…]*/, '').trim()) return;
        const unfinishedGuard = game.snapshot().phone.pendingGuard;
        if (unfinishedGuard) { void resumeGuard(unfinishedGuard); return; }
        cancel(false); const controller = new AbortController(), seq = ++sequence, history = [...ui.shopping.messages];
        const currentGeneration = generation, pendingGuard = { requestId: crypto.randomUUID(), query: words };
        request = controller; pendingContext = fingerprint();
        ui.shopping.messages.push({ role: 'user', text: words });
        ui.shopping.status = 'waiting'; ui.shopping.message = ''; remember(pendingGuard); render(); scrollChat();
        try {
            const guarded = await checkGuard(pendingGuard);
            if (guarded !== 'allowed' || controller.signal.aborted || seq !== sequence || currentGeneration !== generation
                || pendingContext !== fingerprint() || ui.overlay !== 'supplies' || ui.home) return;
            const buying = !words.startsWith('我想问问') && (/买|采购|购物|报价/.test(words) || ui.shopping.intent === 'buy');
            ui.shopping.intent = buying ? 'buy' : 'ask';
            remember();
            let message: string, products = [] as ReturnType<typeof parseSupplyItem>[];
            if (buying) {
                const response = await fetch('http://127.0.0.1:8787/api/game/shop', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: words, guardRequestId: pendingGuard.requestId, budget: balance(game.snapshot().supplies), history: phoneHistory(history) }),
                    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(80000)]) });
                if (response.status === 404) throw new Error('采购服务尚未更新，请重启本地游戏服务后再试。');
                const result = await response.json();
                if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : '采购暂时不可用，请重试。');
                if (!result || typeof result.message !== 'string' || result.message.length > 300 || !Array.isArray(result.products) || result.products.length > 3)
                    throw new Error('商品建议未完整返回，请重试。');
                products = result.products.map(parseSupplyItem); message = result.message;
            } else message = await answerPhoneQuestion(game, words, history, controller.signal);
            if (controller.signal.aborted || seq !== sequence || pendingContext !== fingerprint() || ui.overlay !== 'supplies' || ui.home) return;
            ui.shopping.messages.push({ role: 'assistant', text: message, products });
            ui.shopping.offers.push(...products); ui.shopping.query = ''; ui.shopping.status = 'ready'; remember(); render(); scrollChat();
        } catch (error) {
            if (!controller.signal.aborted && seq === sequence && pendingContext === fingerprint()) {
                ui.shopping.status = 'failed'; ui.shopping.message = error instanceof Error ? error.message : '回复失败，输入已保留。'; remember(); render(); scrollChat();
            }
        } finally { if (request === controller) { request = null; if (ui.shopping.status === 'waiting') ui.shopping.status = 'idle'; } }
    }
    async function purchase(offerId: string) {
        if (purchaseRequest || request) return;
        if (game.snapshot().phone.pendingGuard) { ui.shopping.message = '请先完成上一条消息的核验。'; render(); return; }
        const item = ui.shopping.offers.find(p => p.id === offerId); if (!item || !game.canPrepareSupplies()) return;
        if (game.snapshot().supplies.purchases.includes(item.id)) { render(); return; }
        const insufficient = fundsMessage(item.price);
        if (insufficient) { ui.shopping.message = insufficient; render(); return; }
        const controller = new AbortController(), seq = ++sequence, currentGeneration = generation, context = sessionScope();
        purchaseRequest = controller; pendingPurchasePrice = item.price; pendingContext = fingerprint();
        ui.shopping.message = '正在确认价格…'; render();
        root.querySelectorAll<HTMLButtonElement>('[data-buy-offer]').forEach(button => { button.disabled = true; });
        const current = () => !controller.signal.aborted && seq === sequence && currentGeneration === generation
            && context === sessionScope() && ui.overlay === 'supplies' && !ui.home;
        try {
            const response = await fetch('http://127.0.0.1:8787/api/game/shop/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ offerId }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
            const result = await response.json();
            if (!current()) return;
            if (!response.ok) throw new Error(response.status === 409 ? '这份报价已失效，请重新查询。' : '价格确认暂不可用，请重试。');
            const confirmed = parseSupplyItem(result?.product);
            if (confirmed.id !== item.id || confirmed.price !== item.price || confirmed.name !== item.name
                || confirmed.priceKey !== item.priceKey || JSON.stringify(confirmed.specification) !== JSON.stringify(item.specification))
                throw new Error('商品或价格已变化，请重新查询。');
            const insufficient = fundsMessage(confirmed.price);
            if (insufficient) { ui.shopping.message = insufficient; return; }
            // The purchase emits a balance change; finish this request before that
            // event so the controller does not mistake its own commit for a race.
            purchaseRequest = null; pendingPurchasePrice = null;
            if (game.buySuggestedItem(confirmed)) {
                ui.shopping.messages = ui.shopping.messages.map(message => ({ ...message,
                    ...(message.products ? { products: message.products.map(product => product.id === confirmed.id ? confirmed : product) } : {}) }));
                ui.shopping.offers = ui.shopping.offers.map(product => product.id === confirmed.id ? confirmed : product);
                ui.shopping.messages.push({ role: 'assistant', text: `已用 ¥${(confirmed.price / 100).toFixed(2)} 购入「${confirmed.name}」。` }); ui.shopping.message = '';
            } else ui.shopping.message = '本次未购买，请检查余额或当前交涉状态。';
            remember(); render();
        } catch (error) {
            if (current()) { ui.shopping.message = error instanceof Error ? error.message : '价格确认暂不可用，请重试。'; render(); }
        } finally {
            if (purchaseRequest === controller) { purchaseRequest = null; pendingPurchasePrice = null; if (current()) { if (ui.shopping.message === '正在确认价格…') ui.shopping.message = ''; render(); } }
        }
    }
    root.addEventListener('input', event => {
        const target = event.target as HTMLTextAreaElement;
        if (target.id !== 'shopping-query') return;
        if (request || purchaseRequest) cancel(false);
        ui.shopping.query = target.value.slice(0, 600); ui.shopping.status = 'idle'; ui.shopping.message = '';
        const status = root.querySelector('.shopping-status'); if (status) status.textContent = '';
        const stop = root.querySelector<HTMLButtonElement>('[data-action=cancel-shopping]');
        if (stop) { stop.dataset.action = 'search-supplies'; stop.textContent = '发送'; }
        remember(); updateInput();
    }, { signal: lifetime.signal });
    root.addEventListener('click', event => {
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
        if (!target) return;
        if (['menu', 'close-modal', 'new-confirmed'].includes(target.dataset.action ?? '') || target.dataset.loadSlot) { cancel(false); remember(); }
        if (ui.overlay !== 'supplies' || !target.closest('.game-modal') || target.disabled) return;
        if (target.dataset.sellWorldItem && game.canPrepareSupplies()) { ui.shopping.saleConfirm = target.dataset.sellWorldItem; render(); return; }
        if (target.dataset.cancelSale !== undefined) { ui.shopping.saleConfirm = ''; render(); return; }
        if (target.dataset.confirmSale && target.dataset.confirmSale === ui.shopping.saleConfirm && game.canPrepareSupplies()) {
            const item = worldItem(target.dataset.confirmSale); ui.shopping.saleConfirm = '';
            cancel(false);
            if (item && game.sellWorldItem?.(item.id)) {
                ui.shopping.messages.push({ role: 'assistant', text: `已出售${item.name}，获得 ¥${money(item.value)}，余额 ¥${money(balance(game.snapshot().supplies))}。` });
                remember();
            }
            render(); return;
        }
        if (target.dataset.action === 'search-supplies') void send();
        if (target.dataset.action === 'cancel-shopping') cancel();
        if (target.dataset.phonePrompt === 'buy' || target.dataset.phonePrompt === 'ask') {
            cancel(false); ui.shopping.intent = target.dataset.phonePrompt; ui.shopping.query = target.dataset.phonePrompt === 'buy' ? '帮我买' : '我想问问'; ui.shopping.message = ''; remember(); render();
            const input = root.querySelector<HTMLTextAreaElement>('#shopping-query'); input?.focus(); input?.setSelectionRange(input.value.length, input.value.length);
        }
        if (target.dataset.buyOffer) void purchase(target.dataset.buyOffer);
    }, { signal: lifetime.signal });
    root.addEventListener('keydown', event => {
        if ((event.target as HTMLElement).id === 'shopping-query' && event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void send(); }
        if (ui.overlay === 'supplies' && event.key === 'Tab') {
            const controls = Array.from(root.querySelectorAll<HTMLElement>('.phone-panel button:not(:disabled),.phone-panel textarea,.phone-panel a,.phone-panel summary')).filter(e => e.getClientRects().length);
            const current = controls.indexOf(document.activeElement as HTMLElement);
            if (current < 0 || (!event.shiftKey && current === controls.length - 1) || (event.shiftKey && current === 0)) {
                event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0]?.focus();
            }
        }
    }, { signal: lifetime.signal });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && ui.overlay === 'supplies') { cancel(false); remember(); } }, { capture: true, signal: lifetime.signal });
    window.addEventListener('pagehide', () => invalidate(), { signal: lifetime.signal });
    function invalidate() { ui.shopping.saleConfirm = ''; cancel(false); guardRequest?.abort(); guardRequest = null; generation++; guardFlight = null; }
    return { cancel, sessionChanged, reset, restore, invalidate, dispose() { invalidate(); lifetime.abort(); } };
}
