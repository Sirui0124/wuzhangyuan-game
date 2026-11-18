import { handleCluePopup } from './game/dialogue-clues';
import { acceptsChoice } from './narrative/presentation';
import { createCompositionGuard } from './game/composition-guard';
import { chapterOnwardHTML } from './game/chapter-onward';
import { backupSave, protectSave } from './session/save-recovery';
import { recordAchievements } from './achievements/storage';
import { recordChapterHistory } from './chapters/progression';
import { jietingAchievementIds } from './chapters/chapter-three/achievements';
import { polishDialogue } from './dialogue-polish';
import { jietingPolishInput } from './chapters/chapter-three/polish';
import { GameApi } from '../../assets/scripts/GameApi';
import { GameAudio, type AudioBus } from './audio';
import { createPauseMenu } from './game/pause-menu';
import { createSettingsController } from './game/settings';
import { createGameUIState } from './game/ui-state';
import { esc, type Media } from './game/view-common';
import { frameModal, recordsPanelHTML, savePanelHTML } from './game-ui-panels';
import { readRuntimeMode, aiEnabled, saveRuntimeMode, setRuntimeConnection } from './runtime-mode';
import { generateOpeningQuestion } from './chapters/chapter-three/opening-question';
import { JietingSession, createJietingPlaytest } from './chapters/chapter-three/session';
import type { JietingStory } from './chapters/chapter-three/types';
import { judgeJietingDialogue } from './chapters/chapter-three/open-dialogue';
import { jietingView } from './chapters/chapter-three/view';
import { JietingReading, savedReading, withoutReading } from './chapters/chapter-three/reading';
import { createCharacterModule } from './characters/module';
import { chapterThreeCharacters } from './chapters/chapter-three/characters';
import { gameModules } from './modules/config';
import { updateChapterAudio } from './chapter-audio';

const SAVE = 'jieting-chapter-three-v1', COMPLETED = 'jieting-chapter-three-completed-v1';
const root = document.querySelector<HTMLElement>('#game-root')!;
for (const href of ['/chapter-three.css', '/evidence-material.css']) {
    const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = href; document.head.append(style);
}
async function read<T>(url: string): Promise<T> { const r = await fetch(url); if (!r.ok) throw new Error('第三章内容未载入，请刷新重试。'); return r.json(); }
async function start() {
    const [story, media] = await Promise.all([read<JietingStory>('/story/chapter-three.story.json'), read<Media>('/media/manifest.json')]);
    const url = new URL(location.href), playtest = url.searchParams.get('playtest') ?? '';
    const supportedPlaytests = ['reinforcement', 'lure', 'withdrawal'];
    const isolated = supportedPlaytests.includes(playtest), key = isolated ? `${SAVE}:playtest:${playtest}` : SAVE;
    const restarting = url.searchParams.get('restart') === '1' && !isolated;
    const mode = () => ({ aiEnabled: aiEnabled(readRuntimeMode()) });
    let saved: unknown, error = '', retryAction: 'polish' | 'speak' | 'question' | undefined;
    let originalRaw: string | null = null, storageUnreadable = false;
    let protectedSave: ReturnType<typeof protectSave> | undefined;
    const preserveOriginal = () => {
        if (originalRaw === null || isolated) return;
        protectedSave = protectSave(localStorage, key, originalRaw);
        try { protectedSave.backup(); error = '旧进度暂时无法读取，原始记录已备份，本次从章首开始。'; }
        catch { error = '旧进度尚未安全备份，自动存档暂不覆盖；可继续游玩并另存手动档。'; }
    };
    try { originalRaw = localStorage.getItem(key); }
    catch { storageUnreadable = true; error = '旧进度暂时无法读取，自动存档暂不覆盖。'; }
    if (!storageUnreadable && !isolated) {
        try {
            if (restarting) {
                if (originalRaw !== null) { backupSave(localStorage, key, originalRaw); localStorage.setItem(`${key}:before-new`, originalRaw); }
            } else if (originalRaw !== null) {
                saved = JSON.parse(originalRaw);
                if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('存档格式无效');
            }
        } catch { saved = undefined; preserveOriginal(); }
    }
    url.searchParams.delete('restart'); history.replaceState(null, '', url);
    const create = (value?: unknown) => new JietingSession(story, withoutReading(value), mode());
    const reading = new JietingReading();
    let session: JietingSession;
    try { session = isolated ? createJietingPlaytest(story, playtest, mode()) : create(saved); if (!isolated) reading.restore(savedReading(saved)); }
    catch { session = create(); preserveOriginal(); saved = undefined; }
    const composition = createCompositionGuard(root, render);
    const ui = createGameUIState(); ui.home = false;
    const audio = new GameAudio();
    let evidenceDetail = '';
    let request: AbortController | null = null, generation = 0, lastScene = '', lastBelow = session.below;
    const people = createCharacterModule({ root, portraits: media.characters, enabled: gameModules.characters });
    const questionAttempts = new Set<string>();
    let questioning = false;
    const cancel = () => { request?.abort(); request = null; polishing=false; questioning=false; generation++; };
    const snapshot = () => ({ ...session.state, reading: reading.save(session.current) });
    const persist = () => {
        try {
            if (storageUnreadable) throw new Error('原存档尚未读取');
            if (!isolated) recordAchievements(jietingAchievementIds(session), `jieting:${session.state.run}`);
            const raw = JSON.stringify(snapshot());
            if (protectedSave) protectedSave.write(raw); else localStorage.setItem(key, raw);
            if (!isolated) recordChapterHistory('jieting', session.current.kind === 'ending' && !!story.endings.find(e => e.id === session.current.ending)?.success);
            if (!isolated && session.current.kind === 'ending') {
                const ending = story.endings.find(e => e.id === session.current.ending);
                if (ending?.success) localStorage.setItem(COMPLETED, 'true');
                const collectionKey = `${SAVE}:endings`, old = JSON.parse(localStorage.getItem(collectionKey) ?? '{}');
                if (ending) localStorage.setItem(collectionKey, JSON.stringify({ ...old, [ending.id]: old[ending.id] ?? Date.now() }));
            }
        } catch { ui.storageWarning = '当前进度未能保存，仍可继续游玩。'; }
    };
    
    const settings = createSettingsController(root, new GameApi(), audio, ui, render,  {
        get: readRuntimeMode, set: m => { saveRuntimeMode(m); applyMode(); }, connected: c => { setRuntimeConnection(c); applyMode(); },
    });
    const pause = createPauseMenu(root, ui, { render, settings: settings.settingsHTML, home, saves: saveHTML, restart,
        suspend: () => { cancel(); audio.setMusicPaused(true); } });
    function home() { cancel(); persist(); location.href = '/'; }
    function applyMode() {
        cancel(); questionAttempts.clear(); session.setMode(mode());
        persist(); render();
        
    }
    function saveHTML() {
        return savePanelHTML([1, 2, 3].map(i => {
            const slotKey = `${key}:slot:${i}`, raw = localStorage.getItem(slotKey); let summary = '第三章 · 街亭', savedAt: number | undefined;
            try { const v = JSON.parse(raw ?? 'null'); const n = story.nodes.find(n => n.id === v?.node); if (n) summary += ' · ' + n.text.slice(0, 45); savedAt = v?.savedAt; } catch { summary = '这份存档暂不可读'; }
            return { key: slotKey, manualIndex: String(i), exists: !!raw, summary, savedAt, overwrite: ui.slotOverwrite === String(i) };
        })) + `<p role="status">${esc(ui.storageWarning || ui.notice)}</p>`;
    }
    function restart() {
        try { localStorage.setItem(`${key}:before-new`, JSON.stringify(snapshot())); } catch { ui.storageWarning = '当前进度未能备份，请先存档后重试。'; render(); return; }
        cancel();  session = create();   reading.restore(); ui.overlay = ''; error = ''; lastScene = ''; persist(); render();
    }
    function next(option?: string) {
        if (request || ui.overlay || session.current.kind === 'ending') return;
        if (!option && !session.feedback && reading.advance(session.current)) { persist(); render(); audio.play('dialogue_next'); return; }
        const clues = new Set(session.clues.map(c => c.id)), previousNode = session.current;
        if (!session.advance(option)) return;
        
        error = ''; persist(); render(); audio.play('dialogue_next');
    }
    let polishing=false, previousPolish:{node:string;run:number;before:string;after:string}|null=null;
    const canUndoPolish=()=>!!previousPolish&&previousPolish.node===session.current.id&&previousPolish.run===session.state.run&&previousPolish.after===session.state.draft;
    function recordAiError(action: 'polish' | 'speak', message: string) {
        retryAction = action; error = message;
        try {
            localStorage.setItem(`${key}:last-ai-error`, JSON.stringify({ at: new Date().toISOString(), action,
                node: session.current.id, input: session.state.draft, clueIds: [...session.state.selected], message }));
        } catch { /* Diagnostic storage must not affect the draft or gameplay. */ }
    }
    async function polish() {
        if(request||session.current.kind!=='open'||!mode().aiEnabled)return;
        const controller=new AbortController(),current=session,input=jietingPolishInput(session),signature=JSON.stringify(input);
        const before=session.state.draft;
        request=controller;polishing=true;error='';retryAction=undefined;persist();render();
        try {
            const text=await polishDialogue(input,controller.signal);
            if(controller.signal.aborted||request!==controller||session!==current||session.current.id!==input.node||JSON.stringify(jietingPolishInput(session))!==signature)return;
            previousPolish={node:input.node,run:session.state.run,before,after:text};
            session.state.draft=text;error='';persist();
        } catch(e) {if(request===controller&&!controller.signal.aborted)recordAiError('polish',e instanceof Error?e.message:'润色未完成，原稿已保留。');}
        finally {if(request===controller){request=null;polishing=false;render();}}
    }
    async function speak() {
        if (request || session.current.kind !== 'open' || session.feedback || !session.state.draft.trim() || !mode().aiEnabled) return;
        const controller = new AbortController(), seq = ++generation, node = session.current.id, run = session.state.run;
        const context = session.getEvaluationContext(), input = session.state.draft.trim();
        ui.overlay = ''; evidenceDetail = '';
        request = controller; error = ''; retryAction = undefined; polishing = false; persist(); render(); audio.play('submit');
        try {
            const result = await judgeJietingDialogue({ context, input, clueIds: [...session.state.selected], confirmed: true }, controller.signal);
            if (controller.signal.aborted || generation !== seq || run !== session.state.run || session.current.id !== node) return;
            if (!session.submit(result)) throw new Error('军情已有变化，原话已保留，请重新说出。');
            
            error = ''; persist(); audio.play('response_ready');
        } catch (e) { if (!controller.signal.aborted && generation === seq) recordAiError('speak',e instanceof Error ? e.message : '回应未完成，原话已保留，请重试。'); }
        finally { if (request === controller) { request = null; persist(); render(); } }
    }
    async function askOpeningQuestion(force = false) {
        const n = session.current, stamp = `${session.state.run}:${n.id}`;
        if (request || !mode().aiEnabled || n.kind !== 'open' || n.phase !== 'reinforcement' || session.feedback
            || session.state.followupUsed[n.id] || (!force && session.state.draft.trim()) || session.state.guidedQuestions?.[n.id]
            || (!force && questionAttempts.has(stamp))) return;
        questionAttempts.add(stamp);
        const controller = new AbortController(), current = session, context = session.getEvaluationContext(), expectedDraft = session.state.draft, seq = ++generation;
        request = controller; questioning = true; error = ''; retryAction = undefined; render();
        try {
            const result = await generateOpeningQuestion(context, controller.signal);
            if (controller.signal.aborted || seq !== generation || session !== current) return;
            if (!session.confirmOpeningQuestion(result, expectedDraft)) throw new Error('军情已有变化，已保留当前问题。');
            persist();
        } catch (e) {
            if (!controller.signal.aborted && seq === generation) { error = '开场提问暂未生成，当前问题和自由输入仍可使用。'; retryAction = 'question'; }
        } finally { if (request === controller) { request = null; questioning = false; render(); } }
    }
    function render() {
        if (composition.defer()) return;
        if (pause?.render()) return;
        updateChapterAudio(audio,'jieting',session.current,{silent:session.state.ending==='execution'});
        const changedScene = lastScene !== session.current.scene; lastScene = session.current.scene;
        const previousBelow = lastBelow; lastBelow = session.below;
        const page = reading.current(session.current);
        root.dataset.node = session.current.id; root.dataset.chapter = 'jieting'; root.dataset.readingPage = String(page.page);
        const expression = session.current.kind === 'open' && !session.feedback && mode().aiEnabled;
        root.innerHTML = jietingView(session, media, { busy: !!request, error, polishing, questioning, canUndoPolish:canUndoPolish(), retryAction, online: mode().aiEnabled, changedScene, readingText: page.text, detail: evidenceDetail, previousBelow });
        if (ui.overlay === 'records') root.insertAdjacentHTML('beforeend', frameModal('这一程的对白', recordsPanelHTML(session.state.transcript), 'history'));
        if (ui.overlay === 'save') root.insertAdjacentHTML('beforeend', frameModal('存档', saveHTML(), 'saves'));
        if (ui.overlay === 'settings') root.insertAdjacentHTML('beforeend', frameModal('设置', settings.settingsHTML(), 'settings'));
        if (ui.overlay === 'situation') root.insertAdjacentHTML('beforeend', frameModal('眼下的军情', `<section class="jieting-situation"><dl><dt>山上</dt><dd>${session.above.toLocaleString()}人</dd><dt>山下已到营</dt><dd>${session.below.toLocaleString()}人</dd><dt>王平信任</dt><dd>${session.scores.w}</dd><dt>马谡信任</dt><dd>${session.scores.m}</dd><dt>严谨度</dt><dd>${session.scores.r}</dd></dl><p>只计算已经到营的兵。${session.below < 10000 ? '山下尚不足一万人，无力配合诱敌。' : '山下已有一万人以上，可以商议诱敌。'}</p></section>`, 'history'));
        if (ui.overlay === 'onward') root.insertAdjacentHTML('beforeend', chapterOnwardHTML('jieting', session.state.ending ?? ''));
        if (ui.overlay === 'restart') root.insertAdjacentHTML('beforeend', frameModal('重玩第三章', '<p>从开头重新开始，当前进度会备份，手动存档保留。</p><button class="folio-button" data-action="restart-confirm">确认重玩</button>', 'new'));
        people.sync({ ...chapterThreeCharacters(session), visible: !ui.overlay });
        if (expression && !ui.overlay && !request) void askOpeningQuestion();
    }
    root.addEventListener('input', event => {
        const t = event.target as HTMLInputElement;
        if (t.id === 'player-expression') { session.state.draft = t.value; persist(); const button = root.querySelector<HTMLButtonElement>('[data-action=speak]'); if (button) button.disabled = !t.value.trim();const polishButton=root.querySelector<HTMLButtonElement>('[data-action=polish-expression]');if(polishButton)polishButton.disabled=!!request||(!t.value.trim()&&!session.state.selected.length&&true);const undo=root.querySelector<HTMLButtonElement>('[data-action=undo-polish]');if(undo)undo.hidden=!canUndoPolish(); }
        if (t.dataset.volume) { audio.setVolume(t.dataset.volume as AudioBus, Number(t.value)); if (t.nextElementSibling) t.nextElementSibling.textContent = t.value + '%'; }
        if (t.id === 'game-ai-enabled') settings.setRuntime(t.checked);
    });
    root.addEventListener('toggle', e => { if ((e.target as HTMLElement).id === 'api-settings') settings.setDetails((e.target as HTMLDetailsElement).open); }, true);
    root.addEventListener('click', e => {
        const clueButton = (e.target as HTMLElement).closest<HTMLElement>('button');
        if (clueButton && handleCluePopup(root, clueButton)) return;
        const target = e.target as HTMLElement, b = target.closest<HTMLElement>('[data-detail],[data-action],[data-option],[data-select],[data-store-slot],[data-load-slot]');
        if (!b) { if (!ui.overlay && !request && target.closest('.game-scene') && !target.closest('button,a,input,textarea,.game-hud,[role=dialog]') && !window.getSelection()?.toString()) next(); return; }
        if (b instanceof HTMLButtonElement && b.disabled) return;
        if (b.dataset.action && !['next', 'speak'].includes(b.dataset.action)) audio.action(b.dataset.action);
        if (b.dataset.option) { if (acceptsChoice(session.decision, b.closest<HTMLElement>('[data-decision]')?.dataset.decision, b.dataset.option)) next(b.dataset.option); return; }
        if (b.dataset.storeSlot) {
            const id = b.dataset.storeSlot;
            try { if (localStorage.getItem(`${key}:slot:${id}`) && ui.slotOverwrite !== id) { ui.slotOverwrite = id; render(); return; } localStorage.setItem(`${key}:slot:${id}`, JSON.stringify({ ...snapshot(), savedAt: Date.now() })); ui.slotOverwrite = ''; ui.notice = '已存档。'; ui.storageWarning = ''; } catch { ui.storageWarning = '暂时无法写入存档，当前进度保留。'; } render(); return;
        }
        if (b.dataset.loadSlot) {
            try { const raw = localStorage.getItem(`${key}:slot:${b.dataset.loadSlot}`); if (!raw) return; const value = JSON.parse(raw); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); const restored = create(value); cancel(); pause.dismiss();  session = restored;   reading.restore(savedReading(value)); ui.overlay = ''; error = ''; lastScene = ''; persist(); render();  }
            catch { ui.storageWarning = '这份存档暂不可读，当前进度和原存档已保留。'; render(); } return;
        }
        if (['insert-clue','remove-clue','clear-expression'].includes(b.dataset.action ?? '') && session.current.kind === 'open' && (!request || polishing)) {
            const clue = session.clues.find(c => c.id === b.dataset.clue);
            cancel(); previousPolish = null; error = '';
            if (b.dataset.action === 'clear-expression') { session.state.draft = ''; session.state.selected = []; }
            else if (clue) { if (b.dataset.action === 'remove-clue') session.state.selected = session.state.selected.filter(id=>id!==clue.id);
                else if (!session.state.selected.includes(clue.id)) { session.state.selected.push(clue.id); } }
            
            persist(); render(); return;
        }
        if (b.dataset.action === 'show-clues') { root.querySelector<HTMLElement>('.dialogue-clues')?.focus(); return; }
        switch (b.dataset.action) {
            case 'next': next(); break;
            case 'polish-expression': void polish(); break;
            case 'undo-polish': if(!request&&canUndoPolish()){session.state.draft=previousPolish!.before;previousPolish=null;error='';persist();render();} break;
            case 'speak': void speak(); break;
            case 'retry-question': void askOpeningQuestion(true); break;
            case 'cancel-speech': retryAction = questioning ? 'question' : polishing ? 'polish' : 'speak'; cancel(); error = '已停止等待，当前问题与原话已保留。'; render(); break;
            case 'retry': cancel(); questionAttempts.clear(); if (session.retry()) {   reading.restore(); ui.overlay = ''; error = '';  persist(); render();  } break;
            case 'notes-list': ui.overlay = ''; evidenceDetail = ''; render(); break;
            case 'close-evidence-detail': evidenceDetail = ''; render(); break;
            case 'records': case 'save': case 'situation': cancel(); ui.overlay = b.dataset.action; render(); break;
            case 'close-modal': ui.overlay = ''; render(); break;
            case 'settings': case 'configure-ai': settings.openSettings(b.dataset.action === 'configure-ai'); break;
            case 'save-api': case 'test-api': void settings.saveApiSettings(b.dataset.action === 'test-api'); break;
            case 'menu': home(); break;
            case 'map': cancel(); persist(); location.href = '/?view=chapters'; break;
            case 'onward': ui.overlay = 'onward'; render(); break;
            case 'restart': ui.overlay = 'restart'; render(); break;
            case 'restart-confirm': restart(); break;
        }
    });
    document.addEventListener('keydown', e => {
        if (e.isComposing) return;
        if (e.key === 'Escape' && ui.overlay) { cancel(); ui.overlay = ''; render(); }
        else if (e.code === 'Space' && !ui.overlay && !(e.target as HTMLElement).closest('input,textarea,button,a,summary')) { e.preventDefault(); next(); }
    });
    window.addEventListener('pagehide', () => { cancel(); people.dispose();  persist(); });
    persist(); render(); 
}
void start().catch(e => { root.innerHTML = `<main class="game-scene"><section class="dialogue-box"><p>${esc(e instanceof Error ? e.message : '第三章未能载入。')}</p><a href="/">返回开始页</a></section></main>`; });
