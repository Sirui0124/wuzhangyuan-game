/** Browser presentation state, deliberately separate from the persisted chapter session. */
import type { SupplyItem } from '../phone/supplies';
import type { PhoneMessage } from '../phone/phone-state';
export type { PhoneMessage } from '../phone/phone-state';
export function createGameUIState() {
    return {
        storageWarning: '', home: true, menuMap: false, overlay: '', restoring: false,
        filmKey: '', previewFilm: '', noteOpen: '', notice: '', notesShown: false, inventoryKind: 'clues' as 'clues' | 'items',
        revealAt: 0, revealTimer: 0, inventoryScroll: 0, renderedWorkspace: '', unfoldThoughts: false,
        reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        typed: true, typeTimer: 0, currentLineId: '', lineText: '', typeIndex: 0,
        renderAfterComposition: false, slotOverwrite: '',
        shopping: { saleConfirm: '', intent: 'ask' as 'ask' | 'buy', query: '', status: 'idle' as 'idle' | 'waiting' | 'ready' | 'failed', message: '', offers: [] as SupplyItem[], messages: [] as PhoneMessage[] },
    };
}
export type GameUIState = ReturnType<typeof createGameUIState>;
