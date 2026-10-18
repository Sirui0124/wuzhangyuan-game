import { ENDINGS_KEY, freshCollection, parseCollection, endingFor, unlockEnding, type EndingCatalog } from './endings';
import { openEndingAlbum } from './ending-album';
import { CinematicPlayer, type Cinematics } from './cinematics';
import { playEvidenceDiscovery } from './evidence-discovery';
import { GameAudio, volumeLabel, type AudioBus } from './audio';
import { CAMPAIGN_KEY, freshCampaign, parseCampaign, markPlayed, completeSafe, advancePresentation, levels, levelStatus, type Campaign, type Stage } from './campaign';
import { NarrativeEngine } from '../../assets/scripts/narrative/engine';
import { evaluate } from '../../assets/scripts/narrative/conditions';
import type { Condition } from '../../../content/schema/narrative';
import { ApiJudge } from '../../assets/scripts/narrative/judge';
import { GameApi, type GameApiSettings } from '../../assets/scripts/GameApi';
import { polishReply, replyGoals, replyTones } from './reply-composer';
import type { Chapter, DialogueNode } from '../../../content/schema/narrative';

type Visuals = { cinematics?: Record<string, string>; ui?: Record<string, string>; characters: Record<string, string>; scenes: Record<string, string>; fallbackCharacters: Record<string, string>; missing: string[] };
type EndingVideo = { id: string; src: string | null; poster: string | null; title: string; rewindText: string };
const [chapter, manifest, visuals, endingVideo, cinematics, endingCatalog] = await Promise.all([
    fetch('/story/chapter.json').then(r => r.json()) as Promise<Chapter>,
    fetch('/story/manifest.json').then(r => r.json()) as Promise<{ contentVersion: string }>,
    fetch('/media/manifest.json').then(r => r.json()) as Promise<Visuals>,
    fetch('/ending-video.json').then(r => { if (!r.ok) throw new Error('Missing ending config'); return r.json(); }).catch(() => ({ id: 'wuzhang-safe-en04-v01', src: null, poster: null, title: '姜维感叹与主角回溯回应', rewindText: '下一次时光倒流：北伐粮运危机' })) as Promise<EndingVideo>,
    fetch('/cinematics.json').then(r => { if (!r.ok) throw new Error('Missing cinematic config'); return r.json(); }).catch(() => ({ opening: [], execution: [], safe: [] })) as Promise<Cinematics>,
    fetch('/story/endings.json').then(r => { if (!r.ok) throw new Error('Missing ending catalog'); return r.json(); }) as Promise<EndingCatalog>,
]);
const apiBase = (window as Window & { WUZHANG_API_BASE?: string }).WUZHANG_API_BASE;
const gameApi = () => new GameApi(apiBase);
const gameJudge = () => new ApiJudge(gameApi());
const whiteMode = new URLSearchParams(location.search).get('white') === '1';
let engine = new NarrativeEngine(chapter, manifest.contentVersion, gameJudge());
const root = document.querySelector<HTMLDivElement>('#app')!;
const audio = new GameAudio();
const KEY = 'wuzhang-white-demo-v1';
const RETRY_KEY = KEY + ':retry';
const HOME_KEY = KEY + ':home';
const OPENING_KEY = KEY + ':opening';
const MANUAL_SLOTS = [1, 2] as const;
const slotKey = (slot: number) => `${KEY}:slot:${slot}`;
let overwriteSlot: number | null = null;
type OpeningRequest = { version: string; loopId: string; key: string };
let openingRequest: OpeningRequest | null = null;
try {
    const saved = JSON.parse(localStorage.getItem(OPENING_KEY) ?? 'null');
    if (saved?.version === manifest.contentVersion && typeof saved.loopId === 'string' && saved.key === `opening:${saved.loopId}`) openingRequest = saved;
} catch { /* A damaged movie marker must not prevent loading the story. */ }
let homeView = localStorage.getItem(HOME_KEY) === '1';
let mainMenuView = new URLSearchParams(location.search).get('play') !== '1';
let endingCollection = freshCollection(), endingWarning = '', endingStorageBlocked = false;
try { endingCollection = parseCollection(localStorage.getItem(ENDINGS_KEY), endingCatalog); }
catch { endingWarning = '结局记录暂时无法读取，原记录已保留。'; endingStorageBlocked = true; }
const cinematicPlayer = new CinematicPlayer(manifest.contentVersion);
let cinematicView = false;
let campaign: Campaign = freshCampaign(), campaignView: Stage | null = null;
let campaignWarning = '', campaignStorageBlocked = false, videoStatus = '', mapNotice = '';
let rewindTimer = 0, rewindStamp = '';
restoreCampaign();
type Reading = { loopId: string; speaker: string; text: string };
type TopicReading = { loopId: string; nodeId: string; signature: string; lines: Reading[] };
type UI = { scenes: string[]; people: string[]; readings: Reading[]; topicReadings: Record<string, TopicReading>; drafts: Record<string, string>; largeText: boolean };
let ui: UI = { scenes: ['camp_gate'], people: [], readings: [], topicReadings: {}, drafts: {}, largeText: false };
let actor: string | null = null, selected: string[] = [], panel = '', tab = 'current', previewEvidence = '';
let evidenceMode: 'browse' | 'present' = 'browse', evidenceReply = false, hintsOpen = false;
let replay: { lines: Reading[]; index: number } | null = null;
let reading: { node: DialogueNode; signature: string; lines: Reading[] } | null = null;
let responseLocked = false, technicalError = '', intent = '';
const replyApi = gameApi();
let apiSettings: GameApiSettings = { apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' };
let apiSettingsBusy = false, apiSettingsLoaded = false, apiSettingsStatus = '', apiSettingsError = false;
async function openApiSettings() {
    panel = 'settings'; apiSettingsBusy = true; apiSettingsStatus = '正在读取 API 配置…'; apiSettingsError = false; render();
    try { apiSettings = await replyApi.settings(); apiSettingsLoaded = true; apiSettingsStatus = ''; }
    catch { apiSettingsStatus = '无法读取 API 配置，请确认本机 AI 服务已启动，再重新打开设置。'; apiSettingsError = true; }
    finally { apiSettingsBusy = false; render(); }
}
async function saveApiSettings() {
    if (engine.interactions().pending || polishController) { apiSettingsStatus = '请等待本次回应完成后再保存。'; apiSettingsError = true; render(); return; }
    apiSettingsBusy = true; apiSettingsStatus = '正在保存…'; apiSettingsError = false; render();
    try { apiSettings = await replyApi.settings(apiSettings); apiSettingsStatus = '已保存，后续交涉与润色立即使用新配置。'; }
    catch (error) { apiSettingsStatus = error instanceof Error ? error.message : '保存失败，请重试。'; apiSettingsError = true; }
    finally { apiSettingsBusy = false; render(); }
}
let composeKey = '', composeOpen = false, cluesOpen = false, polishOpen = false, proofOpen = '';
let chosenClues: string[] = [], polishGoal: string = replyGoals[0], polishTone: string = replyTones[0], polishExtra = '';
let polishController: AbortController | null = null, polishStatus = '', polishError = false;
let draftRevision = 0;
function stopPolish() { polishController?.abort(); polishController = null; }
function resetComposer() {
    stopPolish(); composeOpen = false; cluesOpen = false; polishOpen = false; proofOpen = '';
    chosenClues = []; polishGoal = replyGoals[0]; polishTone = replyTones[0]; polishExtra = ''; polishStatus = ''; polishError = false; hintsOpen = false;
}
function isWeiInput(n = currentNode()) { return n?.id === 'weiyan.negotiate' || n?.id === 'tutorial.weiyan.negotiate'; }
function memoryClues() {
    // Only confirmed dialogue is offered; selecting a phrase never grants evidence or NPC memory.
    return [...new Set(ui.readings.filter(r => r.loopId === engine.snapshot().loopId && ['魏延', '斥候', '守帐卒甲'].includes(r.speaker)).map(r => `${r.speaker}：${r.text}`))].slice(-8);
}

let lastSaved = '', saveWarning = '', toastTimer = 0, preserveOldSave = false;
let stopDiscovery: (() => void) | null = null;
let discoverySnapshot = engine.snapshot();
let uiLoopId = discoverySnapshot.loopId;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]!));
const btn = (action: string, label: string, cls = '', disabled = false, id = '') => `<button data-action="${action}" ${id ? `data-id="${esc(id)}"` : ''} class="${cls}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const helpButton = () => '<button data-action="help" class="quiet help-icon" aria-label="帮助" title="帮助"><span aria-hidden="true">?</span></button>';
const name = (id: string | null) => chapter.characters.find(x => x.id === id)?.name ?? '';
const currentNode = () => chapter.dialogues.find(n => n.id === engine.interactions().nodeId);
const topicKey = (n: DialogueNode) => `${n.sceneId}:${n.characterId}:${n.topicId}`;
const knowledgeTopic = (n: DialogueNode) => !n.id.startsWith('v07.listen.') && n.trigger === 'topic' && !n.freeInput && !n.choices.some(c => c.actionId || c.outcome.effects.length || c.outcome.reply.some(l => l.effects.length));
const visibleLines = (n: DialogueNode) => n.lines.filter(l => !l.when || evaluate(l.when, engine.snapshot(), { actorId: n.characterId, evidenceIds: selected, intentId: null }));
const topicSignature = (n: DialogueNode) => JSON.stringify(visibleLines(n).map(l => [l.speakerId, l.text]));
function readTopic(n: DialogueNode) {
    const r = ui.topicReadings[topicKey(n)];
    return knowledgeTopic(n) && r?.loopId === engine.snapshot().loopId && r.signature === topicSignature(n) ? r : null;
}
function startTopic(n: DialogueNode) {
    hintsOpen = false;
    replay = null; evidenceReply = false;
    reading = knowledgeTopic(n) ? { node: n, signature: topicSignature(n), lines: [] } : null;
    engine.openTopic(n.topicId, n.trigger as 'topic' | 'present_evidence');
}
function storeReading() {
    if (!reading || !reading.lines.length) return;
    ui.topicReadings[topicKey(reading.node)] = { loopId: engine.snapshot().loopId, nodeId: reading.node.id, signature: reading.signature, lines: [...reading.lines] };
}
const reportText = (value: unknown) => ({ none: '尚未交报', delivered: '军情已送达', replied: '已取得回话', relayed: '回话已转达' }[String(value)] ?? '等待军情');
function toast(s: string, discovery = false) {
    const el = document.querySelector<HTMLDivElement>('#toast')!;
    stopDiscovery?.(); stopDiscovery = null;
    el.textContent = s; el.classList.remove('show', 'discovery'); void el.offsetWidth; el.classList.add('show'); if (discovery) el.classList.add('discovery'); clearTimeout(toastTimer);
    const dismiss = () => el.classList.remove('show', 'discovery');
    if (discovery) stopDiscovery = playEvidenceDiscovery(el, dismiss);
    else toastTimer = window.setTimeout(dismiss, 3000);
}
function cache(stableSave?: string) {
    if (mainMenuView) return;
    if (preserveOldSave) { saveWarning = '旧存档备份失败，已保留原档；当前进度暂不覆盖保存。'; return; }
    try {
        const save = stableSave ?? engine.save(); lastSaved = new Date().toISOString();
        const stored = JSON.stringify({ save, ui, savedAt: lastSaved });
        localStorage.setItem(KEY, stored);
        // Keep a playable checkpoint even after the terminal autosave is written.
        if (engine.snapshot().flags['loop.result'] === 'none') localStorage.setItem(RETRY_KEY, stored);
        saveWarning = '';
    } catch (e) {
        // An unfinished conversation intentionally stays at the previous stable save.
        if (!(e instanceof Error && e.message.includes('boundary'))) saveWarning = '浏览器未能保存；本页仍可继续试玩。';
    }
}
function canSaveSlot() {
    if (mainMenuView || cinematicView || campaignView || engine.interactions().pending) return false;
    try { engine.save(); return true; } catch { return false; }
}
function saveSlot(slot: number) {
    if (!MANUAL_SLOTS.some(id => id === slot) || !canSaveSlot()) throw new Error('请先读完当前连续剧情，再保存进度。');
    const key = slotKey(slot), previous = localStorage.getItem(key);
    const stored = JSON.stringify({ save: engine.save(), ui, savedAt: new Date().toISOString() });
    // Keep the previous manual record recoverable before replacing this slot.
    if (previous) localStorage.setItem(`${key}:backup:${Date.now()}`, previous);
    localStorage.setItem(key, stored); overwriteSlot = null;
}
function slotCards(loadOnly = false) {
    const automatic = menuSave();
    return `<div class="save-slots"><section class="save-card" data-save-slot="auto"><h3>自动存档</h3><div>${automatic.label}</div>${automatic.warning ? `<p role="status">${esc(automatic.warning)}</p>` : ''}<div class="modal-actions">${loadOnly ? btn('menu-continue', '继续游戏 →', 'primary', !automatic.valid) : btn('save-now', '保存当前稳定进度', '', !canSaveSlot()) + btn('load', '读取自动存档', '', !automatic.valid)}</div></section>${MANUAL_SLOTS.map(slot => {
        const stored = menuSave(slotKey(slot));
        const confirming = overwriteSlot === slot;
        return `<section class="save-card" data-save-slot="${slot}"><h3>手动存档 ${slot}</h3><div>${stored.exists ? stored.label : '空存档位'}</div>${stored.warning ? `<p role="status">${esc(stored.warning)}</p>` : ''}${confirming ? `<p>覆盖此存档位的原进度？</p><div class="modal-actions">${btn('slot-overwrite', '确认覆盖', 'primary', !canSaveSlot(), String(slot))}${btn('slot-cancel', '取消')}</div>` : `<div class="modal-actions">${loadOnly ? '' : btn('slot-save', stored.exists ? '覆盖保存' : '保存到此处', '', !canSaveSlot(), String(slot))}${btn('slot-load', '读取存档', '', !stored.valid, String(slot))}</div>`}</section>`;
    }).join('')}</div>`;
}
function rememberLine() {
    const l = engine.currentLine();
    if (l) {
        const row = { loopId: engine.snapshot().loopId, speaker: name(l.speakerId), text: l.text };
        ui.readings.push(row); reading?.lines.push(row);
        // The scout's follow-up supplies the same fact as the separate scope question.
        // This explicit chapter relationship is independent of node IDs and wording.
        if (currentNode()?.id === 'scout.followup') {
            const scope = chapter.dialogues.find(n => n.id === 'scout.scope')!;
            ui.topicReadings[topicKey(scope)] = { loopId: row.loopId, nodeId: scope.id, signature: topicSignature(scope), lines: [row] };
        }
    }
}
function clearLoopUI() {
    const largeText = ui.largeText;
    ui = { scenes: ['camp_gate'], people: [], readings: [], topicReadings: {}, drafts: {}, largeText };
    uiLoopId = engine.snapshot().loopId;
    localStorage.removeItem(KEY + ':drafts');
    localStorage.removeItem(RETRY_KEY);
    actor = null; selected = []; responseLocked = false; panel = ''; technicalError = ''; intent = '';
    tab = 'current'; previewEvidence = ''; evidenceMode = 'browse'; hintsOpen = false;
    replay = null; reading = null; evidenceReply = false;
    clearTimeout(toastTimer); stopDiscovery?.(); stopDiscovery = null;
    document.querySelector('#toast')?.classList.remove('show', 'discovery');
    discoverySnapshot = engine.snapshot();
}
function saveDrafts() {
    try { localStorage.setItem(KEY + ':drafts', JSON.stringify({ loopId: engine.snapshot().loopId, drafts: ui.drafts })); } catch { /* keep the editable text on this page */ }
}
function sync() {
    // Keep records scoped to the active loop when restarting or restoring.
    if (engine.snapshot().loopId !== uiLoopId) clearLoopUI();
    for (let i = 0; i < 12; i++) {
        const before = engine.interactions();
        // Lamp failure is presented by the ending page, not another dialogue panel.
        // Confirm the authored terminal segment so its effects (especially the
        // teaching failure's lamp/result flags) and save boundary still commit.
        if (before.nodeId === 'tutorial.failure' || before.nodeId === 'ending.lamp_failure') {
            engine.skipCurrentSegment();
            engine.completeSegment({ deferRestart: true });
            responseLocked = false;
            continue;
        }
        if (!before.nodeId || before.line || before.choices.length || before.freeInput) break;
        engine.completeSegment({ deferRestart: true }); responseLocked = false;
        if (engine.snapshot().loopId !== uiLoopId) clearLoopUI();
    }
    const s = engine.snapshot(), after = currentNode();
    selected = selected.filter(id => !!s.evidence[id]);
    if (after) actor = after.characterId;
    if (!ui.scenes.includes(s.sceneId)) ui.scenes.push(s.sceneId);
    if (reading && (!engine.currentLine() || after?.id !== reading.node.id)) storeReading();
    if (!after) reading = null;
    // Player narration finishes in exploration, without a self-conversation topic menu.
    if (!after && actor === 'player' && s.flags['loop.result'] === 'none') leaveConversation();
    if (engine.interactions().pending) return;
    announceDiscoveries(); cache(); syncEnding(); syncCampaign();
}
function locked() { return responseLocked || currentNode()?.trigger === 'event' || engine.interactions().pending; }
function selectPerson(id: string) {
    hintsOpen = false;
    engine.selectCharacter(id); actor = id; selected = []; intent = ''; technicalError = '';
    replay = null; reading = null; evidenceReply = false;
    if (!ui.people.includes(id)) ui.people.push(id);
    const topics = engine.interactions().topics;
    const scoutOpener = id === 'scout' ? topics.find(n => ['tutorial.scout', 'scout.report'].includes(n.id)) : null;
    if (scoutOpener) {
        const old = readTopic(scoutOpener);
        if (old) replay = { lines: [...old.lines], index: 0 };
        else startTopic(scoutOpener);
    } else if (id === 'weiyan' && topics.some(n => n.id === 'tutorial.weiyan')) startTopic(topics.find(n => n.id === 'tutorial.weiyan')!);
    else if (['notice', 'curtain', 'player'].includes(id) && topics.length === 1 && !readTopic(topics[0])) startTopic(topics[0]);
}
function leaveConversation() {
    engine.enterScene(engine.snapshot().sceneId);
    actor = null; selected = []; intent = ''; replay = null; reading = null; evidenceReply = false;
}
function nextLine() {
    if (evidenceReply) { evidenceReply = false; audio.play('dialogue_next'); return; }
    if (replay) { replay.index++; if (replay.index >= replay.lines.length) replay = null; audio.play('dialogue_next'); return; }
    const line = engine.currentLine();
    if (!line) return;
    rememberLine(); engine.confirmLine(line.id); audio.play('dialogue_next'); sync();
}
function canSkipNarration() {
    const n = currentNode();
    // A narrator line inside an NPC conversation still belongs to that conversation.
    return !!n && !!engine.currentLine() && !replay && !evidenceReply &&
        !engine.interactions().pending && ['player', 'narrator'].includes(n.characterId) &&
        !n.choices.length && !n.freeInput &&
        ['player', 'narrator'].includes(engine.currentLine()!.speakerId);
}
function skipNarration() {
    if (!canSkipNarration()) return;
    const nodeId = currentNode()!.id;
    // Stop at a character's line, even when it shares a node with the narration.
    while (currentNode()?.id === nodeId && engine.currentLine() &&
        ['player', 'narrator'].includes(engine.currentLine()!.speakerId)) {
        rememberLine(); engine.confirmLine(engine.currentLine()!.id);
    }
    audio.play('dialogue_next'); sync();
}
function announceDiscoveries() {
    const now = engine.snapshot(), previous = discoverySnapshot;
    discoverySnapshot = now;
    const gained = chapter.evidence.filter(e => now.evidence[e.id] && !previous.evidence[e.id]);
    if (gained.length) { audio.play('evidence_gain'); toast(`获得证据 · ${gained.map(e => e.title).join('、')}`, true); }
}
const personSVG = (id: string, cls = 'figure') => {
    if (!whiteMode && visuals.characters[id]) return `<img class="${cls} character-image" src="${esc(visuals.characters[id])}" alt="" decoding="async">`;
    if (id === 'notice') return `<svg class="${cls}" viewBox="0 0 90 120" aria-hidden="true"><rect x="20" y="10" width="50" height="73" rx="3" fill="#fff" stroke="currentColor" stroke-width="2"/><path d="M30 28h30M30 40h30M30 52h22M45 83v28M22 111h46" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
    if (id === 'curtain') return `<svg class="${cls}" viewBox="0 0 90 120" aria-hidden="true"><path d="M10 15h70v92H10zM45 15v90M14 20l23 68-23 14M76 20L53 88l23 14" fill="#fff" stroke="currentColor" stroke-width="2"/></svg>`;
    return `<svg class="${cls}" viewBox="0 0 100 150" aria-hidden="true"><circle cx="50" cy="29" r="16" fill="#fff" stroke="currentColor" stroke-width="2"/><path d="M32 18l5-9h26l5 9M34 49h32l15 60H19zM37 110l-3 29M63 110l3 29M28 57l-15 36M72 57l15 36" fill="#fff" stroke="currentColor" stroke-width="2"/><path d="M35 65h30M32 78h36M28 92h44M50 50v58" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
};
function backdrop(scene: string, cinematic?: string) {
    const path = cinematic || visuals.scenes[scene];
    if (path && !whiteMode) return `<img class="world-image" src="${esc(path)}" alt="" aria-hidden="true" decoding="async">`;
    const tent = `<path d="M210 290L410 80l200 210zM350 290V190h120v100M410 82v106M285 210h250"/><path d="M405 194l-40 87M415 194l40 87"/>`;
    const camp = `<path d="M85 290l85-105 85 105M560 290l80-105 80 105M590 145V65h55l-9 20 9 20h-55M220 145V70h52l-9 20 9 20h-52"/><path d="M70 307h670"/>`;
    return `<svg class="backdrop" viewBox="0 0 820 340" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5">${scene === 'report_post' ? camp : tent + camp}<path d="M0 316h820M0 322h820" stroke-dasharray="3 8"/></g></svg>`;
}
function topicsHTML() {
    const v = engine.interactions(), state = engine.snapshot();
    const topics = v.topics.filter(n => n.trigger === 'topic');
    const completed = chapter.dialogues.filter(n => n.sceneId === state.sceneId && n.characterId === actor && readTopic(n));
    for (const n of completed) if (!topics.some(t => t.topicId === n.topicId)) topics.push(n);
    return `<div class="topics">${topics.map(n => {
        const read = !!readTopic(n);
        const title = n.title.replace(/^重读[：:]?/, '');
        return btn('topic', esc(title), read ? 'read' : '', false, n.id);
    }).join('')}</div>`;
}
function replyComposerHTML() {
    const n = currentNode(), v = engine.interactions();
    if (!composeOpen || !isWeiInput(n) || !v.freeInput || panel) return '';
    const draft = ui.drafts[n!.id] ?? engine.snapshot().drafts[n!.id] ?? '';
    const proofs = chapter.evidence.filter(e => engine.presentedEvidence().includes(e.id));
    const detail = proofs.find(e => e.id === proofOpen), busy = !!polishController;
    const teaching = n!.id === 'tutorial.weiyan.negotiate';
    const clues = memoryClues();
    const hints = teaching ? ['先说明为何应暂缓入帐，军情仍要及时传报。', '想好你是否愿意立即承担转呈军情的差事。', '尊重将军的职责，用安排回应他的担忧。'] : ['把禁令、军情现状与接报人选连起来说。', '说明谁立即去请姜维、在何处接报；别只提一个人名。', '军情可短候，但不能搁置；给出实际可行的安排。'];
    return `<section class="reply-composer" role="dialog" aria-label="该如何回复魏延？" aria-modal="false">
    <header><div><p class="reply-subtitle">${teaching ? '初次交涉' : '再次交涉'} · 帐前劝阻</p><h2>该如何回复魏延？</h2></div><div class="reply-header-actions"><button data-action="show-hints" aria-expanded="${hintsOpen}" aria-controls="reply-hints">提示 ?</button>${btn('close-composer', '收起 ×', 'reply-close')}</div></header>
    <div class="reply-body"><div class="reply-tools">
    ${hintsOpen ? `<aside id="reply-hints" class="reply-hints"><strong>想一想如何回应“军情紧急”</strong><ol>${hints.map(h => `<li>${esc(h)}</li>`).join('')}</ol></aside>` : ''}
    <div class="reply-row"><span class="reply-row-label">出示物品</span><div class="reply-row-content">${proofs.map(e => `<button class="reply-chip" data-action="reply-proof" data-id="${e.id}" aria-expanded="${proofOpen === e.id}">${esc(e.title)} ↗</button>`).join('') || '尚未出示'}</div>${btn('reply-evidence', '修改', 'reply-modify', v.pending || busy)}</div>
    ${detail ? `<article class="reply-proof-detail"><strong>${esc(detail.title)}</strong><p>${esc(detail.source)}</p><p>${esc(detail.proves.join('；'))}</p><small>不能说明：${esc(detail.cannotProve.join('；'))}</small></article>` : ''}
    <div class="reply-row"><span class="reply-row-label">记忆线索</span><div class="reply-row-content">${chosenClues.length ? chosenClues.map(c => `<span class="reply-chip is-selected" title="${esc(c)}">${esc(c.length > 26 ? c.slice(0,26) + '…' : c)}</span>`).join('') : '<span class="empty-clues">尚未选择 · 可回想已听到的对白</span>'}</div><button class="reply-modify" data-action="reply-clues" aria-expanded="${cluesOpen}" ${busy || v.pending ? 'disabled' : ''}>${cluesOpen ? '收起' : '选择'}</button></div>
    ${cluesOpen ? `<div class="reply-clues"><p>选择想用的记忆短语，供润色参考。</p><div class="reply-clue-options">${clues.map((c,i) => `<button class="reply-clue" data-action="reply-clue" data-id="${i}" aria-pressed="${chosenClues.includes(c)}" ${busy || v.pending ? 'disabled' : ''}>${chosenClues.includes(c) ? '✓ ' : '+ '}${esc(c)}</button>`).join('') || '还没有可回想的对白。'}</div></div>` : ''}
    <div class="reply-polish"><button class="reply-polish-toggle" data-action="reply-polish" aria-expanded="${polishOpen}" aria-controls="reply-polish-fields"><span class="reply-ai-label">AI润色<svg class="reply-ai-sparkle" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2c.9 5.8 2.2 7.1 8 8-5.8.9-7.1 2.2-8 8-.9-5.8-2.2-7.1-8-8 5.8-.9 7.1-2.2 8-8Z"/><path d="M5 15c.4 2.6 1 3.2 3.6 3.6C6 19 5.4 19.6 5 22.2c-.4-2.6-1-3.2-3.6-3.6C4 18.2 4.6 17.6 5 15Z"/></svg></span><small>选择目的与语气，帮你写一段回复</small></button>
    ${polishOpen ? `<div class="reply-polish-fields" id="reply-polish-fields"><fieldset class="reply-option-field"><legend>目的</legend><div class="reply-options" role="group" aria-label="目的">${replyGoals.map((g,i) => `<button data-action="polish-goal" data-id="${i}" aria-pressed="${g === polishGoal}" ${busy || v.pending ? 'disabled' : ''}>${esc(g)}</button>`).join('')}</div></fieldset><fieldset class="reply-option-field"><legend>语气</legend><div class="reply-options" role="group" aria-label="语气">${replyTones.map((t,i) => `<button data-action="polish-tone" data-id="${i}" aria-pressed="${t === polishTone}" ${busy || v.pending ? 'disabled' : ''}>${esc(t)}</button>`).join('')}</div></fieldset><label class="reply-extra">补充信息<input id="polish-extra" aria-label="其他信息" maxlength="200" placeholder="写下你想说的理由或办法，AI帮你组织成对白" value="${esc(polishExtra)}" ${busy || v.pending ? 'disabled' : ''}></label><div class="reply-generate-wrap">${btn(busy ? 'cancel-polish' : 'generate-polish', busy ? '生成中 · 取消' : '确认生成', 'reply-generate', v.pending)}<small>生成后可继续修改</small></div></div>` : ''}
    ${polishStatus ? `<p class="reply-polish-status ${polishError ? 'error' : ''}" role="status" aria-live="polite">${esc(polishStatus)}</p>` : ''}</div>
    </div><div class="reply-editor"><div class="reply-editor-head"><label for="draft">你的对白</label><span id="reply-count">${draft.length} / ${v.freeInput.maxLength}</span></div><textarea id="draft" maxlength="${v.freeInput.maxLength}" placeholder="${esc(v.freeInput.placeholder)}" aria-label="交涉理由与安排" ${v.pending ? 'disabled' : ''}>${esc(draft)}</textarea></div>
    ${technicalError ? `<div class="reply-service-error" role="alert">回应暂时不可用，你的文字已保留，可以重试。<br>${esc(technicalError.replace('请重试或使用预设选项', '请重试'))}</div>` : ''}
    </div><footer><p>${v.pending ? '魏延正在听你的安排……' : '可以自由输入，也可修改润色后的文案。'}</p>${v.pending ? btn('cancel-response', '取消等待') : ''}${btn('submit', v.pending ? '正在等待回应…' : '确认回复', 'reply-confirm', v.pending || busy)}</footer></section>`;
}
function sizeReplyComposer() {
    const el = root.querySelector<HTMLElement>('.reply-composer'); if (!el) return;
    const nav = root.querySelector<HTMLElement>('.sidebar')?.getBoundingClientRect(), top = root.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect();
    const narrow = window.innerWidth <= 750;
    // Use equal side margins so the dialog stays centered in the viewport.
    const sideMargin = narrow ? 16 : Math.max((nav?.right ?? 0) + 20, 24);
    const width = narrow ? window.innerWidth - sideMargin * 2 : Math.min(window.innerWidth * .71, window.innerWidth - sideMargin * 2);
    el.style.width = `${width}px`;
    el.style.left = '50%';
    el.style.top = `${Math.max((top?.bottom ?? 0) + 20, narrow ? (nav?.bottom ?? 0) + 14 : window.innerHeight * .12)}px`;
}
function freeHTML(n: DialogueNode) {
    const v = engine.interactions(), input = v.freeInput!, draft = ui.drafts[n.id] ?? engine.snapshot().drafts[n.id] ?? '';
    if (n.id === 'weiyan.negotiate' || n.id === 'tutorial.weiyan.negotiate') {
        intent = 'propose_wait';
        return `<button class="reply-launcher" data-action="open-composer"><span class="reply-launch-description">（我想想怎么跟魏将军说）</span><span class="reply-launch-title">${v.pending ? '查看等待中的回复' : '撰写回复'}</span></button>`;
    }
    if (!input.intentOptions.some(i => i.id === intent)) intent = input.intentOptions[0].id;
    return `<div class="input-box"><div class="input-head"><select id="intent" aria-label="说话目的">${input.intentOptions.map(i => `<option value="${esc(i.id)}" ${intent === i.id ? 'selected' : ''}>${esc(i.label)}</option>`).join('')}</select><span class="chip">向${esc(name(n.characterId))}说明</span></div>
    <div class="evidence-summary" style="margin-top:12px">本次出示 ${engine.presentedEvidence().length ? engine.presentedEvidence().map(id => `<span class="evidence-pill">${esc(chapter.evidence.find(e => e.id === id)?.title)}</span>`).join('') : '尚未出示物品'} ${btn('evidence', '更换物品', 'quiet', v.pending)}</div>
    <textarea id="draft" maxlength="${input.maxLength}" placeholder="${esc(input.placeholder)}" aria-label="交涉理由与安排" ${v.pending ? 'disabled' : ''}>${esc(draft)}</textarea>
    ${technicalError ? `<div class="feedback" role="alert">交涉服务暂不可用。你的文字已保留，可以重试或使用下方预设选项。<br><small>${esc(technicalError)}</small></div>` : ''}
    <div class="dialogue-foot"><div>${btn('starter', '给我一个开头', 'quiet', v.pending)}${btn('preset', '使用预设交涉选项', 'quiet', v.pending)}${v.pending ? btn('cancel-response', '取消等待', 'quiet') : ''}</div>${btn('submit', v.pending ? '正在等待回应…' : '提交说明 →', 'primary', v.pending)}</div>
</div>`;
}
function dialogHTML() {
    const v = engine.interactions(), n = currentNode(), line = v.line;
    if (!actor && !n) return '';
    const reviewLine = replay?.lines[replay.index];
    const skip = canSkipNarration();
    const head = `<div class="dialogue-head"><div class="speaker">${esc(evidenceReply ? name(actor) : reviewLine?.speaker ?? (line ? name(line.speakerId) : name(actor)))}</div>${btn(skip ? 'skip' : 'back', skip ? '跳过' : '结束交谈', 'quiet', skip ? false : locked())}</div>`;
    if (evidenceReply || reviewLine) return `<section class="dialogue ${reviewLine ? 'replaying' : ''}">${head}<div class="speech">${esc(evidenceReply ? '你给我看这个有何用？' : reviewLine!.text)}</div><div class="dialogue-foot"><span class="continue-hint">点击对话框继续</span></div></section>`;
    if (line) return `<section class="dialogue">${head}<div class="speech">${esc(line.text)}</div><div class="dialogue-foot"><span class="continue-hint">点击对话框继续</span></div></section>`;
    if (v.freeInput && n) return `<section class="dialogue ${isWeiInput(n) ? 'reply-ready' : ''}">${head}${freeHTML(n)}</section>`;
    if (v.choices.length) return `<section class="dialogue">${head}<div class="evidence-summary">${engine.presentedEvidence().length ? '已向当前人物出示：' + engine.presentedEvidence().map(id => `<span class="evidence-pill">${esc(chapter.evidence.find(e => e.id === id)?.title)}</span>`).join('') : ''}</div><div class="choice-list">${v.choices.map(c => {
        const a = chapter.actions.find(a => a.id === c.actionId);
        return btn('choice', `${a ? `<span class="action-tag">${a.timeCost === 'delay' ? '耗时行动' : '执行行动'}</span>` : ''}${esc(c.label)}${!c.enabled ? `<small> · ${esc(c.lockedText)}</small>` : ''}`, a?.timeCost === 'delay' || c.id.includes('abandon') ? 'danger' : '', !c.enabled, c.id);
    }).join('')}</div>${n?.topicId === 'preset' ? `<div class="dialogue-foot">${btn('evidence', '更换出示物品')}</div>` : ''}</section>`;
    const teaching = !engine.snapshot().flags['progress.tutorial_completed'] && actor === 'weiyan';
    const step = engine.snapshot().flags['loop.tutorial_step'];
    const guidance = teaching && step === 'notice' ? '魏延仍担心军情。请向他出示完整斥候证词；若尚未取得，请先向斥候出示告示并追问军情。' : actor === 'weiyan' && engine.snapshot().flags['loop.weiyan_notice_presented'] ? evidencePrompt() : actor === 'weiyan' && !teaching ? '先向魏延出示禁入告示，再谈军情。' : '';
    return `<section class="dialogue">${head}${guidance ? `<p class="evidence-summary">${guidance}</p>` : ''}${topicsHTML()}</section>`;
}
const allLines = (n: DialogueNode) => [...n.lines, ...n.choices.flatMap(c => c.outcome.reply), ...Object.values(n.freeInput?.outcomes ?? {}).flatMap(o => o.reply)];
function evidenceIcon(id: string): string {
    const kind = id === 'entry_notice' ? 'notice' : id === 'scout_statement' ? 'report' : ['approval_note', 'jiangwei_authorization'].includes(id) ? 'pass' : 'testimony';
    const path = visuals.ui?.[`evidence_${kind}`];
    return path ? `<img class="evidence-thumbnail" src="${esc(path)}" alt="" aria-hidden="true">` : '';
}
function evidencePrompt() {
    const { required, missing } = engine.evidenceProgress();
    return required.length > 1 && missing.length ? missing.length === required.length ? '选择你的第一个物品' : '选择你的第二个物品' : '选择一件物品';
}
function evidenceHTML() {
    const s = engine.snapshot(), v = engine.interactions();
    const list = v.evidence;
    const inference = chapter.dialogues.find(n => n.id === 'guard.connect_evidence')!;
    const canInfer = !locked() && evaluate(inference.availableWhen, s, { actorId: actor, evidenceIds: selected, intentId: null });
    const canPresent = !!actor && engine.supportsEvidencePresentation(actor) && !locked();
    if (!list.some(e => e.id === previewEvidence)) previewEvidence = list[0]?.id ?? '';
    const e = list.find(e => e.id === previewEvidence);
    const instance = e ? s.evidence[e.id] : null;
    const sourceNode = chapter.dialogues.find(n => n.id === instance?.nodeId);
    const quotes = e && sourceNode ? allLines(sourceNode).filter(l => l.effects.some(x => x.type === 'grantEvidence' && x.evidenceId === e.id) || (e.id === 'jiangwei_authorization' && l.id === 'v07.authorization.3')).map(l => l.text) : null;
    return `<div class="scrim evidence-scrim"><aside class="drawer" role="dialog" aria-label="物品"><div class="panel-head"><h2>${canPresent ? `向${esc(name(actor))}出示` : '物品'}</h2>${btn('close', '关闭 ×', 'quiet')}</div>${canPresent ? `<p class="evidence-step" role="status">${evidencePrompt()}</p>` : ''}
    ${!list.length ? `<div class="empty evidence-list">本轮还没有收集到物品。<br>调查告示，或向在场的人询问。</div>` : `<div class="evidence-columns"><div class="evidence-list" aria-label="本轮道具">${list.map(item => { return `<article data-evidence-id="${esc(item.id)}" class="evidence-card ${selected.includes(item.id) ? 'selected' : ''} ${previewEvidence === item.id ? 'previewing' : ''}">${btn('inspect-evidence', `${evidenceIcon(item.id)}<span>${esc(item.title)}${selected.includes(item.id) ? ' ✓' : ''}</span>`, 'evidence-name', false, item.id)}<button data-action="present-item" data-id="${esc(item.id)}" class="evidence-select" aria-label="出示：${esc(item.title)}" ${!canPresent ? 'disabled' : ''}>出示</button></article>`; }).join('')}</div><article class="evidence-detail"><h3>${esc(e?.title)}</h3><p class="source">${esc(e?.source)}</p>${quotes?.length ? `<blockquote>${esc(quotes.join(' '))}</blockquote>` : ''}<p>尚不能说明：${esc(e?.cannotProve.join('；'))}</p><p>来源：${esc(chapter.scenes.find(x => x.id === sourceNode?.sceneId)?.title ?? '本轮交涉')} · ${esc(sourceNode?.title ?? '已确认台词')}</p>${e?.id === 'scout_statement' && s.flags['loop.report_status'] !== 'none' ? `<p>军情记录：${reportText(s.flags['loop.report_status'])}</p>` : ''}</article></div>`}
    <div class="drawer-bottom">${canInfer && !replay ? btn('connect', '禁令与急报，如何兼顾？', 'inference-question') : ''}<p class="hint">${canPresent ? `拖动道具到${esc(name(actor))}身上，或点击「出示」。` : '点击道具查看详情；也可拖给场景中可交谈的人物。'}</p><div class="evidence-actions">${btn('close', '返回交谈')}</div></div></aside></div>`;
}
function terminalReady() {
    const v = engine.interactions();
    return engine.snapshot().flags['loop.result'] !== 'none' && !v.nodeId && !v.line && !v.pending;
}
function mandatoryEndingPending() {
    return terminalReady() && engine.snapshot().flags['loop.result'] === 'tutorial_execution';
}
function syncEnding() {
    if (!terminalReady()) return;
    const ending = endingFor(endingCatalog, engine.snapshot());
    if (!ending) return;
    const next = unlockEnding(endingCollection, ending, engine.snapshot().loopId);
    if (next === endingCollection) return;
    endingCollection = next;
    if (!endingStorageBlocked) {
        try { localStorage.setItem(ENDINGS_KEY, JSON.stringify(endingCollection)); }
        catch { endingWarning = '本次结局已显示，收集记录暂未保存。'; }
    }
}
function retrySave() {
    try {
        const raw = localStorage.getItem(RETRY_KEY);
        if (!raw) return null;
        const stored = JSON.parse(raw), state = JSON.parse(stored.save);
        if (state.loopId !== engine.snapshot().loopId || state.flags['loop.result'] !== 'none') return null;
        new NarrativeEngine(chapter, manifest.contentVersion, gameJudge()).load(stored.save);
        return stored as { save: string; savedAt: string; ui?: UI };
    } catch { return null; }
}
function resultHTML() {
    const s = engine.snapshot(), ending = endingFor(endingCatalog, s);
    if (!ending) return '';
    const count = Object.keys(endingCollection.unlocked).length;
    const actions = mandatoryEndingPending()
        ? btn('continue-teaching', '继续', 'ending-primary')
        : btn('retry-ending', '重玩本关', 'ending-primary') + btn('return-home', '返回首页');
    return `<main class="ending-screen" data-ending="${esc(ending.id)}" aria-labelledby="ending-title"><div class="ending-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div><header class="ending-header"><span>五丈原 · 第六夜</span>${btn('ending-collection', `我的结局成就 ${count} / ${endingCatalog.endings.length}`, 'ending-link')}</header><section class="ending-content"><h1 id="ending-title" tabindex="-1">${esc(ending.kind)}</h1><p class="ending-summary">${esc(ending.title)}</p><div class="ending-rule" aria-hidden="true"></div><p class="ending-description">${esc(ending.description)}</p><p class="ending-reflection">${esc(ending.hint)}</p><div class="ending-actions">${actions}</div>${endingWarning ? `<p class="ending-warning" role="status">${esc(endingWarning)}</p>` : ''}</section></main>`;
}
function collectionHTML() {
    return `<p>已解锁 ${Object.keys(endingCollection.unlocked).length} / ${endingCatalog.endings.length} 个结局。回溯和重玩后，收集记录仍然保留。</p><div class="ending-shelf">${endingCatalog.endings.map(e => {
        const unlocked = !!endingCollection.unlocked[e.id];
        return `<article class="ending-item ${unlocked ? 'unlocked' : 'sealed'}"><small>结局 ${esc(e.number)} · ${unlocked ? esc(e.kind) : '未解锁'}</small><h3>${unlocked ? esc(e.title) : '未曾抵达的命运'}</h3>${unlocked ? `<p>${esc(e.description)}</p>` : '<p>沿不同的选择，寻找另一个结局。</p>'}</article>`;
    }).join('')}</div>${endingWarning ? `<p role="status">${esc(endingWarning)}</p>` : ''}`;
}
function conditionHTML(c: Condition): string {
    const state = engine.snapshot();
    const ok = evaluate(c, state, { actorId: actor, evidenceIds: selected, intentId: intent || null });
    let label: string;
    if ('all' in c) label = c.all.length ? '同时满足' : '无额外条件';
    else if ('any' in c) label = '满足任一';
    else if ('not' in c) label = '不满足下项';
    else if ('flag' in c) label = `${chapter.initialFlags.find(f => f.id === c.flag)?.description ?? c.flag} = ${c.equals}（当前：${state.flags[c.flag]}）`;
    else if ('evidence' in c) label = `${chapter.evidence.find(e => e.id === c.evidence)?.title ?? c.evidence} · ${c.mode === 'held' ? '本轮持有' : '向当前人物出示'}`;
    else label = `交涉目的：${c.intent}`;
    const children = 'all' in c ? c.all : 'any' in c ? c.any : 'not' in c ? [c.not] : [];
    return `<div class="condition ${ok ? 'met' : 'unmet'}"><span>${ok ? '✓' : '○'} ${esc(label)}</span>${children.length ? `<div class="condition-children">${children.map(conditionHTML).join('')}</div>` : ''}</div>`;
}
function logicHTML(): string {
    const state = engine.snapshot(), node = currentNode();
    const rows = chapter.initialFlags.map(f => `<tr><td>${esc(f.id)}<small>${esc(f.description)}</small></td><td>${f.scope === 'progress' ? '教学阶段' : '当轮状态'}</td><td>${esc(state.flags[f.id])}</td></tr>`).join('');
    const acquired = chapter.evidence.filter(e => state.evidence[e.id]).map(e => {
        const item = state.evidence[e.id];
        return `<div class="logic-item"><strong>${esc(e.title)}</strong><p>${esc(e.source)}</p><small>获取节点：${esc(item.nodeId)} · 触发记录：${esc(item.sourceEvent)} · 本轮有效</small></div>`;
    }).join('');
    const trace = state.history.filter(h => h.kind === 'action' || h.kind === 'choice' || h.kind === 'effects' || h.kind.startsWith('promise') || h.kind === 'rewind').slice(-35).reverse().map(h => `<div class="log-line"><small>${h.loopId === state.loopId ? '本轮' : '旧轮'} · ${esc(h.kind)} · ${esc(h.target)}</small><div>${Object.entries(h.changes).map(([k,v]) => `${esc(k)} → ${esc(v)}`).join('；') || (h.kind === 'action' ? '实际行动已执行' : '记录已提交')}</div></div>`).join('');
    return `<p>此面板读取同一份剧情条件和引擎状态，只供检查，不会修改进度。</p><div class="logic-chain"><span>当夜调查</span> → <span>合成判断</span> → <span>请求／获准</span> → <span>实际交报</span> → <span>取回与转达</span> → <span>结算</span></div>
    <h3>当前节点：${esc(node?.title ?? '自由调查')}</h3>${node ? conditionHTML(node.availableWhen) + node.choices.map(ch => `<details><summary>${esc(ch.label)}</summary><p>可见条件</p>${conditionHTML(ch.visibleWhen)}<p>可执行条件</p>${conditionHTML(ch.enabledWhen)}${ch.actionId ? `<p>实际行动：${esc(ch.actionId)}</p>${conditionHTML(chapter.actions.find(a => a.id === ch.actionId)!.availableWhen)}<p>行动耗时：${chapter.actions.find(a => a.id === ch.actionId)!.timeCost === 'delay' ? '消耗一次等待' : '不消耗等待'}</p><pre>${esc(JSON.stringify(chapter.actions.find(a => a.id === ch.actionId)!.effects, null, 2))}</pre>` : ''}<p>回应确认与选项完成效果</p><pre>${esc(JSON.stringify({reply: ch.outcome.reply.map(l => ({id: l.id, effects: l.effects})), effects: ch.outcome.effects, next: ch.outcome.next}, null, 2))}</pre></details>`).join('') : '<p>选中人物话题后，这里显示该节点的条件。</p>'}
    <details><summary>本轮物品与获取位置（${Object.keys(state.evidence).length}）</summary>${acquired || '<p>尚未取得本轮证据。</p>'}<p>拿到物品不等于出示；重新开始会清空全部证据与许可。</p></details>
    <details><summary>全部 flag 与作用域</summary><table class="flag-table"><thead><tr><th>状态</th><th>作用域</th><th>当前值</th></tr></thead><tbody>${rows}</tbody></table></details>
    <details><summary>结算条件</summary>${chapter.events.filter(e => e.id !== 'event.relay_discovery').map(e => `<h3>${esc(e.id)}</h3>${conditionHTML(e.when)}`).join('')}</details>
    <details><summary>最近触发与状态变化</summary>${trace}</details>
    <details><summary>当前节点的统一数据格式</summary><pre>${esc(JSON.stringify(node ?? { schemaVersion: chapter.schemaVersion, source: 'content/chapters/wuzhang/chapter.json' }, null, 2))}</pre></details>`;
}
function modalHTML() {
    const s = engine.snapshot();
    let title = '', body = '';
    if (panel === 'retry-ending') {
        title = '再试一次';
        const checkpoint = retrySave();
        body = `<p>回到存档会保留此前已完成的调查；重来本关会重新收集本轮信息。已解锁的结局会保留。</p><div class="retry-options">${btn('load-retry', `<strong>回到存档</strong><small>${checkpoint ? esc(chapter.scenes.find(x => x.id === JSON.parse(checkpoint.save).sceneId)?.title) + ' · ' + esc(new Date(checkpoint.savedAt).toLocaleString('zh-CN')) : '本轮没有可用的终局前存档'}</small>`, '', !checkpoint)}${btn('restart-ending', `<strong>重来本关</strong><small>${s.flags['progress.tutorial_completed'] ? '从正常调查起点开始' : '从教学起点开始'}，清空本轮证据、准信和行动</small>`)}</div>`;
    } else if (panel === 'ending-collection') { title = '结局收集'; body = collectionHTML(); }
    else if (panel === 'logic') { title = '因果、条件与物品获取'; body = logicHTML(); } else if (panel === 'help') {
        title = '怎么玩'; body = `<div class="modal-actions">${btn('records', '谈话记录')}</div><p>选择地点与人物交谈。读完对白、取得证据，再向当前人物出示。两次魏延交涉中，先出示禁令，再出示军情等证据，并自行说明及时传报的办法。</p><p>魏延交涉先出示物品，再自行填写并提交沟通；查看提示只填写可编辑草稿。自由输入调用本机 AI 代理；首次拦下后会因转报未落实、没有回令而被魏延处死；继续进入复活调查，先问准接报与决策安排，再完成传报。首次游戏先完成教学；之后重新开始会直接进入正常调查，并清空本轮信息。</p>`;
    } else if (panel === 'records') {
        title = '已收集的信息';
        body = `<p>本轮已确认的台词会记录在这里，返回后可以重读。重新开始后清空。</p>${ui.readings.length ? ui.readings.filter(r => r.loopId === s.loopId).slice().reverse().map(r => `<div class="log-line"><small>本轮交談</small><div><strong>${esc(r.speaker)}</strong>　${esc(r.text)}</div></div>`).join('') : '<div class="empty">读完并确认第一句对白后，记录会出现在这里。</div>'}`;
    } else if (panel === 'menu-load') {
        title = '读取存档';
        body = `<p>选择一个存档，继续这一夜。</p>${slotCards(true)}<div class="modal-actions">${btn('close', '返回')}</div>`;
    } else if (panel === 'menu-new-confirm') {
        title = '新游戏';
        body = `<p>重新开始会替换当前自动存档，并清空本轮调查和谈话记录。两个手动存档、已完成的教学、结局成就和设置会保留。</p><div class="modal-actions">${btn('menu-start', '开始新游戏 →', 'primary')}${btn('close', '返回')}</div>`;
    } else if (panel === 'save') {
        title = '本机存档';
        body = `<p>共三个存档位：一个自动存档、两个手动存档。连续剧情读完后可保存；手动存档不会随自动保存或新游戏被替换，交涉草稿也会一起保留。</p>${slotCards()}${saveWarning ? `<p role="status">${esc(saveWarning)}</p>` : ''}<div class="modal-actions">${btn('new-confirm', '开始全新游戏', 'danger')}</div>`;
    } else if (panel === 'settings') {
        title = '设置'; body = `<div class="audio-settings">${(['music', 'sfx'] as const).map(bus => `<div class="volume-setting"><label for="volume-${bus}">${bus === 'music' ? '音乐音量' : '音效音量'}</label><output id="volume-${bus}-value" for="volume-${bus}">${volumeLabel(audio.volume(bus))}</output><input id="volume-${bus}" data-audio-bus="${bus}" type="range" min="0" max="100" step="1" value="${audio.volume(bus)}" aria-valuetext="${volumeLabel(audio.volume(bus))}"><small>静音</small><small>100%</small></div>`).join('')}</div><p class="audio-hint">拉到最左为静音。音量设置会自动记住。</p><label class="range-label"><input id="large-text" type="checkbox" ${ui.largeText ? 'checked' : ''}>加大对话文字</label><p>点击画面空白处、空格 / Enter 继续当前台词。Esc 关闭浮层。已读的线性对白可跳过，分支与行动仍需亲自选择。</p>`;
    } else if (panel === 'restart-confirm') {
        title = '重玩本关'; body = `<p>重新开始本关？本轮证据、许可、已读话题、交谈记录、行动和草稿全部清空；教学完成后直接进入正常调查。</p><div class="modal-actions">${btn('close', '取消')}${btn('new', '重新开始', 'restart-game')}</div>`;
    } else if (panel === 'new-confirm') {
        title = '开始全新游戏'; body = `<p>这会清空本轮信息和谈话记录。教学已完成时，直接回到正常调查起点。</p><div class="modal-actions">${btn('new', '清除存档并重新开始', 'danger')}${btn('close', '继续当前游戏')}</div>`;
    }
    if (panel === 'settings') body += `<section class="api-settings" aria-label="AI 服务配置"><h3>AI 服务</h3><label for="api-base-url">API 服务网址</label><input id="api-base-url" data-api-field="baseUrl" type="url" value="${esc(apiSettings.baseUrl)}" placeholder="https://api.deepseek.com" spellcheck="false" ${apiSettingsBusy ? 'disabled' : ''}><label for="api-model">模型</label><input id="api-model" data-api-field="model" type="text" value="${esc(apiSettings.model)}" spellcheck="false" ${apiSettingsBusy ? 'disabled' : ''}><label for="api-key">API 密钥</label><input id="api-key" data-api-field="apiKey" type="password" value="${esc(apiSettings.apiKey)}" autocomplete="off" spellcheck="false" ${apiSettingsBusy ? 'disabled' : ''}><p>支持兼容 OpenAI 的服务，思考已关闭。配置保存在本机，修改后点击保存。</p>${btn('save-api-settings', apiSettingsBusy ? '请稍候…' : '保存 API 配置', 'primary', apiSettingsBusy || !apiSettingsLoaded)}<p class="api-settings-status ${apiSettingsError ? 'error' : ''}" role="status">${esc(apiSettingsStatus)}</p></section>`;
    return `<div class="scrim center-scrim" data-dismiss="true"><section class="modal ${terminalReady() || panel === 'ending-collection' || panel === 'retry-ending' ? 'ending-modal' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="panel-head"><h2>${title}</h2>${btn('close', '关闭 ×', 'quiet')}</div>${body}</section></div>`;
}
function persistCampaign() {
    if (campaignStorageBlocked) return;
    try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaign)); }
    catch { campaignWarning = '本页仍可继续，关卡进度暂未保存。'; }
}
function restoreCampaign() {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    try { campaign = parseCampaign(raw); }
    catch {
        // Keep incompatible progress recoverable, separately from the narrative save.
        try { if (raw) localStorage.setItem(`${CAMPAIGN_KEY}:backup:${Date.now()}`, raw); }
        catch { campaignStorageBlocked = true; }
        campaign = freshCampaign(); campaignWarning = '关卡进度格式已变化，原记录已保留。';
    }
}
function syncCampaign() {
    const s = engine.snapshot(), v = engine.interactions();
    const next = completeSafe(campaign, s, !v.nodeId && !v.line && !v.pending);
    if (next !== campaign) { campaign = next; persistCampaign(); }
    if (s.flags['loop.result'] === 'safe' && campaign.presentation?.loopId === s.loopId) campaignView = campaign.presentation.stage;
}
function advanceCampaign() {
    if (!campaign.presentation || campaign.presentation.loopId !== engine.snapshot().loopId) return;
    campaign = advancePresentation(campaign); campaignView = campaign.presentation?.stage ?? null; persistCampaign(); render();
}
function resetCampaignView() {
    mainMenuView = false;
    homeView = false; localStorage.removeItem(HOME_KEY);
    cinematicView = false; cinematicPlayer.dispose();
    clearTimeout(rewindTimer); rewindTimer = 0; rewindStamp = ''; campaignView = null;
    campaign = { ...campaign, presentation: null }; videoStatus = ''; persistCampaign();
}
function renderCampaign() {
    const stage = campaignView!;
    audio.setMusicPaused(stage === 'video');
    if (stage === 'video') {
        root.dataset.campaignView = stage;
        const loop = engine.snapshot().loopId, key = `safe:${loop}`;
        if (cinematicPlayer.done(key)) { advanceCampaign(); return; }
        const clips = cinematics.safe.length ? cinematics.safe : endingVideo.src ? [{ id: endingVideo.id, src: endingVideo.src, title: endingVideo.title }] : [];
        cinematicView = true;
        cinematicPlayer.mount(root, key, clips, 'safe', () => {
            cinematicView = false;
            if (campaignView === 'video' && engine.snapshot().loopId === loop) advanceCampaign();
        });
        return;
    }
    root.dataset.campaignView = stage;
    if (stage === 'ending') { root.innerHTML = resultHTML() + (panel ? modalHTML() : ''); return; }
    if (stage === 'rewind') {
        root.innerHTML = `<main class="campaign-screen rewind-screen" data-campaign="rewind"><h1>${esc(endingVideo.rewindText)}</h1>${btn('open-campaign', '展开关卡地图')}</main>`;
        const stamp = `${campaign.presentation?.loopId}:rewind`;
        if (rewindStamp !== stamp) {
            rewindStamp = stamp; clearTimeout(rewindTimer);
            rewindTimer = window.setTimeout(() => { if (campaignView === 'rewind' && rewindStamp === stamp) advanceCampaign(); }, 3000);
        }
        return;
    }
    clearTimeout(rewindTimer); rewindTimer = 0;
    const statusNames = { locked: '未解锁', history: '历史环节 · 已通关', preparing: '已解锁 · 筹备中', available: '可以试玩' };
    const playing = engine.snapshot().flags['loop.result'] === 'none';
    const pendingTeaching = mandatoryEndingPending();
    root.innerHTML = `<main class="campaign-screen campaign-map" data-campaign="map"><header class="campaign-head"><div><small>时光回溯 · 关卡舆图</small><h1>再往前，寻找转机</h1><p class="campaign-subtitle">沿历史的来路，重寻未尽之事。</p></div>${playing || pendingTeaching ? btn('return-game', homeView ? '继续游戏' : '返回本轮调查') : ''}</header><section class="level-map" aria-label="回溯关卡"><svg class="map-contours" viewBox="0 0 1200 650" preserveAspectRatio="none" aria-hidden="true"><g class="map-time-ring"><circle cx="624" cy="260" r="205"/><circle cx="624" cy="260" r="226"/></g><g class="map-time-echo"><circle cx="624" cy="260" r="260"/><circle cx="624" cy="260" r="290"/></g><path class="map-route-glow" d="M216 442C335 457 377 284 624 260"/><path class="map-route-base" d="M216 442C335 457 377 284 624 260"/><path class="map-route-flow" d="M216 442C335 457 377 284 624 260"/><path class="map-route-future" d="M624 260Q830 330 984 156"/></svg><span class="map-direction" aria-hidden="true">逆流 · 溯往</span>${levels.map(l => {
        const status = levelStatus(campaign, l);
        return `<article class="level-card ${status}" data-level="${l.id}" style="left:${l.x}%;top:${l.y}%">${status === 'history' ? '<span class="level-seal" aria-hidden="true">留痕</span>' : ''}<small>${statusNames[status]}${campaign.played.includes(l.id) ? ' · 已玩' : ''}</small><h2>${status === 'locked' ? '未启之地' : esc(l.title)}</h2><p>${status === 'locked' ? '此段历史，暂且封存' : esc(l.summary)}</p>${btn('map-level', status === 'history' ? '重玩这一夜' : status === 'preparing' ? '筹备中' : status === 'locked' ? '尚未解锁' : pendingTeaching && l.implemented ? '继续游戏' : '开始调查', '', status === 'locked' || status === 'preparing', l.id)}</article>`;
    }).join('')}</section><div class="map-legend" aria-hidden="true"><span><i></i>历史留痕</span><span class="next"><i></i>回溯目标</span><span class="sealed"><i></i>尚未解锁</span></div>${campaignWarning ? `<p class="campaign-note" role="status">${esc(campaignWarning)}</p>` : ''}</main>`;
    if (homeView || terminalReady()) root.querySelector('.campaign-head')?.insertAdjacentHTML('beforeend', btn('ending-collection', '我的结局成就'));
    root.querySelector('.campaign-head')?.insertAdjacentHTML('beforeend', btn('settings', '设置', 'quiet'));
    root.querySelector('.campaign-head')?.insertAdjacentHTML('beforeend', btn('open-main-menu', '返回开始页', 'quiet'));
    root.querySelector('.campaign-head')?.insertAdjacentHTML('beforeend', helpButton());
    if (panel) root.insertAdjacentHTML('beforeend', modalHTML());
}

function menuSave(sourceKey = KEY) {
    try {
        const raw = localStorage.getItem(sourceKey);
        if (!raw) return { exists: false, valid: false, label: '尚无存档 · 开始新游戏，写下这一夜的命运。', warning: '' };
        const stored = JSON.parse(raw), state = JSON.parse(stored.save);
        if (state.contentVersion !== manifest.contentVersion) return { exists: true, valid: false, label: '旧版本存档', warning: '剧情版本已更新，原存档仍保留。请开始新游戏。' };
        new NarrativeEngine(chapter, manifest.contentVersion, gameJudge()).load(stored.save);
        const date = new Date(stored.savedAt);
        const time = Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN') : '保存时间未知';
        return { exists: true, valid: true, label: `${esc(chapter.scenes.find(s => s.id === state.sceneId)?.title ?? '五丈原')}<br><small>${esc(time)}</small>`, warning: '' };
    } catch { return { exists: true, valid: false, label: '暂时无法读取此存档', warning: '原存档已保留，没有被覆盖。' }; }
}
function renderMainMenu() {
    delete root.dataset.campaignView;
    cinematicView = false; cinematicPlayer.dispose();
    audio.setMusicPaused(false);
    audio.setMusic('home');
    const saves = [menuSave(), ...MANUAL_SLOTS.map(slot => menuSave(slotKey(slot)))];
    const saved = { valid: saves.some(s => s.valid), exists: saves.some(s => s.exists) };
    root.innerHTML = `<main class="main-menu" aria-labelledby="main-menu-title"><div class="menu-background" aria-hidden="true"></div><div class="menu-shade" aria-hidden="true"></div><header class="menu-header"><span>三国 · 叙事解谜</span><span>建兴十二年 · 秋</span></header><section class="menu-content"><div class="menu-title-group"><h1 id="main-menu-title"><img class="menu-title-art" src="/main-menu-title-v02.png" alt="逆转五丈原" width="1536" height="1024" fetchpriority="high" draggable="false"></h1><p class="menu-tagline">一灯未灭，天命未定。</p></div><nav class="menu-actions" aria-label="主菜单"><button class="menu-button menu-new" data-action="menu-new"><span>新游戏</span><span class="menu-arrow" aria-hidden="true">→</span></button><button class="menu-button" data-action="menu-load"><span>读取存档</span><span class="menu-meta">${saved.valid ? '继续这一夜' : saved.exists ? '查看存档' : '暂无存档'}</span></button><button class="menu-button" data-action="settings"><span>设置</span></button><button class="menu-button" data-action="ending-collection"><span>结局成就</span><span class="menu-meta">${Object.keys(endingCollection.unlocked).length} / ${endingCatalog.endings.length}</span></button></nav></section><footer class="menu-footer"><span>风起五丈原</span><span>灯火尚在 · 静候回溯</span></footer></main>${panel ? modalHTML() : ''}`;
}
function render() {
    const evidenceWasOpen = !!root.querySelector('.evidence-scrim');
    const replyScroll = root.querySelector('.reply-body')?.scrollTop ?? 0;
    const nextComposeKey = `${engine.snapshot().loopId}:${currentNode()?.id ?? ''}:${actor}:${homeView}:${campaignView}`;
    if (nextComposeKey !== composeKey) { resetComposer(); composeKey = nextComposeKey; }
    if (mainMenuView) { renderMainMenu(); return; }
    syncEnding(); syncCampaign();
    if (homeView) { audio.setMusic(null); campaignView = 'map'; renderCampaign(); return; }
    if (campaignView) { audio.setMusic(null); renderCampaign(); return; }
    delete root.dataset.campaignView;
    const state = engine.snapshot(), interaction = engine.interactions();
    const requestedOpeningKey = openingRequest?.loopId === state.loopId ? openingRequest.key : '';
    // A completed opening must yield to later movies in this same loop,
    // including saves made before the opening marker was cleared.
    const openingKey = requestedOpeningKey && !cinematicPlayer.done(requestedOpeningKey) ? requestedOpeningKey : '';
    const opening = !!openingKey;
    const finished = !interaction.nodeId && !interaction.line && !interaction.pending;
    // The old blame film omits the revised questioning; use the complete authored scene.
    const sacrifice = false; // Revised teaching is performed in dialogue, never the old EN02 film.
    const execution = state.flags['loop.result'] === 'execution' && state.flags['loop.execution_reason'] !== 'provocation' && finished;
    const movieKey = openingKey || (sacrifice ? `sacrifice:${state.loopId}` : execution ? `execution:${state.loopId}` : '');
    if (movieKey && !cinematicPlayer.done(movieKey)) {
        audio.setMusicPaused(true);
        audio.setMusic(null);
        cinematicView = true;
        cinematicPlayer.mount(root, movieKey, opening ? cinematics.opening : sacrifice ? cinematics.sacrifice ?? [] : cinematics.execution, opening ? 'opening' : sacrifice ? 'sacrifice' : 'execution', () => { cinematicView = false; render(); });
        return;
    }
    cinematicView = false; cinematicPlayer.dispose();
    audio.setMusicPaused(false);
    audio.setMusic(terminalReady() ? null : actor === 'weiyan' ? 'weiyan' : state.flags['progress.tutorial_completed'] ? 'round2' : 'round1');
    if (terminalReady()) { root.innerHTML = resultHTML() + (panel ? modalHTML() : ''); return; }
    const evidenceScroll = root.querySelector('.evidence-list')?.scrollTop ?? 0;
    const s = engine.snapshot(), v = engine.interactions(), f = s.flags;
    const scene = chapter.scenes.find(x => x.id === s.sceneId)!;
    const persons = v.characters.filter(a => a.id !== 'player');
    const shotId = visuals.characters[v.line?.speakerId ?? ''] ? v.line!.speakerId : actor;
    const compositeScene = !whiteMode && scene.id === 'report_post' && !actor && persons.some(p => p.id === 'scout' && p.enabled) && persons.some(p => p.id === 'weiyan' && p.enabled);
    const cinematic = !whiteMode && scene.id === 'report_post' && actor === 'weiyan' ? visuals.cinematics?.weiyan_report_post : compositeScene ? visuals.cinematics?.report_post_people : null;
    const shot = !whiteMode && !cinematic && shotId ? visuals.characters[shotId] : null;
    root.innerHTML = `<div data-scene="${esc(scene.id)}" class="shell ${compositeScene && cinematic ? 'composite-scene' : ''} ${actor ? 'conversation' : 'exploring'}">${backdrop(scene.id, cinematic ?? undefined)}<div class="world-shade"></div><header class="topbar"><div class="brand"><h1>五丈原 · 第六夜</h1></div><div class="top-actions">${btn('show-map', '关卡地图', 'quiet', locked())}${btn('restart-confirm', '重玩本关', 'restart-game')}${btn('settings', '设置', 'quiet')}${btn('save', '存档', 'quiet')}${helpButton()}</div></header>
    <div class="workspace"><nav class="sidebar" aria-label="地点">${v.scenes.map(x => btn('scene', `<span class="row"><span>${esc(x.title.replace('中军帐外候报处', '帐外候报处'))}</span>${!ui.scenes.includes(x.id) ? '<span class="new">New</span>' : ''}</span>`, `scene-link ${x.id === s.sceneId ? 'active' : ''}`, !x.enabled || locked(), x.id)).join('')}</nav>
    <main class="main">${shot ? `<img class="dialogue-shot" src="${esc(shot)}" alt="${esc(name(shotId))}" decoding="async">` : ''}${btn('browse-evidence', `物品 <span class="evidence-count">${v.evidence.length}</span>`, 'evidence-browse')}${actor && engine.supportsEvidencePresentation(actor) ? btn('evidence', '出示物品', 'evidence-entry') : ''}
    ${!actor ? `<div class="scene-stage"><div class="hotspots">${persons.map(a => btn('person', `${personSVG(a.id)}<span class="label">${['notice', 'curtain'].includes(a.id) ? '⌕' : '<span class="talk-icon" aria-hidden="true">•••</span>'} ${esc(a.name)}${!ui.people.includes(a.id) && !['notice', 'curtain'].includes(a.id) ? '<span class="new">New</span>' : ''}</span>`, `hotspot ${['notice', 'curtain'].includes(a.id) ? 'object' : ''}`, !a.enabled || locked(), a.id)).join('')}${!persons.length ? `<p class="stage-empty">${scene.id === 'relay_tent' && f['loop.relay_location'] === 'waiting_area' ? '乙已前往候报处。' : '这里暂无可交谈的人。'}</p>` : ''}</div></div>` : ''}
    ${dialogHTML()}</main></div></div>
    ${panel === 'evidence' && actor && engine.supportsEvidencePresentation(actor) && !locked() ? `<div class="evidence-drop-person" data-evidence-target="${esc(actor)}"><span>交给${esc(name(actor))}<small>松手出示</small></span></div>` : ''}${panel === 'evidence' ? evidenceHTML() : panel ? modalHTML() : ''}${replyComposerHTML()}`;
    if (!whiteMode && visuals.ui) {
        for (const [id, path] of Object.entries(visuals.ui)) root.querySelector<HTMLElement>('.shell')?.style.setProperty(`--${id.replaceAll('_', '-')}`, `url("${path}")`);
    }
    if (ui.largeText) root.querySelectorAll<HTMLElement>('.speech').forEach(el => el.style.fontSize = whiteMode ? '23px' : 'calc(var(--main-text) * 1.15)');
    if (evidenceWasOpen) { const drawer = root.querySelector<HTMLElement>('.evidence-scrim .drawer'); if (drawer) drawer.style.animation = 'none'; }
    sizeEvidencePanel(); sizeReplyComposer();
    const replyBody = root.querySelector('.reply-body');
    if (replyBody) replyBody.scrollTop = replyScroll;
    const evidenceList = root.querySelector('.evidence-list');
    if (evidenceList) evidenceList.scrollTop = evidenceScroll;
}
function sizeEvidencePanel() {
    if (!whiteMode) {
        const topbar = root.querySelector<HTMLElement>('.topbar');
        const shell = root.querySelector<HTMLElement>('.shell');
        const browse = root.querySelector<HTMLElement>('.evidence-browse');
        if (topbar && shell && browse) browse.style.top = `${topbar.getBoundingClientRect().bottom - shell.getBoundingClientRect().top + 14}px`;
    }
    const drawer = root.querySelector<HTMLElement>('.evidence-scrim .drawer');
    const dialogue = root.querySelector<HTMLElement>('.dialogue');
    if (!drawer || !dialogue) return;
    if (whiteMode) drawer.style.setProperty('--evidence-height', `${window.innerHeight * .62}px`);
    const top = drawer.getBoundingClientRect().top;
    const bottom = Math.min(dialogue.getBoundingClientRect().top - (whiteMode ? 14 : window.innerHeight * .0255), window.innerHeight - 18);
    if (!whiteMode) drawer.style.setProperty('--evidence-height', `${Math.max(100, Math.min(window.innerHeight * .62, bottom - top))}px`);
    const sample = document.createElement('span');
    sample.className = 'speech'; sample.style.position = 'absolute'; sample.style.visibility = 'hidden';
    drawer.append(sample);
    drawer.style.setProperty('--item-text', getComputedStyle(sample).fontSize);
    sample.remove();
}
window.addEventListener('resize', () => { sizeEvidencePanel(); sizeReplyComposer(); });
window.addEventListener('scroll', sizeEvidencePanel, { passive: true });
function reset(startOpening = false) {
    resetCampaignView();
    preserveOldSave = false; localStorage.removeItem(KEY);
    if (engine.snapshot().flags['progress.tutorial_completed']) engine.rewind();
    else { engine.cancelFreeInput(); engine = new NarrativeEngine(chapter, manifest.contentVersion, gameJudge()); }
    clearLoopUI(); lastSaved = ''; saveWarning = '';
    openingRequest = startOpening ? { version: manifest.contentVersion, loopId: engine.snapshot().loopId, key: `opening:${engine.snapshot().loopId}` } : null;
    try {
        if (openingRequest) localStorage.setItem(OPENING_KEY, JSON.stringify(openingRequest));
        else localStorage.removeItem(OPENING_KEY);
    } catch { saveWarning = '浏览器未能保存影片进度；本页仍可播放。'; }
    if (startOpening) {
        // Persist a stable story boundary before opening narration starts, so an
        // unfinished new-game movie remains available from the main menu's load.
        const checkpoint = new NarrativeEngine(chapter, manifest.contentVersion, gameJudge());
        checkpoint.load(JSON.stringify(engine.snapshot()));
        cache(checkpoint.save());
    }
    if (!engine.interactions().nodeId) selectPerson('player');
    sync();
}
function rewind() {
    resetCampaignView();
    engine.rewind(); clearLoopUI();
    if (!engine.interactions().nodeId) selectPerson('player');
    sync(); toast('重新开始调查。全部证据、许可、谈话、行动与草稿已清空。');
}
function restore(sourceKey = KEY, includeDrafts = true) {
    const stored = JSON.parse(localStorage.getItem(sourceKey) ?? 'null');
    if (!stored?.save) return false;
    const previousVersion = JSON.parse(stored.save).contentVersion;
    if (previousVersion !== manifest.contentVersion) {
        // Keep the exact original save and the separately persisted drafts before any new autosave.
        const backupKey = `${KEY}:compat-backup:${previousVersion ?? 'unknown'}:${Date.now()}`;
        try { localStorage.setItem(backupKey, JSON.stringify({ stored: localStorage.getItem(KEY), drafts: localStorage.getItem(KEY + ':drafts') })); }
        catch { preserveOldSave = true; throw new Error('旧存档备份失败，原档仍保留；当前新进度暂不覆盖保存。'); }
        localStorage.removeItem(KEY + ':drafts');
        throw new Error('剧情版本已更新；旧存档和草稿已完整保留在本机兼容备份，新版从开场开始。');
    }
    engine.load(stored.save); if (sourceKey === RETRY_KEY) resetCampaignView();
    discoverySnapshot = engine.snapshot(); uiLoopId = discoverySnapshot.loopId;
    ui = { scenes: [discoverySnapshot.sceneId], people: [], readings: [], topicReadings: {}, drafts: {}, largeText: ui.largeText };
    if (stored.ui && Array.isArray(stored.ui.readings) && Array.isArray(stored.ui.scenes) && Array.isArray(stored.ui.people) && stored.ui.drafts && typeof stored.ui.drafts === 'object') ui = stored.ui;
    ui.topicReadings ??= {};
    ui.readings = ui.readings.filter(r => r.loopId === uiLoopId);
    ui.topicReadings = Object.fromEntries(Object.entries(ui.topicReadings).filter(([, r]) => r.loopId === uiLoopId));
    // Upgrade earlier stable saves from the actual confirmed-line history.
    const state = engine.snapshot();
    const confirmed = state.history.filter(h => h.loopId === state.loopId && h.kind === 'line').flatMap(h => chapter.dialogues.flatMap(n => allLines(n).filter(l => l.id === h.target).map(l => ({ n, l }))));
    for (const n of chapter.dialogues.filter(knowledgeTopic)) {
        if (ui.topicReadings[topicKey(n)]?.loopId === state.loopId) continue;
        const rows = confirmed.filter(x => topicKey(x.n) === topicKey(n));
        if (visibleLines(n).length && visibleLines(n).every(l => rows.some(x => x.l.text === l.text && x.l.speakerId === l.speakerId))) {
            ui.topicReadings[topicKey(n)] = { loopId: state.loopId, nodeId: n.id, signature: topicSignature(n), lines: rows.map(x => ({ loopId: state.loopId, speaker: name(x.l.speakerId), text: x.l.text })) };
        }
    }
    const followup = confirmed.filter(x => x.n.id === 'scout.followup');
    if (followup.length) {
        const n = chapter.dialogues.find(n => n.id === 'scout.scope')!;
        if (ui.topicReadings[topicKey(n)]?.loopId !== state.loopId) ui.topicReadings[topicKey(n)] = { loopId: state.loopId, nodeId: n.id, signature: topicSignature(n), lines: followup.map(x => ({ loopId: state.loopId, speaker: name(x.l.speakerId), text: x.l.text })) };
    }
    try { const storedDrafts = JSON.parse(localStorage.getItem(KEY + ':drafts') ?? 'null'); if (includeDrafts && storedDrafts?.loopId === uiLoopId) ui.drafts = { ...ui.drafts, ...storedDrafts.drafts }; } catch { /* keep current stable save drafts */ }
    hintsOpen = false;
    lastSaved = stored.savedAt; actor = engine.interactions().actorId; selected = []; panel = ''; responseLocked = false; technicalError = '';
    replay = null; reading = null; evidenceReply = false;
    // Earlier versions could save before completing the intro after closing its first line.
    // Reopen that narration so the player can read or skip it and unlock the first destination.
    if (!state.flags['progress.tutorial_completed'] && !state.flags['loop.seen_intro'] &&
        state.flags['loop.result'] === 'none' && state.sceneId === 'camp_gate' && !engine.interactions().nodeId) selectPerson('player');
    return true;
}
root.addEventListener('input', e => {
    const el = e.target as HTMLInputElement;
    const field = el.dataset.apiField;
    if (field === 'apiKey' || field === 'baseUrl' || field === 'model') { apiSettings[field] = el.value; return; }
    if (el.dataset.audioBus === 'music' || el.dataset.audioBus === 'sfx') {
        const bus = el.dataset.audioBus as AudioBus;
        audio.setVolume(bus, Number(el.value));
        const label = volumeLabel(audio.volume(bus));
        const output = root.querySelector(`#volume-${bus}-value`); if (output) output.textContent = label;
        el.setAttribute('aria-valuetext', label);
        return;
    }
    if (el.id === 'draft') {
        const n = currentNode(); if (n) { ui.drafts[n.id] = el.value; draftRevision++; saveDrafts(); const count = root.querySelector('#reply-count'); if (count) count.textContent = `${el.value.length} / ${n.freeInput?.maxLength}`; }
    }
    if (el.id === 'polish-extra') polishExtra = el.value;
});
root.addEventListener('change', e => {
    const el = e.target as HTMLInputElement;
    if (el.id === 'intent') intent = el.value;
    if (el.id === 'polish-goal') polishGoal = el.value;
    if (el.id === 'polish-tone') polishTone = el.value;
    if (el.id === 'large-text') { audio.play('ui_click_b'); ui.largeText = el.checked; cache(); render(); }
});
function presentItem(id: string) {
    if (locked() || !actor || !engine.supportsEvidencePresentation(actor) || !engine.snapshot().evidence[id]) return;
    audio.play('evidence_present');
    selected = []; panel = ''; composeOpen = false;
    if (engine.tryPresentEvidence([id])) {
        replay = null; reading = null; evidenceReply = false; technicalError = '';
        toast(`已向${name(actor)}出示${chapter.evidence.find(e => e.id === id)?.title ?? '道具'}。`);
    } else evidenceReply = true;
}
let suppressEvidenceClickUntil = 0;
let evidenceDrag: { id: string; pointer: number; x: number; y: number; active: boolean; ghost: HTMLElement | null } | null = null;
function finishEvidenceDrag() {
    if (evidenceDrag?.active) suppressEvidenceClickUntil = performance.now() + 400;
    evidenceDrag?.ghost?.remove(); evidenceDrag = null;
    root.classList.remove('dragging-evidence');
    root.querySelectorAll('.evidence-drop-hover').forEach(el => el.classList.remove('evidence-drop-hover'));
}
function evidenceTarget(x: number, y: number): HTMLElement | null {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-evidence-target],.hotspot[data-action="person"]');
    const id = target?.dataset.evidenceTarget ?? target?.dataset.id;
    return target && id && !target.hasAttribute('disabled') && engine.supportsEvidencePresentation(id) ? target : null;
}
root.addEventListener('pointerdown', e => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-evidence-id]');
    if (!card || e.button !== 0 || locked() || (e.target as HTMLElement).closest('.evidence-select')) return;
    evidenceDrag = { id: card.dataset.evidenceId!, pointer: e.pointerId, x: e.clientX, y: e.clientY, active: false, ghost: null };
});
root.addEventListener('pointermove', e => {
    const drag = evidenceDrag;
    if (!drag || drag.pointer !== e.pointerId) return;
    if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
    if (!drag.active) {
        drag.active = true; root.setPointerCapture(e.pointerId); root.classList.add('dragging-evidence');
        drag.ghost = document.createElement('div'); drag.ghost.className = 'evidence-drag-ghost';
        drag.ghost.textContent = chapter.evidence.find(item => item.id === drag.id)?.title ?? '道具';
        document.body.append(drag.ghost);
    }
    e.preventDefault();
    drag.ghost!.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 16}px)`;
    root.querySelectorAll('.evidence-drop-hover').forEach(el => el.classList.remove('evidence-drop-hover'));
    evidenceTarget(e.clientX, e.clientY)?.classList.add('evidence-drop-hover');
});
root.addEventListener('pointerup', e => {
    const drag = evidenceDrag;
    if (!drag || drag.pointer !== e.pointerId) return;
    const target = drag.active ? evidenceTarget(e.clientX, e.clientY) : null;
    const recipient = target?.dataset.evidenceTarget ?? target?.dataset.id;
    finishEvidenceDrag();
    if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
    if (!recipient || locked()) return;
    try {
        if (actor !== recipient) selectPerson(recipient);
        presentItem(drag.id); sync(); render();
    } catch (err) { toast(err instanceof Error ? err.message : String(err)); render(); }
});
root.addEventListener('pointercancel', finishEvidenceDrag);
root.addEventListener('lostpointercapture', finishEvidenceDrag);
window.addEventListener('blur', finishEvidenceDrag);
document.addEventListener('keydown', e => { if (e.key === 'Escape') finishEvidenceDrag(); });
root.addEventListener('dragstart', e => { if ((e.target as HTMLElement).closest('[data-evidence-id]')) e.preventDefault(); });
let pointerStart: { x: number; y: number } | null = null, dragged = false, selectionStarted = false;
root.addEventListener('pointerdown', e => { pointerStart = { x: e.clientX, y: e.clientY }; dragged = false; selectionStarted = !!document.getSelection()?.toString(); });
root.addEventListener('pointerup', e => { dragged = !!pointerStart && Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 6; });
function canAdvance() { return !mainMenuView && !cinematicView && !campaignView && !panel && !engine.interactions().pending && !!(engine.currentLine() || replay || evidenceReply); }
// Video buttons handle their own bubbling; capture their clicks, but keep scrubbing silent.
root.addEventListener('click', e => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-cinema-action],button[data-cinema-rate]');
    if (button && !button.disabled) audio.play('ui_click_a');
}, { capture: true });
root.addEventListener('click', async e => {
    if (performance.now() < suppressEvidenceClickUntil) { e.preventDefault(); return; }
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el || el.hasAttribute('disabled')) {
        const target = e.target as HTMLElement;
        if (target.dataset.dismiss) { audio.play('panel_close'); panel = ''; selected = []; render(); return; }
        if (!el && target.closest('.dialogue') && !target.closest('button,a,input,textarea,select,label,[contenteditable],.scrim,.modal,.drawer,.communication-hints,[data-action]') && !dragged && !selectionStarted && !document.getSelection()?.toString() && !composeOpen && !panel) {
            if (isWeiInput(currentNode()) && engine.interactions().freeInput) { composeOpen = true; render(); root.querySelector<HTMLTextAreaElement>('#draft')?.focus(); }
            else if (canAdvance()) { nextLine(); render(); }
        }
        return;
    }
    const action = el.dataset.action!, id = el.dataset.id!;
    if (!(action === 'tab' && tab === id) && !(action === 'inspect-evidence' && previewEvidence === id)) audio.action(action);
    if (action === 'settings') { await openApiSettings(); return; }
    if (action === 'save-api-settings') { await saveApiSettings(); return; }
    if (['slot-save', 'slot-overwrite', 'slot-cancel', 'slot-load'].includes(action)) {
        try {
            const slot = Number(id);
            if (action === 'slot-cancel') overwriteSlot = null;
            else if (!MANUAL_SLOTS.some(value => value === slot)) return;
            else if (action === 'slot-load') {
                const key = slotKey(slot);
                if (!menuSave(key).valid) { toast('此存档暂时无法读取，原记录已保留。'); return; }
                const automatic = menuSave();
                if (automatic.exists && !automatic.valid) localStorage.setItem(`${KEY}:menu-backup:${Date.now()}`, JSON.stringify({ stored: localStorage.getItem(KEY), drafts: localStorage.getItem(KEY + ':drafts'), retry: localStorage.getItem(RETRY_KEY) }));
                if (!restore(key, false)) return;
                resetComposer(); resetCampaignView(); overwriteSlot = null;
                localStorage.removeItem(RETRY_KEY);
                // Restore exactly this slot's drafts, without mixing newer drafts
                // from a different save in the same loop.
                saveDrafts(); sync(); toast(`已读取手动存档 ${slot}。`);
            } else {
                if (!canSaveSlot()) { toast('请先读完当前连续剧情，再保存进度。'); return; }
                if (action === 'slot-save' && menuSave(slotKey(slot)).exists) overwriteSlot = slot;
                else {
                    if (action === 'slot-overwrite' && overwriteSlot !== slot) return;
                    saveSlot(slot); toast(`已保存到手动存档 ${slot}。`);
                }
            }
        } catch { toast('存档操作未完成，请检查本机存储空间；原存档仍保留。'); }
        render(); return;
    }
    if (['save', 'menu-load', 'close'].includes(action)) overwriteSlot = null;
    if (action === 'open-main-menu') { engine.cancelFreeInput(); resetComposer(); panel = ''; clearTimeout(rewindTimer); mainMenuView = true; render(); return; }
    if (mainMenuView) {
        try {
            if (action === 'menu-new') { if (menuSave().exists) { panel = 'menu-new-confirm'; render(); return; } }
            if (action === 'menu-new' || action === 'menu-start') {
                if (menuSave().valid) {
                    restore();
                    if (mandatoryEndingPending()) {
                        mainMenuView = false; homeView = false; localStorage.removeItem(HOME_KEY); campaignView = null;
                        sync(); render(); return;
                    }
                }
                else {
                    const raw = localStorage.getItem(KEY);
                    if (raw) localStorage.setItem(`${KEY}:menu-backup:${Date.now()}`, JSON.stringify({ stored: raw, drafts: localStorage.getItem(KEY + ':drafts'), retry: localStorage.getItem(RETRY_KEY) }));
                }
                reset(true); campaign = markPlayed(campaign, 'wuzhang'); persistCampaign(); render(); return;
            }
            if (action === 'menu-continue') {
                if (!menuSave().valid || !restore()) { toast('没有可读取的存档。'); return; }
                mainMenuView = false; homeView = false; localStorage.removeItem(HOME_KEY); campaignView = null;
                sync(); render(); return;
            }
            if (action === 'ending-collection') { openEndingAlbum(endingCatalog, endingCollection, { warning: endingWarning }); return; }
            if (['settings', 'menu-load'].includes(action)) panel = action;
            else if (action === 'close') panel = '';
            render(); return;
        } catch (err) { toast(err instanceof Error ? err.message : '操作未完成，原存档已保留。'); render(); return; }
    }
    // Opening or cancelling restart must not write a save or advance a segment.
    if (action === 'restart-confirm') { panel = action; render(); return; }
    if (action === 'close' && panel === 'restart-confirm') { panel = ''; render(); return; }
    if (action === 'show-hints') { hintsOpen = !hintsOpen; render(); return; }
    if (action === 'open-composer') { composeOpen = true; render(); root.querySelector<HTMLTextAreaElement>('#draft')?.focus(); return; }
    if (action === 'close-composer') { stopPolish(); polishStatus = ''; composeOpen = false; render(); root.querySelector<HTMLElement>('[data-action="open-composer"]')?.focus(); return; }
    if (action === 'reply-proof') { proofOpen = proofOpen === id ? '' : id; render(); return; }
    if (action === 'reply-clues') { cluesOpen = !cluesOpen; render(); return; }
    if (action === 'reply-clue') { const clue = memoryClues()[Number(id)]; if (clue) chosenClues = chosenClues.includes(clue) ? chosenClues.filter(c => c !== clue) : [...chosenClues, clue]; render(); return; }
    if (action === 'polish-goal' || action === 'polish-tone') {
        if (polishController || engine.interactions().pending) return;
        const value = (action === 'polish-goal' ? replyGoals : replyTones)[Number(id)];
        if (value) { if (action === 'polish-goal') polishGoal = value; else polishTone = value; render(); root.querySelector<HTMLElement>(`[data-action="${action}"][data-id="${id}"]`)?.focus(); }
        return;
    }
    if (action === 'reply-polish') { polishOpen = !polishOpen; render(); if (polishOpen) root.querySelector('#reply-polish-fields')?.scrollIntoView({ block: 'nearest' }); return; }
    if (action === 'reply-evidence') { panel = 'evidence'; tab = 'current'; evidenceMode = 'present'; selected = []; render(); return; }
    if (action === 'cancel-polish') { stopPolish(); polishStatus = '已取消生成，原稿保留。'; polishError = false; render(); return; }
    if (action === 'generate-polish') {
        const n = currentNode(); if (!isWeiInput(n) || !n?.freeInput || polishController || engine.interactions().pending) return;
        const controller = new AbortController(), key = composeKey, requestEngine = engine, revision = draftRevision;
        const draft = root.querySelector<HTMLTextAreaElement>('#draft')?.value ?? ui.drafts[n.id] ?? '';
        audio.play('submit');
        ui.drafts[n.id] = draft; saveDrafts(); polishController = controller; polishError = false; polishStatus = '正在根据目的、语气与补充信息生成对白……'; render();
        try {
            const generated = await polishReply(replyApi, { draft, goal: polishGoal, tone: polishTone, extra: polishExtra, clues: [...chosenClues], evidence: chapter.evidence.filter(e => engine.presentedEvidence().includes(e.id)), maxLength: n.freeInput.maxLength }, controller.signal);
            if (controller.signal.aborted || engine !== requestEngine || composeKey !== key || !composeOpen) return;
            if (draftRevision !== revision) { polishStatus = '你已修改原稿，本次润色未覆盖新文字。'; }
            else { audio.play('response_ready'); ui.drafts[n.id] = generated; draftRevision++; saveDrafts(); polishStatus = '已填入对白框，你可以继续修改。'; }
        } catch (error) {
            if (controller.signal.aborted || composeKey !== key || engine !== requestEngine) return;
            audio.play('ui_warning'); polishError = true; const message = error instanceof Error ? error.message : '';
            polishStatus = /429/.test(message) ? 'AI服务暂时限流（HTTP 429），原稿已保留。请稍后重试，或继续自行输入。' : /403/.test(message) ? 'AI服务拒绝了请求（HTTP 403），原稿已保留。请稍后重试，或继续自行输入。' : /超时/.test(message) ? 'AI生成超时，原稿已保留。请重试或继续自行输入。' : 'AI生成未完成，原稿已保留。请重试或继续自行输入。';
        } finally {
            if (polishController === controller) { polishController = null; render(); if (!polishError && draftRevision === revision + 1) root.querySelector<HTMLTextAreaElement>('#draft')?.focus(); else root.querySelector('.reply-polish-status')?.scrollIntoView({ block: 'nearest' }); }
        }
        return;
    }
    try {
        if (action === 'ending-collection') { openEndingAlbum(endingCatalog, endingCollection, { warning: endingWarning }); return; }
        if (action === 'continue-teaching') {
            if (!mandatoryEndingPending()) return;
            resetCampaignView(); engine.rewind(true); clearLoopUI();
            if (!engine.interactions().nodeId) selectPerson('player');
            sync(); render(); return;
        }
        // A pending teaching outcome must pass through its Continue transition.
        if (mandatoryEndingPending() && ['retry-ending', 'load-retry', 'restart-ending', 'return-home', 'new', 'rewind', 'rewind-confirm'].includes(action)) return;
        if (action === 'retry-ending') { panel = action; render(); return; }
        else if (action === 'load-retry') {
            if (!retrySave()) { toast('本轮没有可用的终局前存档。'); return; }
            if (!restore(RETRY_KEY, false)) return;
            localStorage.removeItem(KEY + ':drafts'); toast('已回到终局前的存档。');
        }
        else if (action === 'restart-ending') reset();
        else if (action === 'return-home') {
            panel = '';
            cinematicView = false; cinematicPlayer.dispose(); clearTimeout(rewindTimer);
            const s = engine.snapshot();
            if (s.flags['loop.result'] === 'safe' && campaign.presentation?.loopId === s.loopId && campaign.presentation.stage === 'ending') {
                homeView = false; localStorage.removeItem(HOME_KEY);
                advanceCampaign(); return;
            }
            homeView = true; localStorage.setItem(HOME_KEY, '1');
            mainMenuView = true; campaignView = null; mapNotice = ''; render(); return;
        }
        else if (action === 'show-map') { campaignView = 'map'; mapNotice = ''; }
        else if (action === 'return-game') { homeView = false; localStorage.removeItem(HOME_KEY); campaignView = null; mapNotice = ''; }
        else if (action === 'skip-ending' || action === 'open-campaign') { advanceCampaign(); return; }
        else if (action === 'play-ending') {
            const video = root.querySelector<HTMLVideoElement>('#ending-video');
            try { await video?.play(); } catch { const el = root.querySelector('#video-status'); if (el) el.textContent = '视频暂时无法播放，可以跳过继续。'; }
            return;
        }
        else if (action === 'map-level') {
            const level = levels.find(l => l.id === id);
            if (!level || !campaign.unlocked.includes(id)) return;
            if (level.implemented && mandatoryEndingPending()) { homeView = false; localStorage.removeItem(HOME_KEY); campaignView = null; }
            else if (level.implemented && !campaign.completed.includes(id)) {
                if (terminalReady()) reset();
                else { homeView = false; localStorage.removeItem(HOME_KEY); campaignView = null; }
            }
            else if (!level.implemented) {
                return;
            }
            else {
                resetCampaignView(); engine.cancelFreeInput();
                // Map replay skips teaching but obtains no information or permission from campaign progress.
                if (!engine.snapshot().flags['progress.tutorial_completed']) {
                    const fresh = new NarrativeEngine(chapter, manifest.contentVersion, gameJudge());
                    const saved = JSON.parse(fresh.save()); saved.flags['progress.tutorial_completed'] = true;
                    engine = fresh; engine.load(JSON.stringify(saved));
                }
                rewind(); campaign = markPlayed(campaign, id); persistCampaign();
            }
        }
        else if (action === 'scene') { engine.enterScene(id); actor = null; selected = []; intent = ''; technicalError = ''; replay = null; reading = null; evidenceReply = false; }
        else if (action === 'person') selectPerson(id);
        else if (action === 'topic') {
            const n = chapter.dialogues.find(n => n.id === id)!, old = readTopic(n);
            if (old) { replay = { lines: [...old.lines], index: 0 }; reading = null; }
            else startTopic(n);
            technicalError = '';
        }
        else if (action === 'next') nextLine();
        else if (action === 'skip') skipNarration();
        else if (action === 'back') leaveConversation();
        else if (action === 'choice') {
            const chosen = engine.choose(id, crypto.randomUUID()); responseLocked = chosen;
            if (chosen && id === 'scout.notice.leave') { sync(); leaveConversation(); responseLocked = false; }
        }
        else if (action === 'evidence' || action === 'browse-evidence') { panel = 'evidence'; tab = 'current'; evidenceMode = action === 'evidence' ? 'present' : 'browse'; selected = []; }
        else if (action === 'tab') { tab = id; const list = root.querySelector('.evidence-list'); if (list) list.scrollTop = 0; }
        else if (action === 'inspect-evidence') previewEvidence = id;
        else if (action === 'toggle-evidence') { selected = selected.includes(id) ? [] : [id]; previewEvidence = id; }
        else if (action === 'present-item') presentItem(id);
        else if (action === 'preset') {
            engine.presentEvidence(selected); const n = engine.interactions().topics.find(n => n.topicId === 'preset');
            if (!n) throw new Error('当前阶段没有预设交涉选项，请返回人物话题。');
            engine.openTopic(n.topicId, 'topic'); technicalError = '';
        }
        else if (action === 'starter') { const n = currentNode()!; ui.drafts[n.id] = n.freeInput!.starterText; }
        else if (action === 'submit') {
            const draft = document.querySelector<HTMLTextAreaElement>('#draft')!.value;
            if (!draft.trim()) { audio.play('ui_warning'); toast('先写下你的理由与接报安排。'); return; }
            audio.play('submit');
            technicalError = ''; ui.drafts[currentNode()!.id] = draft;
            const requestEngine = engine, requestLoop = engine.snapshot().loopId;
            saveDrafts(); const promise = engine.submitFreeInput(intent, engine.presentedEvidence(), draft); render();
            const result = await promise;
            if (engine !== requestEngine || engine.snapshot().loopId !== requestLoop || result.kind === 'stale') return;
            if (result.kind === 'technical_error') { audio.play('ui_warning'); technicalError = result.message; }
            else if (result.kind === 'judged') { composeOpen = false; audio.play('response_ready'); responseLocked = true; }
        }
        else if (action === 'cancel-response') { engine.cancelFreeInput(); technicalError = ''; toast('已取消等待，文字已保留。'); }
        else if (action === 'rewind') rewind();
        else if (action === 'rewind-confirm') { if (window.confirm('重新开始会清空本轮信息和草稿。现在重新调查？')) rewind(); }
        else if (action === 'close') { panel = ''; selected = []; }
        else if (action === 'connect') {
            panel = '';
            const node = chapter.dialogues.find(n => n.id === 'guard.connect_evidence')!;
            if (!evaluate(node.availableWhen, engine.snapshot(), { actorId: actor, evidenceIds: selected, intentId: null })) {
                toast(engine.snapshot().flags['loop.inferred_plan'] ? '本轮已想清接报办法，接下来去落实。' : '先在帐门查看告示、问清甲的规矩，再到营前追问营门是否失守。');
            } else { engine.enterScene('camp_gate'); selectPerson('guard'); startTopic(node); }
        }
        else if (['logic', 'help', 'records', 'save', 'settings', 'new-confirm'].includes(action)) panel = action;
        else if (action === 'new') reset();
        else if (action === 'save-now') { cache(); toast(saveWarning || '已保存当前进度。'); }
        else if (action === 'load') { restore(); toast('已恢复上一个完整交互。'); }
        sync(); render();
    } catch (err) { audio.play('ui_warning'); toast(err instanceof Error ? err.message : String(err)); render(); }
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && composeOpen && !panel) { audio.play('panel_close'); e.preventDefault(); stopPolish(); polishStatus = ''; composeOpen = false; render(); return; }
    if (e.key === 'Escape' && panel) { audio.play('panel_close'); e.preventDefault(); panel = ''; selected = []; render(); return; }
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes((e.target as HTMLElement).tagName)) return;
    if ([' ', 'Enter'].includes(e.key) && canAdvance()) { e.preventDefault(); if (!e.repeat) { nextLine(); render(); } }
});
if (!mainMenuView) {
    try { if (!restore()) { selectPerson('player'); sync(); } }
    catch (err) { toast(err instanceof Error ? err.message : '旧存档无法读取，已开启新进度。'); engine = new NarrativeEngine(chapter, manifest.contentVersion, gameJudge()); selectPerson('player'); sync(); }
    campaign = markPlayed(campaign, 'wuzhang'); persistCampaign(); syncCampaign();
}
render();
