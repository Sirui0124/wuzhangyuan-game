/** Keep a live IME editor mounted until its final input event has been processed. */
export function createCompositionGuard(root: HTMLElement, render: () => void) {
    let composing = false, pending = false;
    root.addEventListener('compositionstart', event => {
        if ((event.target as HTMLElement).matches('input,textarea')) composing = true;
    });
    root.addEventListener('compositionend', () => {
        composing = false;
        queueMicrotask(() => { if (pending && !composing) { pending = false; render(); } });
    });
    return { defer() { if (!composing) return false; pending = true; return true; } };
}
