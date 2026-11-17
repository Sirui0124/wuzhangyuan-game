import { extraAchievementCatalog, pangtongAchievementCatalog } from './achievements/catalog';
import { recordAchievements, mergeAchievements, recoverLegacyAchievements } from './achievements/storage';
import { chapterOneAchievementIds } from './chapters/chapter-one/achievements';
import { grainHasCompleted, GRAIN_SAVE_KEY, GRAIN_COMPLETED_KEY, type GrainNavigationStory } from './chapters/chapter-two/navigation';
import { recordChapterHistory, startNewChapterProgress } from './chapters/progression';
import { createPauseMenu } from './game/pause-menu';
import { createPersonalityTracker } from './personality/module';
import { speechHistoryRound } from './chapters/chapter-one/session-state';
import { worldItem } from './inventory/world-items';
import { chapterOne } from './chapters/catalog';
import { tentEnding } from './chapters/chapter-one/tent-visit';
import { supplyById } from './chapters/chapter-one/supplies';
import { supplyEndings } from './chapters/chapter-one/supply-endings';
import { eraEnding } from './game/era-ending';
import { createCharacterModule } from './characters/module';
import { chapterOneCharacters } from './chapters/chapter-one/characters';
import { gameModules } from './modules/config';
import { createEvaluationModule } from './modules/evaluation';
import { createDialogueVoice } from './game/dialogue-voice';
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
import { readRuntimeMode, initializeRuntimeMode, setRuntimeConnection, saveRuntimeMode, aiEnabled, phoneEnabled, itemSystemEnabled, type RuntimeMode } from './runtime-mode';
import { expressionAgents } from './expression-agent';
import type { ChapterFlow, ChapterScene } from '../../../content/schema/chapter-session';
import { GameApi } from '../../assets/scripts/GameApi';
import { ChapterSession, type GameSessionState, GAME_SAVE_KEY as MAIN_SAVE_KEY, GAME_ENDINGS_KEY as MAIN_ENDINGS_KEY } from './chapter-session';
import { inferenceRules, type ChapterReview } from './thought-canvas-model';
import { GameAudio } from './audio';
import { CinematicPlayer, type Clip } from './cinematics';
import { freshCollection, parseCollection, unlockEnding, type EndingCatalog } from './endings';
import { openEndingAlbum } from './ending-album';
import { clearItemReceipts, showItemReceipt } from './item-receipt';
const thoughtRevealDuration = 1600;


const requestedPlaytest = new URLSearchParams(location.search).get('playtest');
const canvasPlaytest = requestedPlaytest === 'thoughts';
const suppliesPlaytest = requestedPlaytest === 'supplies';
const itemPlaytest = requestedPlaytest === 'item-headscarf' || requestedPlaytest === 'item-cup' ? requestedPlaytest : '';
const weiyanPlaytest = requestedPlaytest === 'weiyan-first' || requestedPlaytest === 'weiyan-second' ? requestedPlaytest : suppliesPlaytest ? 'weiyan-second' : '';
// Named trials start from the same checkpoint without overwriting earlier playtests.
const trial = new URLSearchParams(location.search).get('trial') ?? '';
const trialSuffix = suppliesPlaytest && /^[a-z0-9-]{1,48}$/.test(trial) ? `:${trial}` : '';
const playtestKey = itemPlaytest ? `:${itemPlaytest}` : suppliesPlaytest ? `:supplies-playtest${trialSuffix}` : canvasPlaytest ? ':canvas-playtest' : weiyanPlaytest ? `:${weiyanPlaytest}` : '';
const GAME_SAVE_KEY = MAIN_SAVE_KEY + playtestKey;
const GAME_ENDINGS_KEY = MAIN_ENDINGS_KEY + playtestKey;
const root = document.querySelector<HTMLDivElement>('#game-root')!;
const read = async <T>(url: string): Promise<T> => { const response = await fetch(url); if (!response.ok) throw new Error(`Missing ${url}`); return response.json(); };
const [script, flow, manifest, media, movies, grainStory, jietingAchievements, pangtongAchievements] = await Promise.all([
    read<ChapterReview>(chapterOne.story.script), read<ChapterFlow>(chapterOne.story.flow), read<{ contentVersion: string }>(chapterOne.story.manifest), read<Media>('/media/manifest.json'), read<Record<string, Clip[]>>('/cinematics.json'), read<GrainNavigationStory>('/story/chapter-two.films.json').catch(() => ({ version: '', nodes: [] })), read<Parameters<typeof extraAchievementCatalog>[0]>('/story/chapter-three.story.json'), read<Parameters<typeof pangtongAchievementCatalog>[0]>('/story/chapter-seven.story.json'),
]);
const api = new GameApi();
let mode = await initializeRuntimeMode();
const online = expressionAgents(api), offline = offlineExpressionAgents();
const evaluation = createEvaluationModule({ enabled: () => aiEnabled(mode), online: online.judge, offline: offline.judge });
const writing = createEvaluationModule({ enabled: () => aiEnabled(mode), online: online.generate, offline: offline.generate });
const game = new ChapterSession(script, flow, manifest.contentVersion,
    evaluation.evaluate, writing.evaluate, mode);
// A changed film list invalidates stale playback offsets without resetting narrative saves.
const audio = new GameAudio(), cinema = new CinematicPlayer(`${manifest.contentVersion}:${JSON.stringify(movies)}`, playtestKey ? `wuzhang-playtest-films${playtestKey}` : 'wuzhang-session-films-v1', true);
const catalog: EndingCatalog = { schemaVersion: 1, chapterId: chapterOne.id, endings: [...[...flow.endings, ...supplyEndings, tentEnding, eraEnding].map(e => ({ ...e, chapter: 'wuzhang', category: 'ending' as const })), ...extraAchievementCatalog(jietingAchievements), ...pangtongAchievementCatalog(pangtongAchievements)].sort((a, b) => ['wuzhang','grain','jieting','luofengpo'].indexOf(a.chapter ?? 'wuzhang') - ['wuzhang','grain','jieting','luofengpo'].indexOf(b.chapter ?? 'wuzhang') || Number(a.category !== 'milestone') - Number(b.category !== 'milestone')) };
let collection = freshCollection(), collectionWarning = '';
const ui = createGameUIState();
const personality = await createPersonalityTracker('wuzhang', { enabled: () => aiEnabled(mode), onSettled: () => persist() });
let personalityOriginal = '';
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
const dialogueVoice = createDialogueVoice(game, text => toast(text), () => !ui.home && !ui.overlay && !ui.previewFilm && !root.querySelector('video,[data-story-film]') && !document.querySelector('dialog[open],.ending-album-host'));
const sceneViews = createSceneViews(game, flow, media, ui, dialogueVoice.isEnabled);
const workspaceViews = createStoryViews(game, media, ui, sceneViews.hud);
const navigationViews = createNavigationViews(game, media, movies, stored, () => !!collection.unlocked.safe || supplyEndings.some(ending => !!collection.unlocked[ending.id]), () => ({ catalog, collection: archiveCollection(), warning: collectionWarning }), () => grainHasCompleted(grainStory, stored(GRAIN_SAVE_KEY), stored(GRAIN_COMPLETED_KEY)));
const settings = createSettingsController(root, api, audio, ui, () => render(), dialogueVoice, { get: () => mode, set: setRuntimeMode, connected: value => applyRuntimeMode(setRuntimeConnection(value)) });
const { openSettings, saveApiSettings } = settings;
const modals = createGameModals(game, flow, media, ui, stored, slotKey, settings.settingsHTML, GAME_SAVE_KEY);
const pauseMenu = createPauseMenu(root, ui, { personality, render: () => render(), settings: settings.settingsHTML, saves: modals.saveHTML, restart: newGame, suspend: () => { audio.setMusicPaused(true); dialogueVoice.stop(); }, home: () => { dialogueVoice.stop(); game.cancelSpeech(false); cinema.dispose(); ui.previewFilm = ''; ui.home = true; ui.menuMap = false; settings.close(); render(); } });
const { render, revealDialogue } = createGameRenderer({ root, game, ui, audio, cinema, movies, paused: () => pauseMenu.render(),
    presented: () => {
        people.sync(chapterOneCharacters(game, !ui.home && !ui.previewFilm && !ui.overlay));
        // After DOM reconciliation, including closing settings and restoring a saved reply.
        queueMicrotask(() => {
            if (ui.restoring) return;
            if (ui.home || root.querySelector('video,[data-story-film]')) dialogueVoice.stop();
            else dialogueVoice.sync();
        });
    },
    views: { ...sceneViews, ...workspaceViews, ...navigationViews, ...modals } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) dialogueVoice.sync(); });
document.addEventListener('close', () => dialogueVoice.sync(), true);
window.addEventListener('storage', event => { if (event.key === 'wuzhang-ai-voice-enabled' || event.key === null) dialogueVoice.sync(); });
window.addEventListener('pagehide', event => {
    evaluation.cancel(); writing.cancel(); if (!event.persisted) { personality.dispose(); people.dispose(); evaluation.dispose(); writing.dispose(); }
});

function setRuntimeMode(next: RuntimeMode) {
    const saved = saveRuntimeMode(next);
    applyRuntimeMode(readRuntimeMode());
    if (!saved) ui.storageWarning = '模式已切换，但暂未保存到浏览器。';
}
function applyRuntimeMode(next: RuntimeMode) {
    if (next === mode) return;
    evaluation.cancel(); writing.cancel(); dialogueVoice.stop();
    ui.inventoryKind = 'clues'; ui.notesShown = false;
    mode = next;
    game.setRuntimeMode(next);
    persist();
    personality.resume();
}
function narrativeSnapshot() { return JSON.stringify({ ...JSON.parse(game.serialize()), personality: personality.snapshot() }); }
function persist() {
    if (ui.restoring || ui.home) return;
    const progress = game.snapshot();
    if (!playtestKey) recordChapterHistory('wuzhang', ['ending', 'map'].includes(progress.phase) && ['safe', ...supplyEndings.map(ending => ending.id)].includes(progress.end ?? ''));
    if (game.snapshot().round === 2) personality.finishTutorial();
    if (!playtestKey) recordAchievements(chapterOneAchievementIds(game.snapshot()), `wuzhang:${game.snapshot().story.run}`);
    try { localStorage.setItem(GAME_SAVE_KEY, narrativeSnapshot()); }
    catch { ui.storageWarning = '当前进度暂未写入浏览器，仍可继续本次游戏。'; }
}
function toast(text: string) { ui.notice = text; const target = document.querySelector<HTMLElement>('#game-notice'); if (target) target.textContent = text; }
function unlock(id: string) {
    const ending = catalog.endings.find(e => e.id === id); if (!ending) return;
    if (!ui.restoring && !ui.home) {
        if (['tutorial-sacrifice', 'weiyan-execution', 'tent-execution'].includes(id)) personality.death(id, ending.title, ending.description);
        personality.complete(id);
    }
    collection = unlockEnding(collection, ending, game.snapshot().story.run);
    try { localStorage.setItem(GAME_ENDINGS_KEY, JSON.stringify(collection)); } catch { collectionWarning = '这次结局暂未写入浏览器。'; }
}
let previousGenerationStatus = game.snapshot().composition.status;
game.onChange(event => {
    const itemOrigin = event.type === 'item' ? root.querySelector('[data-action="pick-up-cup"],.dialogue-box')?.getBoundingClientRect() : undefined;
    if (['line', 'section', 'cinematic', 'graph'].includes(event.type)) ui.notice = '';
    if (event.type === 'item' && event.id) ui.notice = '';
    if (event.type === 'ending' && event.id) unlock(event.id);
    if (event.type === 'graph') audio.play('paper_turn');
    // Speech service status belongs beside the pending speech, never in a floating story reply.
    if (event.type === 'speech') {
        ui.notice = '';
        const state = game.snapshot();
        if (!ui.restoring && !ui.home && state.round === 2 && state.phase === 'spoken' && state.speech?.status === 'ready') {
            const prior = state.story.history.filter(h => speechHistoryRound(h, state.round) === 2).map(h => h.text);
            const original = personalityOriginal || (state.composition.provenance === 'manual' ? state.speech.text : '');
            personality.open('P2-01', [...prior, state.speech.text].join('\n'), { round: 2,
                origin: prior.length || personalityOriginal ? { type: 'mixed', originalText: original }
                    : state.composition.provenance === 'manual' ? 'self-authored' : 'assistant-generated',
                context: { conversationOrder: '按原话先后排列；后句明确撤回以前句时，以后句为准。' } });
        }
    }
    persist();
    const generationStatus = game.snapshot().composition.status;
    if (previousGenerationStatus === 'waiting' && generationStatus === 'ready' && game.snapshot().composition.provenance === 'ai') {
        ui.revealAt = ui.reduced ? 0 : Date.now(); clearTimeout(ui.revealTimer);
        if (!ui.reduced) ui.revealTimer = window.setTimeout(() => root.querySelector('.expression-paper')?.classList.remove('is-revealing'), thoughtRevealDuration + 20);
    }
    previousGenerationStatus = generationStatus;
    if (!ui.restoring) render();
    if (event.type === 'item' && event.id && !ui.restoring && !ui.home) {
        const item = worldItem(event.id);
        if (item) { audio.play('evidence_gain'); showItemReceipt(root, item.name, ui.reduced, itemOrigin); }
    }
});
function load(key = GAME_SAVE_KEY) {
    dialogueVoice.stop();
    const raw = stored(key); if (!raw) { toast('这里还没有留下进度。'); return; }
    let loaded = false;
    try { ui.restoring = true; const { personality: _record, ...story } = JSON.parse(raw); game.restore(JSON.stringify(story)); personality.attach(JSON.parse(raw), { tutorial: game.snapshot().round === 1 }); personalityOriginal = ''; clearItemReceipts(); ui.inventoryKind = 'clues'; ui.notesShown = false; ui.storageWarning = ''; ui.home = false; ui.overlay = ''; ui.filmKey = ''; ui.noteOpen = ''; ui.revealAt = 0; ui.renderedWorkspace = ''; clearTimeout(ui.revealTimer); loaded = true; }
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
    dialogueVoice.stop();
    clearItemReceipts();
    personality.restart({ tutorial: true }); personalityOriginal = '';
    ui.inventoryKind = 'clues';
    ui.home = false; ui.menuMap = false; ui.overlay = ''; ui.notesShown = false; ui.revealAt = 0; clearTimeout(ui.revealTimer); ui.noteOpen = ''; ui.filmKey = ''; ui.notice = ''; ui.storageWarning = ''; game.restart();
}
function next() {
    if (revealDialogue()) return;
    audio.play('dialogue_next');
    if (game.snapshot().phase === 'reply' && game.snapshot().speech?.itemDecision?.eraFailure) game.finishEraArrest();
    else if (game.snapshot().phase === 'reply' && game.snapshot().speech?.result === 'execute') game.finishExecution();
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
    const action = target.dataset.narrativeChoice ?? target.dataset.action, state = game.snapshot();
    if (target.dataset.tent) {
        const action = target.dataset.tent;
        if (game.tentAction(action)) {
            if (action === 'retry') personality.retry('CH1.tent-risk');
            else personality.choice(`tent:${state.tent}:${action}`, undefined, state.round);
            persist();
        }
        return;
    }
    // A double click finishing the last line must not also choose the newly shown option.
    if (['continue-story', 'return-to-story'].includes(action ?? '') && event.detail > 1) { event.preventDefault(); return; }
    if (target.dataset.sceneAction) { const result = game.actionState(target.dataset.sceneAction); if (result.enabled) game.act(target.dataset.sceneAction); else toast(result.reason); return; }
    if (target.dataset.move) { game.move(target.dataset.move as ChapterScene); return; }
    if (action === 'pick-up-cup') { game.pickUpCup(); return; }
    if (action === 'bag' && itemSystemEnabled()) { ui.overlay = 'items'; render(); return; }
    if (target.dataset.scoutChoice) { game.chooseScout(target.dataset.scoutChoice as 'a' | 'b'); personality.choice(target.dataset.scoutChoice === 'a' ? 'A-23' : 'A-23B', undefined, state.round); persist(); return; }
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
    if (action === 'replay-first') newGame();
    if (action === 'continue' || action === 'load-auto') load();
    if (action === 'next') next();
    if (action === 'menu') { dialogueVoice.stop(); game.cancelSpeech(false); cinema.dispose(); ui.previewFilm = ''; ui.home = true; ui.menuMap = false; ui.overlay = ''; render(); }
    if (action === 'continue-story') { game.continueStory(); return; }
    if (action === 'return-to-story') { game.returnToStory(); return; }
    if (action === 'generate-expression') { personalityOriginal = game.snapshot().story.draft.trim() || game.snapshot().composition.focus.trim(); void game.generateExpression(); }
    if (action === 'restore-previous-draft') { ui.revealAt = 0; game.restorePreviousDraft(); root.querySelector<HTMLTextAreaElement>('#player-expression')?.focus(); }
    if (action === 'confirm-focus' && game.snapshot().phase === 'expression') {
        const words = game.snapshot().composition.focus.trim();
        if (words) { ui.revealAt = 0; game.setDraft(words); }
    }
    if (action === 'use-expression-help') { personalityOriginal = ''; game.useExpressionHelp(); }
    if (action === 'cancel-generation') { game.cancelGeneration(); }
    if (action === 'speak') { audio.play('submit'); void game.confirmExpression(); }
    if (action === 'reply') game.acknowledgeReply();
    if (action === 'cancel-speech') game.cancelSpeech();
    if (action === 'retry-speech') void game.retrySpeech();
    if (action === 'reveal-reply') game.acknowledgeReply();
    if (action === 'revise') reviseExpression();
    if (action === 'rewind') { game.rewind(); }
    if (action === 'retry-weiyan') { ui.currentLineId = ''; if (game.retryWeiyanRound()) { personality.retry('P2-01'); personalityOriginal = ''; persist(); } }
    if (action === 'retry-era') { ui.currentLineId = ''; if (game.retryEraArrest()) { personality.retry('P2-01'); personalityOriginal = ''; persist(); } }
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
if (suppliesPlaytest && stored()) {
    load();
    if (!ui.home && game.canPrepareSupplies()) ui.overlay = 'supplies';
} else if (canvasPlaytest || weiyanPlaytest || itemPlaytest) {
    const fixture = await read<GameSessionState>(canvasPlaytest ? '/art-review/thought-playtest.json' : `/playtest/${itemPlaytest || weiyanPlaytest}.json`);
    if (itemPlaytest) fixture.story.run = crypto.randomUUID();
    ui.restoring = true;
    game.restore(JSON.stringify(fixture));
    personality.attach(fixture, { tutorial: fixture.round === 1 });
    ui.restoring = false;
    ui.home = false;
    if (suppliesPlaytest && game.canPrepareSupplies()) ui.overlay = 'supplies';
    if (weiyanPlaytest) persist();
}
render();

if (!requestedPlaytest && !ui.menuMap && needsInitialAiSetup()) openSettings(true, true);
if (new URLSearchParams(location.search).get('setup') === 'ai') openSettings(true);

if (new URLSearchParams(location.search).get('album') === 'luofengpo') openEndingAlbum(catalog, archiveCollection(), {warning: collectionWarning, initialChapter: 'luofengpo'});
