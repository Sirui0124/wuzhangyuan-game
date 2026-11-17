/** Pointer dragging is shared presentation behavior; placement remains a chapter operation. */
export function bindThoughtDrag(root: HTMLElement, label: (id: string) => string, placeEvidence: (id: string) => void) {
    let drag: { id: string; x: number; y: number; pointerId: number; ghost: HTMLElement | null } | null = null;
    let dragScrollFrame = 0, dragPointer = { x: 0, y: 0 };
    function scrollWhileDragging() {
        if (!drag?.ghost) return;
        const canvas = root.querySelector<HTMLElement>('.workspace-layout'), point = document.elementFromPoint(dragPointer.x, dragPointer.y);
        if (canvas && point && canvas.contains(point)) {
            const bounds = canvas.getBoundingClientRect();
            const delta = dragPointer.y > bounds.bottom - 70 ? 12 : dragPointer.y < bounds.top + 70 ? -12 : 0;
            canvas.scrollTop += delta;
        }
        const zone = root.querySelector<HTMLElement>('[data-thought-drop],[data-expression-drop]');
        zone?.classList.toggle('is-drag-over', !!point && zone.contains(point));
        dragScrollFrame = requestAnimationFrame(scrollWhileDragging);
    }
    root.addEventListener('pointerdown', event => {
        const target = event.target as HTMLElement, item = target.closest<HTMLElement>('[data-inventory-drag]');
        if (!item || event.button !== 0 || (event.pointerType === 'touch' && !target.closest('[data-drag-handle]'))) return;
        drag = { id: item.dataset.inventoryDrag!, x: event.clientX, y: event.clientY, pointerId: event.pointerId, ghost: null };
    });
    window.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (!drag.ghost && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
        event.preventDefault();
        if (!drag.ghost) {
            drag.ghost = document.createElement('div'); drag.ghost.className = 'thought-drag-ghost'; drag.ghost.textContent = label(drag.id); document.body.append(drag.ghost); document.body.classList.add('dragging-thought');
            dragScrollFrame = requestAnimationFrame(scrollWhileDragging);
        }
        dragPointer = { x: event.clientX, y: event.clientY };
        drag.ghost.style.transform = `translate(${event.clientX + 16}px,${event.clientY - 18}px)`;
        const zone = root.querySelector<HTMLElement>('[data-thought-drop],[data-expression-drop]'), point = document.elementFromPoint(event.clientX, event.clientY);
        zone?.classList.toggle('is-drag-over', !!point && zone.contains(point));
    });
    function clearDrag() { cancelAnimationFrame(dragScrollFrame); drag?.ghost?.remove(); drag = null; document.body.classList.remove('dragging-thought'); root.querySelector('.is-drag-over')?.classList.remove('is-drag-over'); }
    window.addEventListener('pointerup', event => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const active = drag, target = document.elementFromPoint(event.clientX, event.clientY);
        const dropped = !!target?.closest('[data-thought-drop],[data-expression-drop]');
        clearDrag();
        if (!active.ghost) return;
        const suppress = (click: Event) => { if ((click as MouseEvent).detail === 0) return; click.preventDefault(); click.stopPropagation(); }; root.addEventListener('click', suppress, { capture: true, once: true }); setTimeout(() => root.removeEventListener('click', suppress, true), 0);
        if (dropped) placeEvidence(active.id);
    });
    window.addEventListener('pointercancel', clearDrag); window.addEventListener('blur', clearDrag);
}
