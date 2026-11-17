import { esc } from './view-common';
export type DialogueClue = { id: string; title: string; text: string };
export function clueReferencesHTML(clues: DialogueClue[], selected: string[]) {
    return `<div class="clue-references"><span>引用线索</span>${selected.map(id => clues.find(c => c.id === id)).filter((c): c is DialogueClue => !!c).map(c=>`<span class="clue-reference"><button data-clue-preview="${esc(c.id)}" aria-label="查看线索：${esc(c.title)}">${esc(c.title)}</button><button data-action="remove-clue" data-clue="${esc(c.id)}" aria-label="移除引用：${esc(c.title)}">×</button></span>`).join('')}<button data-clue-picker aria-label="添加引用线索" aria-haspopup="dialog">＋</button></div>`;
}
export function clueSidebarHTML(clues: DialogueClue[], selected: string[], busy: boolean) {
    return `<aside class="dialogue-clues" popover="auto" role="dialog" aria-label="引用线索" tabindex="-1"><header><span>引用线索</span><button data-clue-close aria-label="关闭线索">×</button></header>${clues.length ? clues.map(c=>`<details data-clue-detail="${esc(c.id)}"><summary>${esc(c.title)}${selected.includes(c.id) ? '<span class="clue-chosen">已引用</span>' : ''}</summary><p>${esc(c.text)}</p><button data-action="insert-clue" data-clue="${esc(c.id)}" ${busy || selected.includes(c.id) ? 'disabled' : ''}>${selected.includes(c.id)?'已引用':'＋ 引用此线索'}</button></details>`).join('') : '<p>暂无已获线索。</p>'}</aside>`;
}
/** UI only; chapter handlers retain selection and persistence ownership. */
export function handleCluePopup(root: HTMLElement, target: HTMLElement): boolean {
    const show = (id?: string, scroll = 0) => {
        const panel = root.querySelector<HTMLElement>('.dialogue-clues');
        const anchor = root.querySelector<HTMLElement>('.clue-references');
        if (!panel || !anchor) return;
        const rect = anchor.getBoundingClientRect(), width = Math.min(520, window.innerWidth - 24);
        const edge = Math.min(window.innerHeight - 12, Math.max(140, rect.top - 12));
        panel.style.width = `${width}px`;
        panel.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
        panel.style.bottom = `${Math.max(12, window.innerHeight - edge)}px`;
        panel.style.maxHeight = `${Math.min(420, Math.max(120, edge - 12))}px`;
        panel.querySelectorAll<HTMLDetailsElement>('details').forEach(d => { d.open = d.dataset.clueDetail === id; });
        if (!panel.dataset.keyboardBound) {
            panel.dataset.keyboardBound = 'true';
            panel.addEventListener('keydown', event => {
                if (event.key !== 'Escape') return;
                event.preventDefault(); event.stopPropagation(); panel.hidePopover();
                root.querySelector<HTMLElement>('[data-clue-picker]')?.focus({ preventScroll:true });
            });
        }
        if (!panel.matches(':popover-open')) panel.showPopover();
        const expanded = panel.querySelector<HTMLElement>('details[open]');
        panel.scrollTop = expanded ? Math.max(0, expanded.offsetTop - (panel.querySelector('header')?.clientHeight ?? 48) - 16) : scroll;
        panel.querySelector<HTMLElement>(id ? 'details[open] summary' : 'summary, [data-clue-close]')?.focus({ preventScroll:true });
    };
    if (target.hasAttribute('data-clue-picker') || target.hasAttribute('data-clue-preview')) { show(target.dataset.cluePreview); return true; }
    if (target.hasAttribute('data-clue-close')) {
        root.querySelector<HTMLElement>('.dialogue-clues')?.hidePopover();
        root.querySelector<HTMLElement>('[data-clue-picker]')?.focus({ preventScroll:true }); return true;
    }
    if (target.dataset.action === 'insert-clue' && !(target as HTMLButtonElement).disabled) {
        const scroll = root.querySelector('.dialogue-clues')?.scrollTop ?? 0;
        requestAnimationFrame(() => show(target.dataset.clue, scroll));
    }
    return false;
}
