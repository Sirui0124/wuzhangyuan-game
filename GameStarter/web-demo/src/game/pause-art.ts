/** Incised pictograms share the cover's angular bronze motifs; labels remain ordinary text. */
export function pauseAction(action: 'pause-save' | 'settings' | 'pause-restart' | 'pause-home', label: string) {
    const glyphs = {
        'pause-save': 'M8 8H23V25H8Q4 25 4 22V9Q4 6 8 6V25M9 25H26V11H23M12 11V21M16 11V21M20 11V21M5 22H8',
        settings: 'M6 6V26M15 6V26M24 6V26M3 10H9V14H3ZM12 18H18V22H12ZM21 9H27V13H21Z',
        'pause-restart': 'M9 10C15 3 26 9 25 18C24 27 11 29 6 21M9 4V11H16M11 16H20M16 12L20 16L16 20',
        'pause-home': 'M3 12L15 5L27 12M5 15H25M7 15V26M23 15V26M11 26V19H19V26M3 27H27M8 9V5M22 9V5',
    };
    return `<button class="pause-secondary" data-action="${action}"><svg class="pause-seal-icon" viewBox="0 0 32 32" aria-hidden="true"><path class="seal-corners" d="M2 8V2H8M24 2H30V8M30 24V30H24M8 30H2V24"/><path d="${glyphs[action]}"/></svg><span>${label}</span></button>`;
}

/** A small incised pennant marks returning to the current scene. */
export function resumeIcon() {
    return '<svg class="pause-seal-icon" viewBox="0 0 32 32" aria-hidden="true"><path class="seal-corners" d="M2 8V2H8M24 2H30V8M30 24V30H24M8 30H2V24"/><path d="M10 27V6M10 7H24L20 12L24 17H10M6 27H15"/></svg>';
}
