import type { PhoneHost } from './host';
import type { GameUIState } from '../game/ui-state';
import { createShoppingController } from '../game/shopping';
/** Mount/unmount only the optional phone UI. Inventory remains owned by the session. */
export function createPhoneModule(root: HTMLElement, host: PhoneHost, ui: GameUIState, render: () => void, persist: () => void) {
    let controller: ReturnType<typeof createShoppingController> | undefined;
    return {
        setEnabled(enabled: boolean) {
            if (enabled && !controller) { controller = createShoppingController(root, host, ui, render, persist); controller.restore(); }
            if (!enabled && controller) { controller.dispose(); controller = undefined; if (ui.overlay === 'supplies') ui.overlay = ''; }
        },
        cancel(redraw = true) { controller?.cancel(redraw); },
        sessionChanged() { controller?.sessionChanged(); },
        reset() { controller?.reset(); },
        restore() { controller?.restore(); },
        invalidate() { controller?.invalidate(); },
        dispose() { controller?.dispose(); controller = undefined; },
    };
}
