/** Browser presentation state, deliberately separate from the persisted chapter session. */
export function createGameUIState() {
    return {
        storageWarning: '', home: true, menuMap: false, overlay: '', restoring: false,
        filmKey: '', previewFilm: '', noteOpen: '', notice: '', notesShown: false, inventoryKind: 'clues' as 'clues' | 'items',
        revealAt: 0, revealTimer: 0, inventoryScroll: 0, renderedWorkspace: '', unfoldThoughts: false,
        reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        typed: true, typeTimer: 0, currentLineId: '', lineText: '', typeIndex: 0,
        renderAfterComposition: false, slotOverwrite: '',
    };
}
export type GameUIState = ReturnType<typeof createGameUIState>;
