import { ChapterSession, type GameSessionState } from './chapter-session';
import type { ChapterFlow } from '../../../content/schema/chapter-session';
import { currentClueSources, clueSources, type ChapterReview } from './thought-canvas-model';
import { thoughtLabels, thoughtInsights } from './thought-workspace';

// Isolated review entry. No game.ts, player storage, audio playback or API settings service.
const root = document.querySelector<HTMLElement>('#suite-stage')!;
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const read = async <T>(url: string): Promise<T> => { const response = await fetch(url); if (!response.ok) throw new Error(`设计资料读取失败：${url}`); return response.json(); };
const [script, flow, manifest, media, samples] = await Promise.all([
    read<ChapterReview>('/story/chapter-one.script.json'), read<ChapterFlow>('/story/chapter-one.flow.json'),
    read<{ contentVersion: string }>('/story/session-manifest.json'), read<{ scenes: Record<string, string> }>('/media/manifest.json'),
    read<{ contentVersion: string; stages: Record<string, GameSessionState> }>('/art-review/thought-options-states.json'),
]);
if (samples.contentVersion !== manifest.contentVersion) throw new Error('设计样本的剧情版本已变化，请重新生成。');
const game = new ChapterSession(script, flow, manifest.contentVersion);
game.restore(JSON.stringify(samples.stages.developed));
const params = new URLSearchParams(location.search);
const pages: Record<string, { title: string; overline: string }> = {
    settings: { title: '设置', overline: '声息与阅读' }, saves: { title: '存档', overline: '这一夜的留痕' },
    history: { title: '历史对白', overline: '听过的话' }, thought: { title: '思绪', overline: '见闻与判断' },
};
let theme = params.get('theme') === 'light' ? 'light' : 'dark';
let page = Object.hasOwn(pages, params.get('page') ?? '') ? params.get('page')! : 'settings';
let closed = false, detail = '', confirmation = '', toastTimer = 0, reduced = false;
const sound = { music: 60, sfx: 85 }, strength: Record<string, number> = { dark: 36, light: 22 };
const slots = [
    { kind: '自动存档', title: '再临五丈原', scene: 'report_post', location: '军报处', time: '2026.10.22 · 21:46', badge: '自' },
    { kind: '手动存档 · 壹', title: '再临五丈原', scene: 'camp_gate', location: '中军帐前', time: '2026.10.22 · 21:32', badge: '壹' },
    { kind: '手动存档 · 贰', title: '', scene: '', location: '', time: '', badge: '贰' },
];
const closeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
const label = (id: string) => thoughtLabels[id] ?? id;
const person = (name: string) => name.startsWith('主角') ? (name.includes('心声') ? '你 · 心声' : '你') : name.startsWith('乙') ? '传令兵' : name.startsWith('甲') ? '守卫' : name.split('·')[0];

function settingsHTML() {
    return `<div class="settings-layout"><section class="settings-section"><h2>声音</h2>${(['music', 'sfx'] as const).map(bus => `<label class="setting-row"><span class="setting-name">${bus === 'music' ? '背景音乐' : '交互音效'}</span><span class="range-control"><input data-volume="${bus}" type="range" min="0" max="100" value="${sound[bus]}" style="--range:${sound[bus]}%"><output>${sound[bus]}%</output></span></label>`).join('')}</section><section class="settings-section"><h2>阅读</h2><div class="toggle-row"><span id="motion-label">减少动态效果</span><button class="switch" role="switch" aria-checked="${reduced}" aria-labelledby="motion-label" data-action="motion"></button></div></section><details class="service-settings"><summary>自由表达服务</summary><div class="service-fields"><label>API 地址<input type="url" autocomplete="off" placeholder="https://api.openai.com/v1" aria-label="API 地址"></label><label>模型<input autocomplete="off" placeholder="输入模型名称" aria-label="模型"></label><label>API Key<input type="password" autocomplete="off" placeholder="输入密钥" aria-label="API Key"></label><div class="button-row"><button class="folio-button" data-action="service">保存配置</button><button class="quiet-button" data-action="service">保存并测试连接</button><button class="quiet-button" data-action="service">重新读取</button></div></div></details></div>`;
}
function savesHTML() {
    return `<div class="save-grid">${slots.map((slot, i) => `<article class="save-leaf ${slot.scene ? '' : 'is-empty'}"><div class="save-cover">${slot.scene ? `<img src="${media.scenes[slot.scene]}" alt="${slot.location}">` : '<div class="save-empty-mark" aria-hidden="true"><svg viewBox="0 0 90 90"><path d="M22 18h46v54H22zM27 23h36v44H27zM37 33h16M37 45h16M37 57h16M17 27h10M17 45h10M17 63h10"/></svg></div>'}<span class="save-badge">${slot.badge}</span></div><div class="save-content"><p class="save-kind">${slot.kind}</p><h2>${slot.title || '尚未留痕'}</h2><p class="save-location">${slot.location || '可在此留存进度'}</p>${slot.time ? `<time>${slot.time}</time>` : ''}</div><div class="save-actions">${slot.scene ? `<button class="folio-button" data-load="${i}">读取</button>` : ''}${i > 0 ? `<button class="${slot.scene ? 'quiet-button' : 'folio-button'}" data-save="${i}">${slot.scene ? '覆盖' : '留存此刻'}</button>` : ''}</div></article>`).join('')}</div>`;
}
function historyHTML() {
    const state = samples.stages.developed;
    const rows = state.story.completed.map(id => game.sourceRow(id)).filter((row): row is NonNullable<typeof row> => !!row && /^D\d/.test(row.id));
    const groups: { speaker: string; texts: string[]; id: string }[] = [];
    rows.forEach(row => { const last = groups.at(-1); if (last?.speaker === row.speaker) last.texts.push(row.text); else groups.push({ speaker: row.speaker, texts: [row.text], id: row.id }); });
    return `<div class="history-tools"><span class="history-chapter">五丈原 · 军报处</span><button class="quiet-button" data-action="latest">回到最近 ↓</button></div><div class="history-scroll" tabindex="0" aria-label="已听过的对白"><ol class="dialogue-stream">${groups.map(group => `<li data-row="${group.id}" data-self="${group.speaker.startsWith('主角')}"><span class="history-mark" aria-hidden="true"></span><div class="history-content"><small>${esc(person(group.speaker))}</small>${group.texts.map(text => `<p>${esc(text)}</p>`).join('')}</div></li>`).join('')}</ol></div>`;
}
function sourceHTML(id: string) {
    const graph = game.graph(), state = game.snapshot();
    if (graph[id]) return `<p>${esc(thoughtInsights[id] ?? graph[id].full)}</p><div class="source-links">${graph[id].evidence.map(key => `<button class="quiet-button" data-source="${key}">${esc(label(key))} ↗</button>`).join('')}</div>`;
    return currentClueSources(id, state.story.completed).map(key => { const row = game.sourceRow(key)!; return `<blockquote>${esc(row.text)}<small>${esc(person(row.speaker))}</small></blockquote>`; }).join('');
}
function thoughtHTML() {
    const state = game.snapshot(), graph = game.graph();
    const records = state.thinking?.history ?? [], ids = [...new Set(records.flatMap(record => record.outputs.flatMap(out => [...out.used, out.id])))];
    return `<div class="mind-heading"><span>${state.story.collected.length} 条见闻</span><button class="quiet-button" data-action="inventory">全部见闻 ↗</button></div><div class="mind-map"><svg class="mind-links" aria-hidden="true"></svg>${ids.map(id => `<button class="mind-node" data-node="${id}" data-source="${id}" data-kind="${graph[id] ? 'insight' : 'clue'}"><small>${graph[id] ? '认识' : '见闻'}</small><span>${esc(label(id))}</span></button>`).join('')}</div><div class="mind-summary"><p>${esc(state.thinking?.feedback || thoughtInsights[records.at(-1)?.outputs.at(-1)?.id ?? 'R01'])}</p><button class="quiet-button" data-action="undo" ${records.length ? '' : 'disabled'}>撤回</button></div><div class="mind-workbench"><div class="mind-selection">${(state.thinking?.placed ?? []).map(id => `<button class="selected-note" data-unplace="${id}" aria-label="移出${esc(label(id))}">${esc(label(id))}<span aria-hidden="true"> ×</span></button>`).join('')}<button class="quiet-button" data-action="inventory" aria-label="补充见闻">＋</button></div><button class="folio-button" data-action="think">想一想</button></div>${detail ? detailHTML(detail) : ''}`;
}
function detailHTML(id: string) {
    const state = game.snapshot(), inventory = id === 'inventory';
    return `<aside class="mind-detail" aria-label="${inventory ? '全部见闻' : esc(label(id))}"><header class="mind-detail-header"><h2>${inventory ? '见闻' : esc(label(id))}</h2><button class="quiet-button" data-action="close-detail" aria-label="关闭见闻">收起 ×</button></header>${inventory ? `<div class="mind-inventory">${state.story.collected.map(key => `<div class="inventory-item"><button data-source="${key}">${esc(label(key))}<small>查看原话</small></button><button class="quiet-button" data-place="${key}" ${state.thinking?.placed.includes(key) ? 'disabled' : ''}>${state.thinking?.placed.includes(key) ? '已添入' : '添入'}</button></div>`).join('')}</div>` : `${sourceHTML(id)}<button class="folio-button" data-place="${id}" ${state.thinking?.placed.includes(id) ? 'disabled' : ''}>${state.thinking?.placed.includes(id) ? '已在思绪中' : '添入思绪'}</button>`}</aside>`;
}
function confirmationHTML() {
    const [action, index] = confirmation.split(':'), slot = slots[Number(index)];
    return `<div class="confirmation" role="alertdialog" aria-label="${action === 'load' ? '读取存档' : '覆盖存档'}"><h2>${action === 'load' ? '回到这一刻？' : '覆盖这道留痕？'}</h2><p>${esc(slot.title)} · ${esc(slot.location)}<br><small>${slot.time}</small></p><div class="button-row"><button class="quiet-button" data-action="cancel">返回</button><button class="folio-button" data-action="confirm">${action === 'load' ? '读取' : '确认覆盖'}</button></div></div>`;
}
function updateControls() {
    document.body.dataset.suite = theme;
    document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === theme)));
    document.querySelectorAll<HTMLButtonElement>('.suite-controls [data-page]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.page === page)));
    (document.querySelector('#scene-strength') as HTMLInputElement).value = String(strength[theme]);
    document.querySelector('.scene-strength output')!.textContent = `${strength[theme]}%`;
    root.style.setProperty('--scene-alpha', String(strength[theme] / 100));
    const next = new URL(location.href); next.searchParams.set('theme', theme); next.searchParams.set('page', page); history.replaceState(null, '', next);
}
function render() {
    document.querySelector('#suite-status')?.classList.remove('visible');
    const historyScroll = root.querySelector('.history-scroll')?.scrollTop;
    root.innerHTML = `<div class="suite-landscape" style="background-image:url('${media.scenes.camp_gate}')"></div><div class="suite-environment"></div><div class="suite-brand" aria-hidden="true"><span>壹</span><strong>逆转五丈原</strong></div>${closed ? '<button class="folio-button reopen-button" data-action="reopen">返回弹窗</button>' : `<div class="folio-shade"><section class="folio-dialog" data-page="${page}" role="dialog" aria-modal="false" aria-labelledby="folio-title"><header class="folio-header"><span class="folio-emblem" aria-hidden="true"></span><div><h1 id="folio-title">${pages[page].title}</h1></div><button class="folio-close" data-action="close" aria-label="关闭弹窗">${closeIcon}</button></header><div class="folio-body">${page === 'settings' ? settingsHTML() : page === 'saves' ? savesHTML() : page === 'history' ? historyHTML() : thoughtHTML()}${confirmation ? confirmationHTML() : ''}</div></section></div>`}`;
    updateControls();
    if (page === 'history') {
        const scroll = root.querySelector<HTMLElement>('.history-scroll');
        if (scroll) { if (historyScroll != null) scroll.scrollTop = historyScroll; else { const target = scroll.querySelector<HTMLElement>('[data-row=D14]'); if (target) scroll.scrollTop = target.offsetTop - 4; } }
    }
    requestAnimationFrame(drawCurves);
}
function drawCurves() {
    const host = root.querySelector<HTMLElement>('.mind-map'), svg = host?.querySelector<SVGSVGElement>('svg'); if (!host || !svg) return;
    const bounds = host.getBoundingClientRect(), paths: string[] = []; svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    game.snapshot().thinking?.history.forEach(record => record.outputs.forEach(out => out.used.forEach(id => {
        const from = host.querySelector<HTMLElement>(`[data-node="${id}"]`), to = host.querySelector<HTMLElement>(`[data-node="${out.id}"]`); if (!from || !to) return;
        const a = from.getBoundingClientRect(), b = to.getBoundingClientRect(), horizontal = b.left >= a.right - 3;
        const x = (horizontal ? a.right : a.left + a.width / 2) - bounds.left, y = (horizontal ? a.top + a.height / 2 : a.bottom) - bounds.top;
        const tx = (horizontal ? b.left : b.left + b.width / 2) - bounds.left, ty = (horizontal ? b.top + b.height / 2 : b.top) - bounds.top;
        const dx = horizontal ? Math.max(30, (tx - x) * .5) : 0, dy = horizontal ? 0 : Math.max(18, Math.abs(ty - y) * .5);
        paths.push(`<path data-from="${id}" data-to="${out.id}" d="M${x},${y} C${x + dx},${y + dy} ${tx - dx},${ty - dy} ${tx},${ty}"/><circle cx="${x}" cy="${y}" r="2"/>`);
    })));
    svg.innerHTML = paths.join('');
}
function toast(message: string) { const target = document.querySelector<HTMLElement>('#suite-status')!; clearTimeout(toastTimer); target.textContent = message; target.classList.add('visible'); toastTimer = window.setTimeout(() => target.classList.remove('visible'), 2600); }
function focusDetail() { root.querySelector<HTMLElement>('[data-action=close-detail]')?.focus(); }
function saveSlot(index: number) { slots[index] = { ...slots[index], title: '再临五丈原', scene: 'report_post', location: '军报处', time: '2026.10.22 · 21:46' }; confirmation = ''; render(); root.querySelector<HTMLElement>(`[data-save="${index}"]`)?.focus(); toast('已更新这个预览档位；游戏存档未改动。'); }
root.addEventListener('input', event => { const input = event.target as HTMLInputElement; if (input.dataset.volume) { const bus = input.dataset.volume as keyof typeof sound; sound[bus] = Number(input.value); input.style.setProperty('--range', `${input.value}%`); input.nextElementSibling!.textContent = `${input.value}%`; } });
root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return;
    if (button.dataset.source) { detail = button.dataset.source; render(); focusDetail(); return; }
    if (button.dataset.place) { game.placeThought(button.dataset.place); detail = ''; render(); root.querySelector<HTMLElement>('[data-action=think]')?.focus(); return; }
    if (button.dataset.unplace) { game.removeThought(button.dataset.unplace); render(); return; }
    if (button.dataset.load) { confirmation = `load:${button.dataset.load}`; render(); root.querySelector<HTMLElement>('[data-action=cancel]')?.focus(); return; }
    if (button.dataset.save) { const index = Number(button.dataset.save); if (!slots[index].scene) saveSlot(index); else { confirmation = `save:${index}`; render(); root.querySelector<HTMLElement>('[data-action=cancel]')?.focus(); } return; }
    const action = button.dataset.action;
    if (action === 'motion') { reduced = !reduced; button.setAttribute('aria-checked', String(reduced)); }
    if (action === 'service') toast('此处仅展示控件，不保存密钥或发起连接。');
    if (action === 'close') { closed = true; render(); root.querySelector<HTMLElement>('[data-action=reopen]')?.focus(); }
    if (action === 'reopen') { closed = false; render(); root.querySelector<HTMLElement>('.folio-close')?.focus(); }
    if (action === 'latest') { const scroll = root.querySelector('.history-scroll')!; scroll.scrollTop = scroll.scrollHeight; }
    if (action === 'inventory') { detail = 'inventory'; render(); focusDetail(); }
    if (action === 'close-detail') { detail = ''; render(); root.querySelector<HTMLElement>('[data-action=inventory]')?.focus(); }
    if (action === 'think') { game.think(); render(); root.querySelector<HTMLElement>('[data-action=think]')?.focus(); }
    if (action === 'undo') { game.reviseThought(); render(); root.querySelector<HTMLElement>('[data-action=think]')?.focus(); }
    if (action === 'cancel') { confirmation = ''; render(); root.querySelector<HTMLElement>('.save-actions button')?.focus(); }
    if (action === 'confirm') { const [verb, index] = confirmation.split(':'); if (verb === 'save') saveSlot(Number(index)); else { confirmation = ''; render(); toast('已演示读取操作；正式游戏进度未改动。'); } }
});
root.addEventListener('pointerover', event => { const node = (event.target as HTMLElement).closest<HTMLElement>('[data-node]'); root.querySelectorAll<SVGPathElement>('.mind-links path').forEach(path => { const related = !!node && [path.dataset.from, path.dataset.to].includes(node.dataset.node); path.classList.toggle('is-related', related); path.classList.toggle('is-unrelated', !!node && !related); }); });
document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach(button => button.addEventListener('click', () => { theme = button.dataset.theme!; updateControls(); }));
document.querySelectorAll<HTMLButtonElement>('.suite-controls [data-page]').forEach(button => button.addEventListener('click', () => { page = button.dataset.page!; closed = false; detail = ''; confirmation = ''; render(); }));
document.querySelector('#scene-strength')!.addEventListener('input', event => { strength[theme] = Number((event.target as HTMLInputElement).value); updateControls(); });
const focusMode = (value: boolean) => { document.body.classList.toggle('suite-focus', value); (document.querySelector('#suite-unfocus') as HTMLElement).hidden = !value; requestAnimationFrame(drawCurves); };
document.querySelector('#suite-focus')!.addEventListener('click', () => focusMode(true));
document.querySelector('#suite-unfocus')!.addEventListener('click', () => focusMode(false));
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (confirmation || detail) { confirmation = ''; detail = ''; render(); root.querySelector<HTMLElement>('.folio-close')?.focus(); }
    else if (document.body.classList.contains('suite-focus')) focusMode(false);
    else if (!closed) { closed = true; render(); root.querySelector<HTMLElement>('[data-action=reopen]')?.focus(); }
});
const resize = new ResizeObserver(drawCurves); resize.observe(root);
document.fonts.ready.then(drawCurves); render();
