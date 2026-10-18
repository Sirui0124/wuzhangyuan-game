import type { Ending, EndingCatalog, EndingCollection } from './endings';

type AlbumOptions = { warning?: string; onClose?: () => void; initialId?: string };
type Filter = 'all' | 'unlocked' | 'sealed';
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
let activeAlbum: { close: () => void } | null = null;

// This view only reads the collection. Opening a card never grants an ending.
export function openEndingAlbum(catalog: EndingCatalog, collection: EndingCollection, options: AlbumOptions = {}) {
    activeAlbum?.close();
    if (!document.querySelector('link[data-ending-album-style]')) {
        const style = document.createElement('link');
        style.rel = 'stylesheet'; style.href = '/ending-album.css'; style.dataset.endingAlbumStyle = 'true'; document.head.append(style);
    }
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    const hidden = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement).map(node => ({ node, inert: node.inert }));
    hidden.forEach(({ node }) => { node.inert = true; });
    const host = document.createElement('div'); host.className = 'ending-album-host'; document.body.append(host);
    document.body.style.overflow = 'hidden';
    let filter: Filter = 'all', selected = catalog.endings.some(e => e.id === options.initialId) ? options.initialId! : '';
    let closed = false;
    const unlocked = (ending: Ending) => !!collection.unlocked[ending.id];
    const count = catalog.endings.filter(unlocked).length;
    const visible = () => catalog.endings.filter(e => filter === 'all' || (filter === 'unlocked' ? unlocked(e) : !unlocked(e)));
    const date = (value: string) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
    const art = (ending: Ending) => {
        const symbols: Record<string, string> = {
            'tutorial-blocked': '<path d="M88 62q42 22 84 0M88 78q42 22 84 0M98 132q42-21 65 4"/><path d="M128 89v43m-19 5h42l13 29H96zM91 171h79"/>',
            'tutorial-sacrifice': '<path d="M128 48c-22 26 24 26 0 52-23-13-20-34 0-52z"/><path d="M110 108h37l-7 25h-23zM128 133v35m-25 7h51"/><path d="M66 184h128M78 192h102"/>',
            'no-plan': '<path d="M65 77h137M81 88q25 37 0 81m96-81q-25 37 0 81M105 145h46l-7 19h-32zM128 164v20m-23 7h47"/><path d="M62 115q47-24 81 0t64 0"/>',
            'safe': '<path d="M128 44c-28 33 28 34 0 64-24-19-26-33 0-64z"/><path d="M100 116h57l-10 28h-38zM128 145v35m-31 10h63M77 199h102"/><path d="M73 68q55-31 112 0M64 58q64-39 130 0"/>',
            'provocation': '<path d="M97 56l60 120m-65-11l72-94M138 168l25-13m-85 19l23 16M166 68l12-14M86 43l11 13"/><path d="M58 207h143"/>',
        };
        return `<svg viewBox="0 0 260 250" aria-hidden="true"><circle class="album-art-ring" cx="130" cy="125" r="93"/><circle class="album-art-ring inner" cx="130" cy="125" r="84"/><g class="album-art-symbol">${symbols[ending.id] ?? '<path d="M80 80h100v110H80zM98 103h64m-64 25h64m-64 25h40"/>'}</g><path class="album-art-ground" d="M20 220q60-20 100 0t120 0"/></svg>`;
    };
    const cover = (ending: Ending, detail = false) => `<div class="album-card-art ${escape(ending.id)} ${unlocked(ending) ? '' : 'is-sealed'}">${unlocked(ending) ? art(ending) : '<span class="album-sealed-mark" aria-hidden="true">封</span>'}<span class="album-card-number">${escape(ending.number)}</span><span class="album-art-caption">${unlocked(ending) ? escape(ending.kind) : '未启之页'}</span>${detail && unlocked(ending) ? '<span class="album-collected-seal">已收录</span>' : ''}</div>`;
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
            body = `<div class="album-spread" data-album-detail="${escape(ending.id)}"><div class="album-picture-page">${cover(ending, true)}<p class="album-page-number">五丈原 · 第 ${escape(ending.number)} 页</p></div><article class="album-story-page"><span class="album-eyebrow">${row ? escape(ending.phase) : '此页尚未写入你的经历'}</span><h2>${row ? escape(ending.kind) : '尚未收录'}</h2>${row ? `<p class="album-detail-title">${escape(ending.title)}</p><div class="album-ink-rule"></div><p class="album-description">${escape(ending.description)}</p><p class="album-reflection">${escape(ending.hint)}</p><dl class="album-record"><div><dt>首次达成</dt><dd>${escape(date(row.firstUnlockedAt))}</dd></div><div><dt>达成次数</dt><dd>${row.times} 次</dd></div></dl>` : '<p class="album-detail-title">这段命运，还未与你相遇。</p><div class="album-ink-rule"></div><p class="album-description">继续探索五丈原，亲历这段结局后，它的故事会留在这里。</p><p class="album-reflection">回溯后的主角会重新调查；这本卡册为你保存已经走过的结局。</p>'}</article></div><nav class="album-flip" aria-label="翻阅结局"><button data-album-action="previous" ${index <= 0 ? 'disabled' : ''}>← 上一页</button><span>${index + 1} / ${list.length}</span><button data-album-action="next" ${index < 0 || index >= list.length - 1 ? 'disabled' : ''}>下一页 →</button></nav>`;
        } else {
            body = `<div class="album-library"><aside class="album-book-intro"><span class="album-volume">壹</span><h2>五丈原</h2><p>同一夜，不同的命运。<br>每一次走到尽头，<br>都在此留下一页。</p><div class="album-intro-rule"></div><span class="album-intro-seal">历史留痕</span><small>重玩与回溯后，收录依然保留。</small></aside><section class="album-shelf" aria-label="结局卡册">${list.length ? list.map(e => `<button class="album-card ${unlocked(e) ? 'unlocked' : 'sealed'}" data-album-action="card" data-album-id="${escape(e.id)}" aria-label="${unlocked(e) ? `查看结局 ${escape(e.number)}：${escape(e.kind)}，${escape(e.title)}` : `查看未解锁结局 ${escape(e.number)} 的封面`}">${cover(e)}<span class="album-card-copy"><span class="album-card-kind">${unlocked(e) ? escape(e.kind) : '尚未收录'}</span><span class="album-card-title">${unlocked(e) ? escape(e.title) : '亲历之后，方可展开'}</span><span class="album-card-foot">${unlocked(e) ? `已达成 ${collection.unlocked[e.id].times} 次 · 翻阅此页` : '结局内容暂未揭晓'}</span></span></button>`).join('') : `<div class="album-empty"><span aria-hidden="true">${filter === 'unlocked' ? '留白' : '成册'}</span><h2>${filter === 'unlocked' ? '还没有收录的结局' : '这一卷已全部收录'}</h2><p>${filter === 'unlocked' ? '走完一次故事，你的第一张结局卡会出现在这里。' : '可以切换到“已收录”，重读走过的命运。'}</p><button data-album-action="filter" data-album-id="all">查看全部结局</button></div>`}</section></div>`;
        }
        host.innerHTML = `<section class="ending-album" role="dialog" aria-modal="true" aria-labelledby="album-title"><header class="album-header"><div><span class="album-eyebrow">时光回溯 · 命运留痕</span><h1 id="album-title">我的结局成就</h1></div><button class="album-return" data-album-action="close">返回${document.querySelector('.main-menu') ? '开始页' : document.querySelector('.campaign-map') ? '地图' : document.querySelector('.ending-screen') ? '结局' : '游戏'} <span aria-hidden="true">↗</span></button></header><div class="album-toolbar"><div class="album-progress"><span>五丈原卷</span><strong>${count}<small> / ${catalog.endings.length}</small></strong><span>已收录</span><div class="album-progress-track" role="progressbar" aria-label="结局收录进度" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${catalog.endings.length}"><i style="width:${catalog.endings.length ? count / catalog.endings.length * 100 : 0}%"></i></div></div>${ending ? '<button class="album-back" data-album-action="overview">← 返回卡册</button>' : `<nav class="album-filters" aria-label="筛选结局">${([['all', '全部结局'], ['unlocked', '已收录'], ['sealed', '未收录']] as const).map(([key, label]) => `<button data-album-action="filter" data-album-id="${key}" aria-pressed="${filter === key}">${label}</button>`).join('')}</nav>`}</div>${options.warning ? `<p class="album-warning" role="status">${escape(options.warning)}</p>` : ''}<main class="album-book ${ending ? 'detail' : ''}">${body}</main><footer class="album-footer"><span>卡册记录你的经历</span><span>主角每次回溯后重新获取本轮信息</span></footer></section>`;
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
            case 'overview': selected = ''; render('[data-album-action="filter"][aria-pressed="true"]'); break;
            case 'filter': filter = button.dataset.albumId as Filter; selected = ''; render('[data-album-action="filter"][aria-pressed="true"]'); break;
            case 'previous': turn(-1); break;
            case 'next': turn(1); break;
        }
    });
    document.addEventListener('keydown', keyboard, true);
    activeAlbum = { close }; render(); host.querySelector<HTMLElement>('[data-album-action="close"]')?.focus();
    return { close };
}
