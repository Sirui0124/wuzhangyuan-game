/** Scene-wide reading clicks must not consume UI actions, selections or scroll gestures. */
export function bindDialogueScreenInput(root: HTMLElement, advance: () => (() => void) | undefined, surface = '.game-scene') {
    let gesture: { pointer: number; x: number; y: number; scene: Element; eligible: boolean; moved: boolean } | undefined;
    root.addEventListener('pointerdown', event => {
        const scene = (event.target as Element).closest(surface);
        gesture = event.button === 0 && event.isPrimary && scene
            ? { pointer: event.pointerId, x: event.clientX, y: event.clientY, scene, eligible: !!advance(), moved: false }
            : undefined;
    });
    root.addEventListener('pointermove', event => {
        if (gesture?.pointer === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture.moved = true;
    });
    root.addEventListener('pointercancel', () => { gesture = undefined; });
    root.addEventListener('scroll', () => { if (gesture) gesture.moved = true; }, true);
    root.addEventListener('click', event => {
        const target = event.target as Element, scene = target.closest(surface);
        const current = gesture; gesture = undefined;
        if (!scene || !root.contains(scene) || event.defaultPrevented || event.button !== 0) return;
        if (target.closest('button,a,input,textarea,select,summary,[contenteditable],[role=button],[data-edge],.game-hud,.game-modal')) return;
        if (event.detail > 0 && (!current || current.scene !== scene || !current.eligible || current.moved)) return;
        const selection = window.getSelection();
        if (selection?.toString().trim() && (scene.contains(selection.anchorNode) || scene.contains(selection.focusNode))) return;
        advance()?.();
    });
}
