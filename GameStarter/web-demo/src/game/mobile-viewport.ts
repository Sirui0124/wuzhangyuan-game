/** Keep controls inside the visible browser area when a phone keyboard opens.
 * This changes layout only; it never advances a scene or requests fullscreen.
 */
export function observeMobileViewport(): () => void {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    let editingField = '';
    const update = () => {
        frame = 0;
        // Pinch zoom belongs to the browser; do not relayout the game beneath it.
        if (viewport && Math.abs(viewport.scale - 1) > .05) return;
        const height = Math.round(viewport?.height ?? window.innerHeight);
        const width = Math.round(viewport?.width ?? window.innerWidth);
        root.style.setProperty('--game-viewport-height', `${height}px`);
        root.style.setProperty('--game-viewport-top', `${Math.round(viewport?.offsetTop ?? 0)}px`);
        root.toggleAttribute('data-compact-viewport', width >= 600 && height <= 500 && width > height);
        const editing = document.activeElement?.matches('textarea, input:not([type=range]):not([type=checkbox])');
        if (editing) editingField = document.activeElement?.id ?? '';
        else if (height >= 300) editingField = '';
        // Keep the compact form stable between pointerdown and click on Send.
        // Blurring the field alone must not move the button under the finger.
        root.toggleAttribute('data-keyboard-editing', !!editingField && height < 300);
        root.dataset.editingField = editingField;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    update();
    return () => {
        cancelAnimationFrame(frame);
        viewport?.removeEventListener('resize', schedule);
        viewport?.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        document.removeEventListener('focusin', schedule);
        document.removeEventListener('focusout', schedule);
    };
}
