// Chapter selection keeps the same application shell, fonts and shared UI components.
import { initializeRuntimeMode } from './runtime-mode';
import { observeChoiceLayout } from './game/choice-layout';
import { observeMobileViewport } from './game/mobile-viewport';
import { initializeChapterAccess, chapterAccess, requestedChapter } from './chapters/progression';
const stopChoiceLayout = observeChoiceLayout(document.querySelector<HTMLElement>('#game-root')!);
const stopMobileViewport = observeMobileViewport();
window.addEventListener('pagehide', event => { if (!event.persisted) { stopChoiceLayout(); stopMobileViewport(); } });
const query = new URLSearchParams(location.search);
const reportsPlaytest = query.get('chapter') === 'jingzhou' && query.get('playtest') === 'reports';
const finalePlaytest = query.get('chapter') === 'luofengpo' && query.get('playtest') === 'pangtong';
if (!reportsPlaytest && !finalePlaytest) await initializeChapterAccess();
let chapter = requestedChapter(query.get('chapter'));
if (!reportsPlaytest && !finalePlaytest && !chapterAccess(localStorage)[chapter].unlocked) {
    history.replaceState(null, '', `/?view=chapters&locked=${chapter}`);
    chapter = 'wuzhang';
}
if (chapter === 'jieting') { await initializeRuntimeMode(); await import('./chapter-three'); }
else if (chapter === 'grain') { await initializeRuntimeMode(); await import('./chapter-two'); }
else if (chapter === 'yiling') {
    await import('./chapter-four-rescue');
}
else if (chapter === 'jingzhou') { await initializeRuntimeMode(); await import('./chapter-five'); }
else if (chapter === 'luofengpo') {
    const { collectCampaign } = await import('./campaign/collect');
    const { setCampaignReader } = await import('./campaign/results');
    setCampaignReader(() => collectCampaign());
    await import('./chapter-seven');
}
else await import('./game');
export {};
