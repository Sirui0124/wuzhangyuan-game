type DetailState = { id: string; trigger: string; fixed: boolean; page: string };

/** Reasoning details share the reserved area below the current evidence and results. */
export function createThoughtDetail(root: HTMLElement, title: (id: string) => string, source: (id: string) => string, kind: (id: string) => string = () => '原话与依据') {
    let anchor: HTMLElement | null = null, panel: HTMLElement | null = null, current = '', fixed = false;
    const close = (focus = false) => {
        if (!panel) return false;
        const slot = panel.closest<HTMLElement>('.thought-inspection-slot');
        panel.remove(); panel = null;
        slot?.style.removeProperty('--inspection-height');
        anchor?.setAttribute('aria-expanded', 'false');
        if (focus) {
            const target = anchor?.isConnected && anchor.getClientRects().length ? anchor : root.querySelector<HTMLElement>('[data-inventory-search]');
            target?.focus({ preventScroll: true });
        }
        anchor = null; current = ''; fixed = false; return true;
    };
    const position = () => {
        if (!panel || !anchor) return;
        const host = root.querySelector<HTMLElement>('.workspace-screen');
        if (!host || !anchor.isConnected) { close(); return; }
        if (anchor.closest<HTMLElement>('.inventory-entry')?.hidden) { close(); return; }
        const slot = panel.closest<HTMLElement>('.thought-inspection-slot');
        const inventory = host.querySelector<HTMLElement>('.thought-inventory');
        if (slot && inventory) {
            const area = slot.getBoundingClientRect(), picker = inventory.getBoundingClientRect();
            panel.style.maxWidth = `${Math.max(0, area.width)}px`;
            const size = panel.getBoundingClientRect();
            const beside = picker.right - area.left + 16;
            const side = beside + size.width <= area.width + 1 ? 'right' : 'below';
            const left = side === 'right' ? beside : Math.max(0, picker.left - area.left);
            const top = side === 'right' ? picker.top - area.top : picker.bottom - area.top + 16;
            panel.style.left = `${left}px`; panel.style.top = `${top}px`; panel.dataset.side = side;
            // Long details scroll inside their panel; the remaining page never covers it.
            slot.style.setProperty('--inspection-height', `${Math.ceil(Math.max(picker.bottom - area.top, top + size.height))}px`);
            return;
        }
        // The separate expression workspace retains its existing nearby source popover.
        const origin = anchor.closest<HTMLElement>('.inventory-entry,.working-clue,.thought-outcome') ?? anchor;
        const area = host.getBoundingClientRect(), point = origin.getBoundingClientRect(), size = panel.getBoundingClientRect();
        let left = point.right - area.left + 10, top = point.top - area.top, side = 'right';
        if (left + size.width > area.width - 12) { left = point.left - area.left - size.width - 10; side = 'left'; }
        if (left < 12) {
            left = Math.max(12, Math.min(point.left - area.left, area.width - size.width - 12));
            top = point.bottom - area.top + 8; side = 'below';
        }
        top = Math.max(12, Math.min(top, area.height - size.height - 12));
        panel.style.left = `${left}px`; panel.style.top = `${top}px`; panel.dataset.side = side;
    };
    const open = (id: string, trigger: HTMLElement, inherited = false) => {
        if (current === id && trigger === anchor) { close(); return; }
        const wasInside = !!panel?.contains(trigger), oldAnchor = anchor;
        close(); anchor = wasInside && oldAnchor?.isConnected ? oldAnchor : trigger; current = id;
        fixed = inherited || !!(!wasInside && trigger.closest('[data-fixed-thought],.inventory-entry.is-fixed'));
        const host = root.querySelector<HTMLElement>('.workspace-screen'); if (!host) return;
        panel = document.createElement('aside'); panel.className = 'thought-detail-popover'; panel.id = 'thought-detail-popover';
        panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', `${title(id)}的${kind(id)}`);
        const header = document.createElement('header'), heading = document.createElement('span'), dismiss = document.createElement('button');
        heading.textContent = title(id); dismiss.textContent = '×'; dismiss.setAttribute('aria-label', kind(id) === '物品详情' ? '关闭物品详情' : '关闭线索详情');
        dismiss.addEventListener('click', () => close(true)); header.append(heading, dismiss);
        const content = document.createElement('div'); content.className = 'thought-detail-content'; content.innerHTML = source(id);
        panel.append(header);
        if (fixed) {
            const origin = document.createElement('p'); origin.className = 'thought-detail-origin';
            origin.textContent = '当前思路的起点'; panel.append(origin);
        }
        panel.append(content);
        const slot = host.querySelector('.thought-inventory')?.closest<HTMLElement>('.thought-inspection-slot');
        (slot || host).append(panel);
        anchor.setAttribute('aria-expanded', 'true'); anchor.setAttribute('aria-controls', panel.id); position();
    };
    const snapshot = (): DetailState | null => {
        if (!panel || !anchor) return null;
        const attribute = ['data-inventory-item', 'data-read-note'].find(name => anchor!.hasAttribute(name));
        const page = anchor.closest<HTMLElement>('.thought-page');
        return { id: current, trigger: attribute ? `[${attribute}="${CSS.escape(anchor.getAttribute(attribute)!)}"]` : '', fixed,
            page: page ? page.dataset.recordIndex === undefined ? '.is-current-page' : `[data-record-index="${CSS.escape(page.dataset.recordIndex)}"]` : '' };
    };
    const restore = (state: DetailState) => {
        const page = state.page ? root.querySelector<HTMLElement>(state.page) : root;
        const trigger = (state.trigger ? page?.querySelector<HTMLElement>(state.trigger) : null)
            ?? root.querySelector<HTMLElement>(`[data-inventory-item="${CSS.escape(state.id)}"]`);
        if (trigger) open(state.id, trigger, state.fixed);
    };
    root.addEventListener('pointerdown', event => {
        const target = event.target as HTMLElement;
        if (panel && !panel.contains(target) && !anchor?.contains(target) && !target.closest('.thought-inventory,[data-read-note],[data-inventory-item]')) close();
    });
    root.addEventListener('scroll', position, true); window.addEventListener('resize', position);
    return { open, close, position, snapshot, restore };
}
