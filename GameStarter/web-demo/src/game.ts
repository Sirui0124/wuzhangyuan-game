import { handleCluePopup } from './game/dialogue-clues';
import { hasPackagedChapter } from './release-profile';
import { extraAchievementCatalog, pangtongAchievementCatalog } from './achievements/catalog';
import { recordAchievements, mergeAchievements, recoverLegacyAchievements } from './achievements/storage';
import { chapterOneAchievementIds } from './chapters/chapter-one/achievements';
import { grainHasCompleted, GRAIN_SAVE_KEY, GRAIN_COMPLETED_KEY, type GrainNavigationStory } from './chapters/chapter-two/navigation';
import { recordChapterHistory, startNewChapterProgress } from './chapters/progression';
import { createPauseMenu } from './game/pause-menu';
import { speechHistoryRound } from './chapters/chapter-one/session-state';
import { chapterOne } from './chapters/catalog';
import { tentEnding } from './chapters/chapter-one/tent-visit';
import { createCharacterModule } from './characters/module';
import { chapterOneCharacters } from './chapters/chapter-one/characters';
import { gameModules } from './modules/config';
import { createEvaluationModule } from './modules/evaluation';
import { bindGameInputEvents } from './game/input-events';
import { createGameUIState } from './game/ui-state';
import { createSceneViews } from './chapters/chapter-one/views/scene';
import { createStoryViews } from './chapters/chapter-one/views/story';
import { createNavigationViews } from './chapters/chapter-one/views/navigation';
import { createSettingsController } from './game/settings';
import { needsInitialAiSetup } from './game/ai-guidance';
import { createGameModals } from './game/modals';
import { createGameRenderer } from './game/renderer';
import type { Media } from './game/view-common';
import { offlineExpressionAgents } from './offline-expression-agents';
import { readRuntimeMode, initializeRuntimeMode, setRuntimeConnection, saveRuntimeMode, aiEnabled, type RuntimeMode } from './runtime-mode';
import { expressionAgents } from './expression-agent';
import type { ChapterFlow, ChapterScene } from '../../../content/schema/chapter-session';
import { GameApi } from '../../assets/scripts/GameApi';
import { ChapterSession, type GameSessionState, GAME_SAVE_KEY as MAIN_SAVE_KEY, GAME_ENDINGS_KEY as MAIN_ENDINGS_KEY } from './chapter-session';
import { inferenceRules, type ChapterReview } from './thought-canvas-model';
import { GameAudio } from './audio';
import { CinematicPlayer, type Clip } from './cinematics';
import { freshCollection, parseCollection, unlockEnding, type EndingCatalog } from './endings';
import { createBranchView } from './chapters/chapter-one/branch-view';
import type { Story as BranchStory } from './chapters/chapter-one/branch-engine';
import { backupSave } from './session/save-recovery';
import { openEndingAlbum } from './ending-album';
const thoughtRevealDuration = 1600;


const requestedPlaytest = new URLSearchParams(location.search).get('playtest');
const canvasPlaytest = requestedPlaytest === 'thoughts';
const weiyanPlaytest = requestedPlaytest === 'weiyan-first' || requestedPlaytest === 'weiyan-second' ? requestedPlaytest  : '';
// Named trials start from the same checkpoint without overwriting earlier playtests.
const trial = new URLSearchParams(location.search).get('trial') ?? '';
const playtestKey = canvasPlaytest ? ':canvas-playtest' : weiyanPlaytest ? `:${weiyanPlaytest}` : '';
const GAME_SAVE_KEY = MAIN_SAVE_KEY + playtestKey;
const GAME_ENDINGS_KEY = MAIN_ENDINGS_KEY + playtestKey;
const root = document.querySelector<HTMLDivElement>('#game-root')!;
const read = async <T>(url: string): Promise<T> => { const response = await fetch(url); if (!response.ok) throw new Error(`Missing ${url}`); return response.json(); };
const [script, flow, manifest, media, movies, grainStory, jietingAchievements, pangtongAchievements] = await Promise.all([
    read<ChapterReview>(chapterOne.story.script), read<ChapterFlow>(chapterOne.story.flow), read<{ contentVersion: string }>(chapterOne.story.manifest), read<Media>('/media/manifest.json'), read<Record<string, Clip[]>>('/cinematics.json'), hasPackagedChapter('grain') ? read<GrainNavigationStory>('/story/chapter-two.films.json').catch(() => ({ version: '', nodes: [] })) : { version: '', nodes: [] }, hasPackagedChapter('jieting') ? read<Parameters<typeof extraAchievementCatalog>[0]>('/story/chapter-three.story.json') : { endings: [] }, hasPackagedChapter('luofengpo') ? read<Parameters<typeof pangtongAchievementCatalog>[0]>('/story/chapter-seven.story.json') : { endings: [] },
]);
const api = new GameApi();
const branchStory=await read<BranchStory>('/story/chapter-one.branch.json');
let mode = await initializeRuntimeMode();
const online = expressionAgents(api), offline = offlineExpressionAgents();
const evaluation = createEvaluationModule({ enabled: () => aiEnabled(mode), online: online.judge, offline: offline.judge });
const writing = createEvaluationModule({ enabled: () => aiEnabled(mode), online: online.generate, offline: offline.generate });
const game = new ChapterSession(script, flow, manifest.contentVersion,
    evaluation.evaluate, writing.evaluate, mode, branchStory);
// A changed film list invalidates stale playback offsets without resetting narrative saves.
const audio = new GameAudio(), cinema = new CinematicPlayer(`${manifest.contentVersion}:${JSON.stringify(movies)}`, playtestKey ? `wuzhang-playtest-films${playtestKey}` : 'wuzhang-session-films-v1', true);
const catalog: EndingCatalog = { schemaVersion: 1, chapterId: chapterOne.id, endings: [...[...flow.endings, tentEnding].map(e => ({ ...e, chapter: 'wuzhang', category: 'ending' as const })), ...extraAchievementCatalog(jietingAchievements), ...pangtongAchievementCatalog(pangtongAchievements)].sort((a, b) => ['wuzhang','grain','jieting','luofengpo'].indexOf(a.chapter ?? 'wuzhang') - ['wuzhang','grain','jieting','luofengpo'].indexOf(b.chapter ?? 'wuzhang') || Number(a.category !== 'milestone') - Number(b.category !== 'milestone')) };
let collection = freshCollection(), collectionWarning = '';
catalog.endings = catalog.endings.filter(ending => hasPackagedChapter(ending.chapter ?? 'wuzhang'));
catalog.endings.push(...[
    {id:'branch-coop',title:'记住了你的名字',description:'请伯约出面，军报与回令完成交接，魏延记住了我。'},
    {id:'branch-formal',title:'灯火未灭',description:'魏延与姜维当面议事，各自安排军务。这一夜，前营平安，灯火未灭。'},
    {id:'branch-lamp',title:'主灯已灭',description:'魏延闯入帐中，主灯熄灭。'},
    {id:'branch-dismissed',title:'失了职守',description:'军报递进了帐，却没有等来回令。魏延收走我的长矛，将我赶离守位。'},
].map((e,i)=>({...e,number:`壹-${i+4}`,phase:'第一章',result:['branch-lamp','branch-dismissed'].includes(e.id)?'失败':'生还',hint:'重读第一章，尝试另一种交涉。',kind:['branch-lamp','branch-dismissed'].includes(e.id)?'failure':'success',chapter:'wuzhang',category:'ending' as const})));
const ui = createGameUIState();
if (new URLSearchParams(location.search).get('view') === 'chapters') ui.menuMap = true;
const people = createCharacterModule({ root, portraits: media.characters, enabled: gameModules.characters });
try { collection = parseCollection(localStorage.getItem(GAME_ENDINGS_KEY), catalog); }
catch { collectionWarning = '部分结局记录暂时无法读取，原记录仍保留。'; }
const stored = (key = GAME_SAVE_KEY) => { try { return localStorage.getItem(key); } catch { return null; } };
if (!playtestKey) recoverLegacyAchievements(grainStory);
function archiveCollection() {
    try { return mergeAchievements(collection); }
    catch { collectionWarning = '部分成就记录暂不可读，原记录仍保留。'; return collection; }
}
const slotKey = (slot: string) => `${GAME_SAVE_KEY}:slot:${slot}`;
const label = (id: string) => script.clues.find(c => c.id === id)?.summary ?? inferenceRules.find(rule => rule.id === id)?.summary ?? id;
function presentReadyReply() {
    if (document.hidden || ui.home || ui.overlay || ui.previewFilm || root.querySelector('video,[data-story-film]') || document.querySelector('dialog[open],.ending-album-host')) return;
    const state = game.snapshot();
    if (state.phase === 'spoken' && state.speech?.status === 'ready') game.acknowledgeReply();
}
const sceneViews = createSceneViews(game, flow, media, ui);
const workspaceViews = createStoryViews(game, media, ui, sceneViews.hud);
const navigationViews = createNavigationViews(game, media, movies, stored, () => !!collection.unlocked.safe, () => ({ catalog, collection: archiveCollection(), warning: collectionWarning }), () => grainHasCompleted(grainStory, stored(GRAIN_SAVE_KEY), stored(GRAIN_COMPLETED_KEY)));
const settings = createSettingsController(root, api, audio, ui, () => render(), { get: () => mode, set: setRuntimeMode, connected: value => applyRuntimeMode(setRuntimeConnection(value)) });
const { openSettings, saveApiSettings } = settings;
const modals = createGameModals(game, flow, media, ui, stored, slotKey, settings.settingsHTML, GAME_SAVE_KEY);
const pauseMenu = createPauseMenu(root, ui, { render: () => render(), settings: settings.settingsHTML, saves: modals.saveHTML, restart: newGame, suspend: () => { audio.setMusicPaused(true); }, home: () => { game.cancelSpeech(false); cinema.dispose(); ui.previewFilm = ''; ui.home = true; ui.menuMap = false; settings.close(); render(); } });
const branchView=createBranchView(root,game,media,ui,()=>render(),persist);
const { render, revealDialogue } = createGameRenderer({ root, game, ui, audio, cinema, movies, branch:branchView, paused: () => pauseMenu.render(),
    presented: () => {
        people.sync(chapterOneCharacters(game, !ui.home && !ui.previewFilm && !ui.overlay));
        // After DOM reconciliation, including closing settings and restoring a saved reply.
        queueMicrotask(() => {
            if (ui.restoring) return;
            presentReadyReply();
        });
    },
    views: { ...sceneViews, ...workspaceViews, ...navigationViews, ...modals } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) presentReadyReply(); });
document.addEventListener('close', () => presentReadyReply(), true);
window.addEventListener('pagehide', event => {
    evaluation.cancel(); writing.cancel(); if (!event.persisted) {  people.dispose(); evaluation.dispose(); writing.dispose(); }
});

function setRuntimeMode(next: RuntimeMode) {
    const saved = saveRuntimeMode(next);
    applyRuntimeMode(readRuntimeMode());
    if (!saved) ui.storageWarning = '模式已切换，但暂未保存到浏览器。';
}
function applyRuntimeMode(next: RuntimeMode) {
    if (next === mode) return;
    evaluation.cancel(); writing.cancel();
    ui.inventoryKind = 'clues'; ui.notesShown = false;
    mode = next;
    game.setRuntimeMode(next);
    persist();

}
function narrativeSnapshot() { return game.serialize(); }
function persist() {
    if (ui.restoring || ui.home) return;
    const progress = game.snapshot();
    if (!playtestKey) recordChapterHistory('wuzhang', !!game.branch?.completed || ['ending', 'map'].includes(progress.phase) && ['safe'].includes(progress.end ?? ''));

    if (!playtestKey) recordAchievements(chapterOneAchievementIds(game.snapshot()), `wuzhang:${game.snapshot().story.run}`);
    try { localStorage.setItem(GAME_SAVE_KEY, narrativeSnapshot()); }
    catch { ui.storageWarning = '当前进度暂未写入浏览器，仍可继续本次游戏。'; }
}
function toast(text: string) { ui.notice = text; const target = document.querySelector<HTMLElement>('#game-notice'); if (target) target.textContent = text; }
function unlock(id: string) {
    const ending = catalog.endings.find(e => e.id === id); if (!ending) return;
    collection = unlockEnding(collection, ending, game.snapshot().story.run);
    try { localStorage.setItem(GAME_ENDINGS_KEY, JSON.stringify(collection)); } catch { collectionWarning = '这次结局暂未写入浏览器。'; }
}
let previousGenerationStatus = game.snapshot().composition.status;
game.onChange(event => {
    if (['line', 'section', 'cinematic', 'graph'].includes(event.type)) ui.notice = '';
    if (event.type === 'ending' && event.id) unlock(event.id);
    if (event.type==='ending' && game.branch?.completed) unlock('safe');
    if (event.type === 'graph') audio.play('paper_turn');
    // Speech service status belongs beside the pending speech, never in a floating story reply.
    if (event.type === 'speech') {
        ui.notice = '';
        const state = game.snapshot();

    }
    persist();
    const generationStatus = game.snapshot().composition.status;
    if (previousGenerationStatus === 'waiting' && generationStatus === 'ready' && game.snapshot().composition.provenance === 'ai') {
        ui.revealAt = ui.reduced ? 0 : Date.now(); clearTimeout(ui.revealTimer);
        if (!ui.reduced) ui.revealTimer = window.setTimeout(() => root.querySelector('.expression-paper')?.classList.remove('is-revealing'), thoughtRevealDuration + 20);
    }
    previousGenerationStatus = generationStatus;
    if (!ui.restoring) render();
});
function load(key = GAME_SAVE_KEY) {

    const raw = stored(key); if (!raw) { toast('这里还没有留下进度。'); return; }
    try { if(!JSON.parse(raw).branch) backupSave(localStorage,key,raw); }
    catch { toast('旧进度暂未能备份，请稍后再试。');return; }
    let loaded = false;
    try { ui.restoring = true; game.restore(raw);    ui.inventoryKind = 'clues'; ui.notesShown = false; ui.storageWarning = ''; ui.home = false; ui.overlay = ''; ui.filmKey = ''; ui.noteOpen = ''; ui.revealAt = 0; ui.renderedWorkspace = ''; clearTimeout(ui.revealTimer); loaded = true; }
    catch { ui.storageWarning = '这份存档与当前内容暂不兼容，原记录已保留。'; }
    finally { ui.restoring = false; if (loaded) { pauseMenu.dismiss(); cinema.resetPlayback(); persist(); } render(); }
}
function newGame(resetChapters = false) {
    const raw = stored();
    if (raw) {
        try { localStorage.setItem(`${GAME_SAVE_KEY}:before-new`, raw); }
        catch { ui.storageWarning = '暂时无法备份当前进度，请先存档后重试。'; ui.overlay = 'save'; render(); return; }
    }
    if (resetChapters && !playtestKey) {
        try { startNewChapterProgress(); }
        catch { ui.storageWarning = '暂时无法备份并重置章节进度，请稍后重试。'; ui.overlay = 'save'; render(); return; }
    }
    pauseMenu.dismiss(); cinema.resetPlayback();
    ui.previewFilm = resetChapters ? 'prologue' : '';



    ui.inventoryKind = 'clues';
    ui.home = false; ui.menuMap = false; ui.overlay = ''; ui.notesShown = false; ui.revealAt = 0; clearTimeout(ui.revealTimer); ui.noteOpen = ''; ui.filmKey = ''; ui.notice = ''; ui.storageWarning = ''; game.restart();
}
function next() {
    if (revealDialogue()) return;
    audio.play('dialogue_next');
    if (game.snapshot().phase === 'reply' && game.snapshot().speech?.result === 'execute') game.finishExecution();
    else game.nextLine();
}
function reviseExpression() {
    if (game.snapshot().phase === 'reply' && revealDialogue()) return;
    if (!game.reviseExpression()) return;
    const editor = root.querySelector<HTMLTextAreaElement>('#player-expression');
    editor?.focus({ preventScroll: true }); editor?.scrollIntoView({ block: 'nearest' });
}
root.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button'); if (!target) return;
    if (ui.overlay && !target.closest('.game-modal')) return;
    if (handleCluePopup(root, target)) return;
    const action = target.dataset.narrativeChoice ?? target.dataset.action, state = game.snapshot();
    if (target.dataset.tent) {
        const action = target.dataset.tent;
        if (game.tentAction(action)) {

            persist();
        }
        return;
    }
    // A double click finishing the last line must not also choose the newly shown option.
    if (['continue-story', 'return-to-story'].includes(action ?? '') && event.detail > 1) { event.preventDefault(); return; }
    if (target.dataset.sceneAction) { const result = game.actionState(target.dataset.sceneAction); if (result.enabled) game.act(target.dataset.sceneAction); else toast(result.reason); return; }
    if (target.dataset.move) { game.move(target.dataset.move as ChapterScene); return; }
    if (target.dataset.scoutChoice) { game.chooseScout(target.dataset.scoutChoice as 'a' | 'b');  persist(); return; }
    if (target.dataset.storeSlot) {
        if (ui.home) return; // The menu has no live session to save.
        const slot = target.dataset.storeSlot, key = slotKey(slot);
        if (stored(key) && ui.slotOverwrite !== slot) { ui.slotOverwrite = slot; render(); return; }
        try { localStorage.setItem(key, narrativeSnapshot()); ui.slotOverwrite = ''; toast('这一刻，已经留下。'); } catch { ui.storageWarning = '暂时无法写入存档。'; } render(); return;
    }
    if (target.dataset.loadSlot) { load(slotKey(target.dataset.loadSlot)); return; }
    if (action && !['next', 'speak'].includes(action)) audio.play('ui_click_a');
    if (action === 'new') { ui.overlay = 'new'; render(); }
    if (action === 'new-confirmed') newGame(true);
    if (action === 'replay-first' || action === 'start-first') newGame();
    if (action === 'continue' || action === 'load-auto') load();
    if (action === 'next') next();
    if (action === 'menu') { game.cancelSpeech(false); cinema.dispose(); ui.previewFilm = ''; ui.home = true; ui.menuMap = false; ui.overlay = ''; render(); }
    if (action === 'continue-story') { game.continueStory(); return; }
    if (action === 'return-to-story') { game.returnToStory(); return; }
    if (['insert-clue','remove-clue','clear-expression'].includes(action ?? '') && state.phase === 'expression' && !state.speech) {
        const clue = game.content.clues.find(c => c.id === target.dataset.clue && state.story.collected.includes(c.id));
        if (action === 'clear-expression') { game.cancelGeneration(false); for (const id of state.story.selected) game.selectEvidence(id); game.setFocus(''); game.setDraft(''); }
        else if (clue) { game.cancelGeneration(false); if (action === 'remove-clue') { if (state.story.selected.includes(clue.id)) game.selectEvidence(clue.id); }
            else if (!state.story.selected.includes(clue.id)) { game.selectEvidence(clue.id); } }
        return;
    }
    if (action === 'show-clues') root.querySelector<HTMLElement>('.dialogue-clues')?.focus();
    if (action === 'generate-expression') {  void game.generateExpression(); }
    if (action === 'restore-previous-draft') { ui.revealAt = 0; game.restorePreviousDraft(); root.querySelector<HTMLTextAreaElement>('#player-expression')?.focus(); }
    if (action === 'confirm-focus' && game.snapshot().phase === 'expression') {
        const words = game.snapshot().composition.focus.trim();
        if (words) { ui.revealAt = 0; game.setDraft(words); }
    }
    if (action === 'use-expression-help') {  game.useExpressionHelp(); }
    if (action === 'cancel-generation') { game.cancelGeneration(); }
    if (action === 'speak') { audio.play('submit'); void game.confirmExpression(); }
    if (action === 'reply') game.acknowledgeReply();
    if (action === 'cancel-speech') game.cancelSpeech();
    if (action === 'retry-speech') void game.retrySpeech();
    if (action === 'reveal-reply') game.acknowledgeReply();
    if (action === 'revise') reviseExpression();
    if (action === 'rewind') { game.rewind(); }
    if (action === 'retry-weiyan') { ui.currentLineId = ''; if (game.retryWeiyanRound()) {   persist(); } }
    if (action === 'map' && game.toMap()) { ui.overlay = 'onward'; render(); }
    if (action === 'chapters') { ui.overlay = ''; ui.home = true; ui.menuMap = true; render(); }
    if (action === 'chapter-preview') { ui.previewFilm = 'grain'; ui.home = false; ui.filmKey = ''; render(); }
    if (action === 'chapter-scene-preview' && (movies.chapterScenes ?? []).some(clip => clip.id === target.dataset.previewClip)) { ui.previewFilm = target.dataset.previewClip!; ui.home = false; ui.filmKey = ''; render(); }
    if (action === 'achievements') openEndingAlbum(catalog, archiveCollection(), { warning: collectionWarning });
    if (action === 'achievement' && target.dataset.achievementId && archiveCollection().unlocked[target.dataset.achievementId]) openEndingAlbum(catalog, archiveCollection(), { warning: collectionWarning, initialId: target.dataset.achievementId, unlockedOnly: true });
    if (action === 'album') { ui.overlay = ''; ui.home = true; ui.menuMap = true; render(); }
    if (action === 'save' || action === 'records') { ui.overlay = action; render(); }
    if (action === 'settings' || action === 'configure-ai') openSettings(action === 'configure-ai');
    if (action === 'save-api' || action === 'test-api') void saveApiSettings(action === 'test-api');
    if (action === 'close-modal') { ui.overlay = ''; settings.close(); ui.slotOverwrite = ''; render(); }
});
bindGameInputEvents({ root, game, ui, audio, settings, persist, render, reviseExpression, next });
if (canvasPlaytest || weiyanPlaytest) {
    const fixture = await read<GameSessionState>(canvasPlaytest ? '/art-review/thought-playtest.json' : `/playtest/${weiyanPlaytest}.json`);
    ui.restoring = true;
    game.restore(JSON.stringify(fixture));

    ui.restoring = false;
    ui.home = false;
    if (weiyanPlaytest) persist();
}
render();

if (!requestedPlaytest && !ui.menuMap && needsInitialAiSetup()) openSettings(true, true);
if (new URLSearchParams(location.search).get('setup') === 'ai') openSettings(true);

if (new URLSearchParams(location.search).get('album') === 'luofengpo') openEndingAlbum(catalog, archiveCollection(), {warning: collectionWarning, initialChapter: 'luofengpo'});
