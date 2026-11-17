/** Inventory search is UI-only: filtering never changes the selected evidence. */
export function createThoughtInventory(root: HTMLElement, onLayout: () => void, onCompositionEnd: () => void) {
    let query = '', composing = false, pageSelector = '.is-current-page';
    const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase();
    const filter = () => {
        const inventory = root.querySelector<HTMLElement>('.thought-inventory');
        if (!inventory) return;
        const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
        let matches = 0;
        inventory.querySelectorAll<HTMLElement>('.inventory-entry').forEach(entry => {
            const text = normalize(entry.dataset.searchText ?? entry.textContent ?? '');
            const visible = terms.every(term => text.includes(term));
            entry.hidden = !visible;
            // Explicit display also works with the existing inventory grid styles.
            entry.style.display = visible ? '' : 'none';
            if (visible) matches++;
        });
        const empty = inventory.querySelector<HTMLElement>('[data-inventory-empty]');
        if (empty) empty.hidden = matches > 0;
        const count = inventory.querySelector<HTMLElement>('[data-inventory-count]');
        if (count) count.textContent = String(matches);
        const clear = inventory.querySelector<HTMLButtonElement>('[data-action="clear-inventory-search"]');
        if (clear) { clear.hidden = !query; clear.disabled = !query; }
        onLayout();
    };
    const mount = (anchor?: HTMLElement) => {
        const host = root.querySelector<HTMLElement>('.workspace-screen');
        const inventory = host?.querySelector<HTMLElement>('.thought-inventory');
        if (!host) return;
        // Inspect history in place; search and details travel together below that step.
        // Expression uses the same in-flow inspection pair below selected evidence.
        if (!host.classList.contains('expression-workspace')) {
            const anchoredPage = anchor?.closest<HTMLElement>('.thought-page');
            if (anchoredPage) pageSelector = anchoredPage.dataset.recordIndex === undefined ? '.is-current-page' : `[data-record-index="${CSS.escape(anchoredPage.dataset.recordIndex)}"]`;
            const page = anchoredPage ?? host.querySelector<HTMLElement>(pageSelector) ?? host.querySelector<HTMLElement>('.is-current-page');
            const canvas = host.querySelector<HTMLElement>('.workspace-layout'), scrollTop = canvas?.scrollTop;
            let slot = page?.querySelector<HTMLElement>('.thought-inspection-slot');
            if (page && !slot) {
                slot = document.createElement('div'); slot.className = 'thought-inspection-slot'; slot.setAttribute('aria-label', '查阅线索'); page.append(slot);
            } else if (!page && !slot) {
                const tail = host.querySelector<HTMLElement>('.thought-editor,.thought-action');
                if (tail) { slot = document.createElement('div'); slot.className = 'thought-inspection-slot'; tail.after(slot); }
            }
            if (slot && inventory && inventory.parentElement !== slot) {
                const oldSlot = inventory.closest<HTMLElement>('.thought-inspection-slot');
                oldSlot?.style.removeProperty('--inspection-height');
                slot.append(inventory);
                const detail = host.querySelector<HTMLElement>('.thought-detail-popover');
                if (detail) slot.append(detail);
            }
            if (canvas && scrollTop !== undefined) canvas.scrollTop = scrollTop;
        } else {
            const slot = host.querySelector<HTMLElement>('.expression-inspection-slot');
            if (slot && inventory) {
                slot.append(inventory);
                const detail = host.querySelector<HTMLElement>('.thought-detail-popover');
                if (detail) slot.append(detail);
            }
        }
        const input = inventory?.querySelector<HTMLInputElement>('[data-inventory-search]');
        if (input) input.value = query;
        filter();
    };
    const clear = () => {
        query = '';
        const input = root.querySelector<HTMLInputElement>('[data-inventory-search]');
        if (input) { input.value = ''; input.focus({ preventScroll: true }); }
        filter();
    };
    root.addEventListener('input', event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.matches('[data-inventory-search]')) return;
        query = input.value;
        const scroll = input.closest('.thought-inventory')?.querySelector('.inventory-scroll');
        if (scroll) scroll.scrollTop = 0;
        filter();
    });
    root.addEventListener('compositionstart', event => {
        if ((event.target as HTMLElement).matches('[data-inventory-search]')) composing = true;
    });
    root.addEventListener('compositionend', event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.matches('[data-inventory-search]')) return;
        composing = false; query = input.value; filter(); onCompositionEnd();
    });
    return { mount, clear, isComposing: () => composing, reset: () => { query = ''; composing = false; pageSelector = '.is-current-page'; } };
}
