/** Chapter-neutral selection row. Chapters own their state and event handlers. */
const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
type DetailAction = 'data-inventory-item' | 'data-detail';
type ToggleAction = 'data-use' | 'data-place-evidence' | 'data-attach-item' | 'data-select';
export function selectionRowHTML(props: {
    id: string; title: string; search?: string; detailAction: DetailAction; dragId?: string;
    toggle?: { action: ToggleAction; id?: string; selected: boolean; disabled?: boolean; unavailable?: boolean };
}) {
    const toggle = props.toggle;
    return `<section class="inventory-entry${toggle?.selected ? ' is-placed' : ''}${toggle?.unavailable ? ' is-stale' : ''}" data-search-text="${esc(props.search ?? props.title)}"><button class="inventory-row" ${props.detailAction}="${esc(props.id)}"${props.dragId ? ` data-inventory-drag="${esc(props.dragId)}"` : ''} aria-haspopup="dialog"><span>${esc(props.title)}</span></button>${toggle ? `<button class="inventory-place" ${toggle.action}="${esc(toggle.id ?? props.id)}" aria-pressed="${toggle.selected}" aria-label="${toggle.selected ? '收回' : '放入'}${esc(props.title)}"${toggle.disabled ? ' disabled' : ''}>${toggle.unavailable ? '−' : toggle.selected ? '✓' : '＋'}</button>` : ''}</section>`;
}
