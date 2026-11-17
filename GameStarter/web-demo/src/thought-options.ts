import { ChapterSession, type GameSessionState } from './chapter-session';
import type { ChapterFlow } from '../../../content/schema/chapter-session';
import { currentClueSources, clueSources, type ChapterReview } from './thought-canvas-model';
import { thoughtLabels } from './thought-workspace';
import { inventoryHTML, reasoningHTML, type ThoughtView } from './thought-workspace-view';

// This entry owns an in-memory session only. It neither imports game.ts nor reads/writes player storage.
const root = document.querySelector<HTMLElement>('#game-root')!;
const esc = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const read = async <T>(url: string): Promise<T> => { const response = await fetch(url); if (!response.ok) throw new Error(`无法读取设计资料：${url}`); return response.json(); };
const [script, flow, manifest, media, samples] = await Promise.all([
    read<ChapterReview>('/story/chapter-one.script.json'), read<ChapterFlow>('/story/chapter-one.flow.json'),
    read<{ contentVersion: string }>('/story/session-manifest.json'), read<{ scenes: Record<string, string> }>('/media/manifest.json'),
    read<{ contentVersion: string; stages: Record<string, GameSessionState> }>('/art-review/thought-options-states.json'),
]);
if (samples.contentVersion !== manifest.contentVersion) throw new Error('策划内容已变化，请重新生成思绪设计样本。');
const game = new ChapterSession(script, flow, manifest.contentVersion);
const params = new URLSearchParams(location.search);
let theme = ['mist', 'silk', 'night'].includes(params.get('theme') ?? '') ? params.get('theme')! : 'mist';
let stage = Object.hasOwn(samples.stages, params.get('stage') ?? '') ? params.get('stage')! : 'developed';
let inventoryOpen = params.get('drawer') === 'open', detail = '', toastTimer = 0, resizeFrame = 0;
const visibility: Record<string, number> = { mist: 24, silk: 39, night: 86 };
const label = (id: string) => thoughtLabels[id] ?? id;
function source(id: string) {
    const state = game.snapshot(), derived = game.graph()[id];
    if (derived) return `<p>${esc(derived.full)}</p><div class="source-links">${derived.evidence.map(key => `<button data-read-note="${key}">${esc(label(key))} ↗</button>`).join('')}</div>`;
    return currentClueSources(id, state.story.completed).map(key => {
        const row = game.sourceRow(key)!;
        return `<blockquote>${esc(row.text)}<small>${esc(row.speaker)}</small></blockquote>`;
    }).join('') + `<p class="source-boundary">${esc(script.clues.find(clue => clue.id === id)?.boundary)}</p>`;
}
function view(): ThoughtView { return { inventoryOpen, detail, revealAt: 0, reduced: true, source }; }
function toast(text: string) {
    const target = document.querySelector<HTMLElement>('#design-toast')!;
    target.textContent = text; target.classList.add('is-visible'); clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => target.classList.remove('is-visible'), 2600);
}
function updateControls() {
    document.body.dataset.thoughtTheme = theme;
    document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === theme)));
    (document.querySelector('#design-stage') as HTMLSelectElement).value = stage;
    (document.querySelector('#design-transparency') as HTMLInputElement).value = String(visibility[theme]);
    (document.querySelector('#design-transparency-value') as HTMLOutputElement).value = `${visibility[theme]}%`;
    const landscape = root.querySelector<HTMLElement>('.thought-landscape'); if (landscape) landscape.style.opacity = String(visibility[theme] / 100);
    const next = new URL(location.href); next.searchParams.set('theme', theme); next.searchParams.set('stage', stage);
    history.replaceState(null, '', next);
}
const resize = new ResizeObserver(() => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(drawCurves); });
function render(resetScroll = false) {
    const scroll = resetScroll ? 0 : root.querySelector('.workspace-layout')?.scrollTop ?? 0;
    const inventoryScroll = root.querySelector('.inventory-scroll')?.scrollTop ?? 0;
    const state = game.snapshot(), graph = game.graph();
    resize.disconnect();
    root.innerHTML = `<main class="thought-screen workspace-screen ${inventoryOpen ? 'inventory-open' : ''}" data-phase="thoughts"><div class="thought-landscape" style="background-image:url('${media.scenes[state.scene]}')"></div><div class="paper-atmosphere"></div><header class="game-hud light-hud"><div class="game-mark"><span class="chapter-seal">壹</span><div>逆转五丈原<small>五丈原 · 再临第六夜</small></div></div><nav aria-label="思绪导航"><button data-action="notes-list">思绪 <small>${state.story.collected.length}</small></button><button data-action="close-notes">回到此刻</button></nav></header>${inventoryHTML(state, graph, view())}${reasoningHTML(state, graph, view())}</main>`;
    root.querySelectorAll<HTMLElement>('[data-thought-result]').forEach(node => {
        node.setAttribute('role', 'button'); node.tabIndex = 0;
        node.setAttribute('aria-label', `查看“${label(node.dataset.thoughtResult!)}”的依据`);
    });
    root.querySelectorAll<HTMLElement>('[data-inventory-drag]').forEach(node => { node.draggable = true; });
    const canvas = root.querySelector<HTMLElement>('.workspace-layout')!; canvas.scrollTop = scroll;
    root.querySelector<HTMLElement>('.thought-landscape')!.style.opacity = String(visibility[theme] / 100);
    const list = root.querySelector<HTMLElement>('.inventory-scroll'); if (list) list.scrollTop = inventoryScroll;
    resize.observe(root.querySelector('.reasoning-timeline')!); requestAnimationFrame(drawCurves);
}
function drawCurves() {
    const host = root.querySelector<HTMLElement>('.reasoning-timeline'), svg = host?.querySelector<SVGSVGElement>('.reasoning-curves');
    if (!host || !svg) return;
    const box = host.getBoundingClientRect(), paths: string[] = [];
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const connect = (from: HTMLElement, to: HTMLElement, fromId: string, toId: string, continuation = false) => {
        const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
        const horizontal = !continuation && theme === 'silk' && innerWidth > 900 && b.left >= a.right - 15;
        const x = (horizontal ? a.right : a.left + a.width / 2) - box.left;
        const y = (horizontal ? a.top + a.height / 2 : a.bottom) - box.top;
        const tx = (horizontal ? b.left : b.left + b.width / 2) - box.left;
        const ty = (horizontal ? b.top + b.height / 2 : b.top) - box.top;
        const bend = horizontal ? Math.max(30, (tx - x) * .56) : Math.max(24, Math.abs(ty - y) * .5);
        const sway = !horizontal && Math.abs(tx - x) < 18 ? 24 : 0;
        const d = horizontal ? `M${x},${y} C${x + bend},${y} ${tx - bend},${ty} ${tx},${ty}` : `M${x},${y} C${x + sway},${y + bend} ${tx - sway},${ty - bend} ${tx},${ty}`;
        paths.push(`<path class="reasoning-curve ${continuation ? 'continuation-curve' : ''}" data-from="${esc(fromId)}" data-to="${esc(toId)}" d="${d}"/><circle class="curve-origin" cx="${x}" cy="${y}" r="2.5"/>`);
    };
    const state = game.snapshot(), sections = Array.from(host.querySelectorAll<HTMLElement>('.thought-record,.thought-editor'));
    state.thinking?.history.forEach((record, index) => {
        const section = sections[index]; if (!section) return;
        record.outputs.forEach(output => {
            const destination = section.querySelector<HTMLElement>(`[data-thought-result="${output.id}"]`);
            if (!destination) return;
            // Each used evidence branch is real. Unused clues never gain a decorative evidence edge.
            output.used.forEach(id => {
                const node = section.querySelector<HTMLElement>(`[data-thought-node="${id}"]`);
                if (node) connect(node, destination, id, output.id);
            });
        });
    });
    sections.forEach((section, index) => {
        section.querySelectorAll<HTMLElement>('[data-thought-node]').forEach(node => {
            const id = node.dataset.thoughtNode!;
            const previous = sections.slice(0, index).reverse().map(prior => prior.querySelector<HTMLElement>(`[data-thought-result="${id}"]`)).find(Boolean);
            if (previous) connect(previous, node, id, id, true);
        });
    });
    svg.innerHTML = paths.join('');
}
function resetStage() { detail = ''; game.restore(JSON.stringify(samples.stages[stage])); render(true); updateControls(); }
function openSource(id: string) { detail = id; inventoryOpen = true; render(); const entry = root.querySelector<HTMLElement>(`[data-inventory-item="${id}"]`); entry?.scrollIntoView({ block: 'nearest' }); entry?.focus({ preventScroll: true }); }
game.onChange(() => render());
root.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button,[data-thought-result]'); if (!target) return;
    if (target.dataset.readNote) { openSource(target.dataset.readNote); return; }
    if (target.dataset.thoughtResult) { openSource(target.dataset.thoughtResult); return; }
    if (target.dataset.inventoryItem) { detail = detail === target.dataset.inventoryItem ? '' : target.dataset.inventoryItem; render(); return; }
    if (target.dataset.placeEvidence) { game.placeThought(target.dataset.placeEvidence); return; }
    if (target.dataset.removeThought) { game.removeThought(target.dataset.removeThought); return; }
    const action = target.dataset.action;
    if (action === 'notes-list' || action === 'open-inventory') { inventoryOpen = action === 'open-inventory' || !inventoryOpen; render(); }
    if (action === 'think') { game.think(); }
    if (action === 'revise-thought') { game.reviseThought(); }
    if (action === 'thought-tail') root.querySelector('[data-thought-tail]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (action === 'follow-plan') toast('这个办法仍需当面取得姜维应允。此处仅预览界面，不推进正式游戏。');
    if (action === 'close-notes') toast('当前是独立设计预览。返回正式游戏后，仍保留原来的进度。');
});
root.addEventListener('keydown', event => {
    const node = (event.target as HTMLElement).closest<HTMLElement>('[data-thought-result]');
    if (node && ['Enter', ' '].includes(event.key)) { event.preventDefault(); openSource(node.dataset.thoughtResult!); }
});
root.addEventListener('pointerover', event => {
    const node = (event.target as HTMLElement).closest<HTMLElement>('[data-thought-node],[data-thought-result]');
    const id = node?.dataset.thoughtNode ?? node?.dataset.thoughtResult;
    root.querySelectorAll<SVGPathElement>('.reasoning-curve').forEach(path => {
        const related = !!id && (path.dataset.from === id || path.dataset.to === id);
        path.classList.toggle('is-related', related); path.classList.toggle('is-unrelated', !!id && !related);
    });
});
root.addEventListener('dragstart', event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-inventory-drag]');
    if (!target || !event.dataTransfer) return;
    event.dataTransfer.setData('text/plain', target.dataset.inventoryDrag!); event.dataTransfer.effectAllowed = 'copy';
});
root.addEventListener('dragover', event => { if ((event.target as HTMLElement).closest('[data-thought-drop]')) event.preventDefault(); });
root.addEventListener('drop', event => {
    if (!(event.target as HTMLElement).closest('[data-thought-drop]')) return;
    event.preventDefault(); const id = event.dataTransfer?.getData('text/plain');
    if (id && (game.snapshot().story.collected.includes(id) || game.graph()[id])) game.placeThought(id);
});
document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach(button => button.addEventListener('click', () => { theme = button.dataset.theme!; updateControls(); requestAnimationFrame(drawCurves); }));
document.querySelector('#design-stage')!.addEventListener('change', event => { stage = (event.target as HTMLSelectElement).value; resetStage(); });
document.querySelector('#design-reset')!.addEventListener('click', resetStage);
document.querySelector('#design-transparency')!.addEventListener('input', event => { visibility[theme] = Number((event.target as HTMLInputElement).value); updateControls(); });
function focusMode(on: boolean) { document.body.classList.toggle('design-focus', on); (document.querySelector('#design-exit-focus') as HTMLElement).hidden = !on; requestAnimationFrame(drawCurves); }
document.querySelector('#design-fullscreen')!.addEventListener('click', () => focusMode(true));
document.querySelector('#design-exit-focus')!.addEventListener('click', () => focusMode(false));
document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (document.body.classList.contains('design-focus')) focusMode(false); else if (inventoryOpen) { inventoryOpen = false; render(); } } });
window.addEventListener('resize', drawCurves); document.fonts.ready.then(drawCurves);
resetStage();
