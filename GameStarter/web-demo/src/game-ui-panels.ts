import type { RuntimeMode } from './runtime-mode';
import { readFilmAudio } from './film-audio';
/** 设置、存档与对话记录面板的 HTML 渲染。 */
export interface SettingsPanelProps {
    runtimeMode?: RuntimeMode;
    itemSystemEnabled?: boolean;
    music: number;
    sfx: number;
    aiVoiceEnabled: boolean;
    apiLoaded: boolean;
    apiSaving: boolean;
    apiDetailsOpen: boolean;
    apiConfig: { baseUrl: string; model: string; apiKey: string };
    apiStatus: string;
    initialSetup?: boolean;
    aiOnly?: boolean;
}

export interface SaveSlotProps {
    key: string;
    manualIndex?: string | number;
    exists: boolean;
    round?: number;
    chapterTitle?: string;
    sceneTitle?: string;
    sceneImage?: string;
    savedAt?: string | number;
    overwrite?: boolean;
    /** 存档无法读取时显示的原因。 */
    summary?: string;
}

export interface DialogueRecord { speaker: string; text: string }
export type ModalPage = 'settings' | 'saves' | 'history' | 'new' | 'supplies' | 'items' | 'pause';

function esc(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

function action(name: string, text: string, primary = false, disabled = false): string {
    return `<button type="button" class="${primary ? 'folio-button' : 'quiet-button'}" data-action="${esc(name)}"${disabled ? ' disabled' : ''}>${esc(text)}</button>`;
}

function help(text: string, label: string, id = ''): string {
    return `<details class="settings-help"><summary aria-label="${esc(label)}说明">?</summary><div${id ? ` id="${esc(id)}"` : ''}>${esc(text)}</div></details>`;
}

export function settingsPanelHTML(props: SettingsPanelProps): string {
    if (props.aiOnly) return apiSettingsHTML(props);
    const itemsEnabled = props.itemSystemEnabled !== false;
    const ranges = (['music', 'sfx', 'film'] as const).map(bus => {
        const setting = bus === 'film' ? readFilmAudio().volume : props[bus];
        const value = Number.isFinite(setting) ? Math.min(100, Math.max(0, setting)) : 0;
        return `<label class="setting-row"><span class="setting-name">${bus === 'music' ? '背景音乐' : bus === 'film' ? '影片声音' : '交互音效'}</span><span class="range-control"><input type="range" min="0" max="100" value="${value}" data-volume="${bus}"><output>${value}%</output></span></label>`;
    }).join('');
    return `<div class="settings-layout">${props.initialSetup ? '<section class="settings-section ai-setup-intro"><h2>选择 AI 体验</h2><p>配置 AI 后可自由发言和追问；暂不配置也能开始第一章。夷陵的自由问讯和军令核对需要 AI。</p><button type="button" class="quiet-button" data-action="close-modal">暂不配置，继续游戏</button></section>' : ''}
      <section class="settings-section"><h2>游戏模式</h2>
        <label class="toggle-row" for="game-ai-enabled"><span>启用 AI</span><input id="game-ai-enabled" class="motion-switch" type="checkbox"${props.runtimeMode && props.runtimeMode !== 'offline' ? ' checked' : ''}></label>
        ${apiSettingsHTML(props)}
        <div class="toggle-row"><div class="setting-label"><label for="game-item-system-enabled">物品</label>${help('开启后可获取和查看剧情物品；关闭后保留已有物品记录。', '物品', 'item-system-description')}</div><input id="game-item-system-enabled" class="motion-switch" type="checkbox" aria-describedby="item-system-description"${itemsEnabled ? ' checked' : ''}></div>
      </section>
      <section class="settings-section"><h2>声音与阅读</h2>${ranges}
        <div class="toggle-row"><div class="setting-label"><label for="ai-voice-enabled">AI语音</label>${help('开启后朗读我与魏延的交谈；关闭后保留文字对白，点击继续。', 'AI语音', 'ai-voice-description')}</div><input id="ai-voice-enabled" class="motion-switch" type="checkbox" aria-describedby="ai-voice-description"${props.aiVoiceEnabled ? ' checked' : ''}${props.runtimeMode === 'offline' ? ' disabled' : ''}></div>
        <p><a href="/voice-demo.html" target="_blank" rel="noopener">实时配音：配置音色与试听 ↗</a></p>
      </section>
    </div>`;
}

function apiSettingsHTML(props: SettingsPanelProps): string {
    const disabled = !props.apiLoaded || props.apiSaving ? ' disabled' : '';
    return `<details id="api-settings" class="service-settings"${props.apiDetailsOpen ? ' open' : ''}>
        <summary>AI Token 与模型配置</summary>
        <div class="settings-help-line"><span>AI 配置说明</span>${help('填写服务商提供的 API 地址、模型名和 Token（API Key），即可使用自由发言、角色回应、润色与追问。', 'AI 配置')}</div>
        <div class="service-fields">
          <label for="api-base">API 地址<input id="api-base"${disabled} value="${esc(props.apiConfig.baseUrl)}" placeholder="https://api.openai.com/v1" spellcheck="false"></label>
          <label for="api-model">模型<input id="api-model"${disabled} value="${esc(props.apiConfig.model)}" spellcheck="false"></label>
          <label for="api-key">AI Token（API Key）<input id="api-key"${disabled} type="password" autocomplete="off" value="${esc(props.apiConfig.apiKey)}" spellcheck="false"></label>
          <div class="button-row">${action('save-api', props.apiSaving ? '正在保存……' : '保存配置', true, props.apiSaving || !props.apiLoaded)}${action('test-api', '保存并测试连接', false, props.apiSaving || !props.apiLoaded)}${action('settings', '重新读取', false, props.apiSaving)}</div>
        </div>
        <p id="api-status" role="status" aria-live="polite">${esc(props.apiStatus)}</p>
      </details>`;
}

const emptyCover = '<span class="save-empty-mark" aria-hidden="true"><svg viewBox="0 0 80 80"><path d="M20 18h40v44H20zM28 18v44M36 30h16M36 39h16M36 48h10"/></svg></span>';

function savedTime(value: string | number | undefined): string {
    if (value === undefined || value === '') return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : `<time datetime="${esc(date.toISOString())}">${esc(date.toLocaleString('zh-CN'))}</time>`;
}

export function savePanelHTML(slots: readonly SaveSlotProps[], options: { canStore?: boolean } = {}): string {
    return `<div class="save-grid">${slots.map(slot => {
        const manual = slot.manualIndex !== undefined;
        const name = manual ? `手动存档 ${slot.manualIndex}` : '自动存档';
        const experience = slot.chapterTitle ?? (slot.round === undefined ? '这一夜' : `第${slot.round === 1 ? '一' : slot.round === 2 ? '二' : slot.round}次经历`);
        const cover = slot.exists && slot.sceneImage ? `<img src="${esc(slot.sceneImage)}" alt="${esc(slot.sceneTitle || '存档场景')}" loading="lazy">` : emptyCover;
        const save = manual && options.canStore !== false ? `<button type="button" class="folio-button${slot.overwrite ? ' is-confirming' : ''}" data-store-slot="${esc(slot.manualIndex)}" aria-label="${esc(`${slot.overwrite ? '确认覆盖' : '保存到'}${name}`)}">${slot.overwrite ? '确认覆盖' : '保存'}</button>` : '';
        const load = manual ? `<button type="button" class="quiet-button" data-load-slot="${esc(slot.manualIndex)}" aria-label="${esc(`读取${name}`)}"${slot.exists ? '' : ' disabled'}>读取</button>` : action('load-auto', '读取', false, !slot.exists);
        return `<article class="save-leaf${slot.exists ? '' : ' is-empty'}" data-save-key="${esc(slot.key)}" aria-label="${esc(name)}">
          <div class="save-cover">${cover}<span class="save-badge" aria-hidden="true">${manual ? esc(slot.manualIndex) : '自'}</span></div>
          <div class="save-content"><p class="save-kind">${esc(name)}</p><h2>${esc(slot.exists ? experience : '尚未留下进度')}</h2>
            ${slot.exists ? `<p class="save-location">${esc(slot.summary || slot.sceneTitle || '这一夜')}</p>${savedTime(slot.savedAt)}` : ''}
          </div><div class="save-actions">${save}${load}</div>
        </article>`;
    }).join('')}</div>`;
}

export function recordsPanelHTML(records: readonly DialogueRecord[]): string {
    const readable = records.filter(record => record.text.trim());
    return readable.length ? `<div class="history-scroll"><ol class="dialogue-stream">${readable.map(record => `<li><span class="history-mark" aria-hidden="true"></span><div class="history-content"><small>${esc(record.speaker)}</small><p>${esc(record.text)}</p></div></li>`).join('')}</ol></div>` : '<p class="panel-empty">暂无对白记录。</p>';
}

export function newGamePanelHTML(): string {
    return `<div class="newgame-confirmation"><h2 class="newgame-question">重新走进这一夜？</h2><p>从第一章重新开始，后续章节需要再次逐章通关解锁；夷陵仍可抢先体验。当前各章自动进度会备份，手动存档与已获得成就保留。</p><div class="button-row">${action('new-confirmed', '开始新的经历 →', true)}${action('close-modal', '返回')}</div></div>`;
}

/** Body must be renderer-produced markup. All display titles and props are escaped separately. */
export function frameModal(title: string, body: string, page: ModalPage = 'settings'): string {
    return `<div class="game-modal-shade"><section class="game-modal xuan-panel" data-page="${esc(page)}" role="dialog" aria-modal="true" aria-labelledby="game-panel-title">
      <header class="folio-header"><span class="folio-emblem" aria-hidden="true"></span><h1 id="game-panel-title">${esc(title)}</h1><button type="button" class="modal-close" data-action="close-modal" aria-label="关闭"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
      <div class="folio-body">${body}</div>
    </section></div>`;
}
