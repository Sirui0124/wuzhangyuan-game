type Receipt = { root: HTMLElement; text: string; reduced: boolean; origin?: DOMRect; kind: 'clue' | 'item' };
const pending: Receipt[] = [];
let frame = 0, active: Animation | null = null;
const pulses = new Set<Animation>();

export function clearClueReceipts() {
    cancelAnimationFrame(frame); frame = 0; pending.length = 0;
    const previous = active; active = null; previous?.cancel();
    for (const pulse of pulses) pulse.cancel();
    pulses.clear();
    document.querySelectorAll('.clue-receipt').forEach(node => node.remove());
    const status = document.querySelector('#clue-receipt-status');
    if (status) status.textContent = '';
}

/** Presentation only: called after a real clue event; never changes story state. */
export function showClueReceipt(root: HTMLElement, text: string, reduced: boolean, origin?: DOMRect) {
    pending.push({ root, text, reduced, origin, kind: 'clue' });
    playNext();
}

/** The item has already been acquired and saved; animation only acknowledges it. */
export function showItemReceipt(root: HTMLElement, text: string, reduced: boolean, origin?: DOMRect) {
    pending.push({ root, text, reduced, origin: origin ?? new DOMRect(innerWidth * .45, innerHeight * .65, 0, 0), kind: 'item' });
    playNext();
}

function playNext() {
    if (active || frame || !pending.length) return;
    frame = requestAnimationFrame(() => {
        frame = 0;
        const { root, text, reduced, origin, kind } = pending.shift()!;
        const selector = kind === 'item' ? '[data-action="bag"]' : '[data-action="notes"]';
        const destination = root.querySelector<HTMLElement>(selector);
        if (!destination || !destination.getClientRects().length) { playNext(); return; }
        const target = destination.getBoundingClientRect();
        const receipt = document.createElement('div');
        receipt.className = `clue-receipt${kind === 'item' ? ' item-receipt' : ''}`;
        receipt.dataset.receiptDestination = kind === 'item' ? 'bag' : 'notes';
        receipt.setAttribute('aria-hidden', 'true');
        const caption = document.createElement('span');
        caption.textContent = text;
        const mark = document.createElement('small');
        mark.textContent = kind === 'item' ? '收进物品栏' : '收进思绪';
        receipt.append(caption, mark);
        document.body.append(receipt);
        let status = document.querySelector<HTMLElement>('#clue-receipt-status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'clue-receipt-status'; status.className = 'clue-receipt-status';
            status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
            document.body.append(status);
        }
        status.textContent = `已${mark.textContent}：${text}`;
        const width = receipt.getBoundingClientRect().width;
        const endX = Math.max(12, Math.min(innerWidth - width - 12, target.x + target.width / 2 - width / 2));
        const endY = target.bottom + 16;
        const x = reduced || !origin ? endX : Math.min(innerWidth - width - 12, origin.x + 28);
        const y = reduced || !origin ? endY : Math.max(endY, origin.y - 48);
        receipt.style.left = `${x}px`; receipt.style.top = `${y}px`;
        const animation = active = receipt.animate(reduced ? [
            { opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 1, offset: .8 }, { opacity: 0 },
        ] : [
            { opacity: 0, transform: 'translateY(12px)' },
            { opacity: 1, transform: 'translateY(0)', offset: .16 },
            { opacity: 1, transform: 'translateY(-10px)', offset: .52 },
            { opacity: .65, transform: `translate(${endX - x}px, ${endY - y}px) scale(.8)`, offset: .86 },
            { opacity: 0, transform: `translate(${endX - x}px, ${endY - y - 12}px) scale(.65)` },
        ], { duration: reduced ? 1700 : 1900, easing: 'ease-in-out', fill: 'forwards' });
        animation.finished.then(() => {
            receipt.remove();
            if (active !== animation) return;
            active = null;
            // A new line can replace the HUD while the receipt is in flight.
            const pulse = root.querySelector<HTMLElement>(selector)?.animate(
                [{ color: '#b0c3a5' }, { color: '#e0dccb' }], { duration: reduced ? 0 : 450 });
            if (pulse) { pulses.add(pulse); pulse.finished.then(() => pulses.delete(pulse), () => pulses.delete(pulse)); }
            playNext();
        }).catch(() => receipt.remove());
    });
}
