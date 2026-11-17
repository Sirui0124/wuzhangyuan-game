import { achievementChapters } from './achievements/catalog';
import { achievementCardHTML } from './achievement-card';
import type { Ending, EndingCatalog, EndingCollection } from './endings';

type AlbumOptions = { warning?: string; onClose?: () => void; initialId?: string; initialChapter?: string; unlockedOnly?: boolean };
type Filter = 'all' | 'unlocked' | 'sealed';
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
let activeAlbum: { close: () => void } | null = null;

// This view only reads the collection. Opening a card never grants an ending.
export function openEndingAlbum(catalog: EndingCatalog, collection: EndingCollection, options: AlbumOptions = {}) {
    activeAlbum?.close();
    if (!document.querySelector('link[data-ending-album-style]')) {
        const style = document.createElement('link');
        style.rel = 'stylesheet'; style.href = '/ending-collectibles.css'; style.dataset.endingAlbumStyle = 'true'; document.head.append(style);
    }
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    const hidden = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement).map(node => ({ node, inert: node.inert }));
    hidden.forEach(({ node }) => { node.inert = true; });
    const host = document.createElement('div'); host.className = 'ending-album-host'; document.body.append(host);
    document.body.style.overflow = 'hidden';
    let filter: Filter = options.unlockedOnly ? 'unlocked' : 'all', selected = catalog.endings.some(e => e.id === options.initialId) ? options.initialId! : '';
    let closed = false, chapter = options.initialChapter ?? 'all';
    const unlocked = (ending: Ending) => !!collection.unlocked[ending.id];
    const count = catalog.endings.filter(unlocked).length;
    const visible = () => catalog.endings.filter(e => (chapter === 'all' || (e.chapter ?? 'wuzhang') === chapter) && (!options.unlockedOnly || unlocked(e)) && (filter === 'all' || (filter === 'unlocked' ? unlocked(e) : !unlocked(e))));
    const date = (value: string) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
    const cover = (ending: Ending, _detail = false) => `<div class="album-collectible-cover">${achievementCardHTML(ending, unlocked(ending))}</div>`;
    function close() {
        if (closed) return;
        closed = true; document.removeEventListener('keydown', keyboard); host.remove();
        hidden.forEach(({ node, inert }) => { node.inert = inert; }); document.body.style.overflow = oldOverflow;
        activeAlbum = null; focused?.focus(); options.onClose?.();
    }
    function render(focusTarget = '') {
        const ending = catalog.endings.find(e => e.id === selected);
        const list = visible();
        const index = ending ? list.indexOf(ending) : -1;
        let body: string;
        if (ending) {
            const row = collection.unlocked[ending.id];
            body = `<div class="album-spread" data-album-detail="${escape(ending.id)}"><div class="album-picture-page">${cover(ending, true)}<p class="album-page-number">${escape(achievementChapters[(ending.chapter ?? 'wuzhang') as keyof typeof achievementChapters])} · 第 ${escape(ending.number)} 页</p></div><article class="album-story-page"><span class="album-eyebrow">${row ? escape(ending.phase) : '此页尚未写入你的经历'}</span><h2>${row || ending.category === 'milestone' ? escape(ending.title) : '尚未收录'}</h2>${row ? `<p class="album-detail-title">${escape(ending.kind)}</p><div class="album-ink-rule"></div><p class="album-description">${escape(ending.description)}</p><p class="album-reflection">${escape(ending.hint)}</p><dl class="album-record"><div><dt>首次达成</dt><dd>${escape(date(row.firstUnlockedAt))}</dd></div><div><dt>达成次数</dt><dd>${row.times} 次</dd></div></dl>` : ending.category === 'milestone' ? `<p class="album-detail-title">尚未收录 · ${escape(ending.phase)}</p><div class="album-ink-rule"></div><p class="album-description">${escape(ending.hint)}</p><p class="album-reflection">达成后，这段经历会留在卡册里。</p>` : '<p class="album-detail-title">这段命运，还未与你相遇。</p><div class="album-ink-rule"></div><p class="album-description">继续探索，亲历这段结局后，它的故事会留在这里。</p><p class="album-reflection">回溯后，我会重新调查；这本卡册为你保存已经走过的经历。</p>'}</article></div><nav class="album-flip" aria-label="翻阅成就"><button data-album-action="previous" ${index <= 0 ? 'disabled' : ''}>← 上一页</button><span>${index + 1} / ${list.length}</span><button data-album-action="next" ${index < 0 || index >= list.length - 1 ? 'disabled' : ''}>下一页 →</button></nav>`;
        } else {
            body = `<div class="album-library"><aside class="album-book-intro"><span class="album-volume">壹</span><h2>五丈原</h2><p>同一夜，不同的命运。<br>每一次走到尽头，<br>都在此留下一页。</p><div class="album-intro-rule"></div><span class="album-intro-seal">历史留痕</span><small>重玩与回溯后，收录依然保留。</small></aside><section class="album-shelf" aria-label="成就卡册">${list.length ? list.map(e => `<button class="album-card ${unlocked(e) ? 'unlocked' : 'sealed'}" data-album-action="card" data-album-id="${escape(e.id)}" aria-label="${unlocked(e) ? `查看成就 ${escape(e.number)}：${escape(e.kind)}，${escape(e.title)}` : `查看未解锁成就 ${escape(e.number)} 的封面`}">${cover(e)}</button>`).join('') : `<div class="album-empty"><span aria-hidden="true">${filter === 'unlocked' ? '留白' : '成册'}</span><h2>${filter === 'unlocked' ? '还没有收录的成就' : '这一卷已全部收录'}</h2><p>${filter === 'unlocked' ? '调查、交谈和抉择，都可能在这里留下经历。' : '可以切换到“已收录”，重读走过的命运。'}</p><button data-album-action="filter" data-album-id="all">查看全部成就</button></div>`}</section></div>`;
        }
        host.innerHTML = `<section class="ending-album" role="dialog" aria-modal="true" aria-labelledby="album-title"><header class="album-header"><div><span class="album-eyebrow">回溯舆图 · 成就档案</span><h1 id="album-title">我的成就档案</h1></div><button class="album-return" data-album-action="close">返回${document.querySelector('.game-menu') ? '开始页' : document.querySelector('.chapter-map') ? '舆图' : document.querySelector('.chapter-ending') ? '结局' : '游戏'} <span aria-hidden="true">↗</span></button></header><div class="album-toolbar"><div class="album-progress"><span>行旅合卷</span><strong>${count}<small> / ${catalog.endings.length}</small></strong><span>已收录</span><div class="album-progress-track" role="progressbar" aria-label="成就收录进度" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${catalog.endings.length}"><i style="width:${catalog.endings.length ? count / catalog.endings.length * 100 : 0}%"></i></div></div>${ending ? '<button class="album-back" data-album-action="overview">← 返回卡册</button>' : options.unlockedOnly ? '' : `<nav class="album-filters" aria-label="筛选成就">${([['all', '全部成就'], ['unlocked', '已收录'], ['sealed', '未收录']] as const).map(([key, label]) => `<button data-album-action="filter" data-album-id="${key}" aria-pressed="${filter === key}">${label}</button>`).join('')}</nav>`}</div>${options.warning ? `<p class="album-warning" role="status">${escape(options.warning)}</p>` : ''}<nav class="album-chapters" aria-label="按章节查看成就">${[['all','行旅合卷'],...Object.entries(achievementChapters)].map(([key,label]) => `<button data-album-action="chapter" data-album-id="${key}" aria-pressed="${chapter === key}">${label}</button>`).join('')}</nav><main class="album-book ${ending ? 'detail' : ''}">${body}</main><footer class="album-footer"><span>卡册记录你的经历</span><span>我每次回溯后重新获取本轮信息</span></footer></section>`;
        if (focusTarget) host.querySelector<HTMLElement>(focusTarget)?.focus();
    }
    function turn(offset: number) {
        const list = visible(), index = list.findIndex(e => e.id === selected), next = list[index + offset];
        if (index < 0 || !next) return;
        selected = next.id; render('[data-album-action="overview"]');
    }
    function keyboard(event: KeyboardEvent) {
        if (closed) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
        else if (selected && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); turn(event.key === 'ArrowLeft' ? -1 : 1); }
        else if (event.key === 'Tab') {
            const nodes = Array.from(host.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')).filter(e => e.getClientRects().length);
            const first = nodes[0], last = nodes.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    }
    host.addEventListener('click', event => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-album-action]');
        if (!button || button.disabled) return;
        switch (button.dataset.albumAction) {
            case 'close': close(); break;
            case 'card': selected = button.dataset.albumId ?? ''; render('[data-album-action="overview"]'); break;
            case 'overview': selected = ''; render(options.unlockedOnly ? '[data-album-action="card"]' : '[data-album-action="filter"][aria-pressed="true"]'); break;
            case 'filter': filter = button.dataset.albumId as Filter; selected = ''; render('[data-album-action="filter"][aria-pressed="true"]'); break;
            case 'chapter': chapter = button.dataset.albumId ?? 'all'; selected = ''; render('[data-album-action="chapter"][aria-pressed="true"]'); break;
            case 'previous': turn(-1); break;
            case 'next': turn(1); break;
        }
    });
    document.addEventListener('keydown', keyboard, true);
    activeAlbum = { close }; render(); host.querySelector<HTMLElement>('[data-album-action="close"]')?.focus();
    return { close };
}
