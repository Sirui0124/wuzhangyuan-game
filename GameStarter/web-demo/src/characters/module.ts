import { characters, profileById } from './catalog';
import { encounteredCharacters, type CharacterProgress } from './encounters';
import { esc } from '../game/view-common';

/** Read-only UI plugin. The host supplies progress and portraits; no chapter mutation. */
export function createCharacterModule(options: { root: HTMLElement; portraits: Record<string, string>; enabled: boolean }) {
    const { root, portraits } = options;
    if (!options.enabled) return { sync(_progress: CharacterProgress) {}, dispose() {} };
    const lifetime = new AbortController();
    const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/characters.css'; document.head.append(style);
    const dialog = document.createElement('dialog'); dialog.className = 'character-dossier'; dialog.setAttribute('aria-label', '人物小传'); document.body.append(dialog);
    let unlocked: string[] = [], selected = '', focusReturn: HTMLElement | null = null;
    let playing: HTMLVideoElement[] = [];
    let identity = '';
    function pausePlaying() {
        for (const video of Array.from(root.querySelectorAll<HTMLVideoElement>('video'))) {
            if (!video.paused && !video.ended) { if (!playing.includes(video)) playing.push(video); video.pause(); }
        }
    }
    function content() {
        if (!unlocked.includes(selected)) selected = unlocked[0] ?? '';
        const person = profileById(selected);
        dialog.innerHTML = `<header><h1>人物志</h1><button data-character-close aria-label="关闭人物小传">×</button></header><div class="character-book"><nav aria-label="已遇见的人物">${characters.filter(p => unlocked.includes(p.id)).map(p => `<button data-character-select="${p.id}" aria-current="${p.id === selected ? 'true' : 'false'}">${esc(p.name)}<small>${esc(p.role)}</small></button>`).join('')}</nav>${person ? `<article><div class="character-portrait">${portraits[person.id] ? `<img src="${esc(portraits[person.id])}" alt="${esc(person.name)}" />` : `<span>${esc(person.name)}</span>`}</div><div class="character-biography"><h2>${esc(person.name)}</h2><p class="character-role">${esc(person.role)}</p><h3>史料与演义</h3><p>${esc(person.history)}</p><h3>本作设定</h3><p>${esc(person.game)}</p>${person.sources?.length ? `<details class="character-sources"><summary>典籍出处</summary>${(["史书记载", "演义描写"] as const).map(kind => { const entries = person.sources!.filter(source => source.kind === kind); return entries.length ? `<section><h4>${kind}</h4><ul>${entries.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a><p>${esc(source.note)}</p></li>`).join('')}</ul></section>` : ''; }).join('')}</details>` : ''}</div></article>` : '<p class="character-empty">尚未收录人物。遇见他们后，小传会记在这里。</p>'}</div>`;
    }
    function close() {
        if (!dialog.open) return;
        dialog.close();
        for (const video of playing) if (video.isConnected && !video.ended) void video.play().catch(() => {});
        playing = [];
        (focusReturn?.isConnected ? focusReturn : root.querySelector<HTMLElement>('[data-character-open]'))?.focus({ preventScroll: true });
    }
    function open(id?: string) {
        if (id && unlocked.includes(id)) selected = id;
        focusReturn = document.activeElement as HTMLElement;
        playing = []; pausePlaying();
        content(); dialog.showModal(); dialog.querySelector<HTMLElement>('[data-character-close]')?.focus();
    }
    root.addEventListener('click', event => {
        const button = (event.target as HTMLElement).closest<HTMLElement>('[data-character-open]');
        if (!button) return;
        event.preventDefault(); event.stopImmediatePropagation(); open(button.dataset.characterOpen);
    }, { capture: true, signal: lifetime.signal });
    root.addEventListener('play', () => { if (dialog.open) pausePlaying(); }, { capture: true, signal: lifetime.signal });
    dialog.addEventListener('click', event => {
        const target = event.target as HTMLElement;
        if (target.closest('[data-character-close]') || target === dialog) close();
        const button = target.closest<HTMLElement>('[data-character-select]');
        if (button) { selected = button.dataset.characterSelect!; content(); dialog.querySelector<HTMLElement>(`[data-character-select="${selected}"]`)?.focus(); }
    }, { signal: lifetime.signal });
    // Capture before chapter shortcuts so reading a dossier never advances dialogue.
    document.addEventListener('keydown', event => {
        if (!dialog.open) return;
        event.stopImmediatePropagation();
        if (event.key === 'Escape') { event.preventDefault(); close(); }
    }, { capture: true, signal: lifetime.signal });
    return {
        sync(progress: CharacterProgress) {
            const previous = unlocked;
            unlocked = encounteredCharacters(progress);
            if (dialog.open) {
                if (!progress.visible) close();
                else if (previous.join() !== unlocked.join()) content();
                if (dialog.open) pausePlaying();
            }
            root.querySelectorAll('[data-character-ui]').forEach(node => node.remove());
            if (!progress.visible) { identity = ''; return; }
            const nav = root.querySelector('.game-hud nav');
            const launcher = `<button data-character-ui data-character-open aria-haspopup="dialog" class="character-launcher ${nav ? '' : 'character-floating'}">人物志</button>`;
            if (nav) nav.insertAdjacentHTML('afterbegin', launcher); else root.insertAdjacentHTML('beforeend', launcher);
            const added = unlocked.filter(id => !previous.includes(id));
            // Films do not have a reviewed per-shot identity timeline. A story-row speaker
            // or newly unlocked dossier must not label every face in a multi-person film.
            const filmVisible = !!root.querySelector('.cinema-screen,[data-story-film]');
            identity = progress.active === '' || filmVisible ? '' : progress.active && unlocked.includes(progress.active) ? progress.active : added.at(-1) ?? '';
            const person = profileById(identity);
            if (person && !root.querySelector('.workspace-screen')) root.insertAdjacentHTML('beforeend', `<button data-character-ui data-character-open="${person.id}" class="character-identity" aria-label="查看${esc(person.name)}小传"><strong>${esc(person.name)}</strong><span>${esc(person.role)}</span></button>`);
        },
        dispose() { close(); lifetime.abort(); style.remove(); dialog.remove(); root.querySelectorAll('[data-character-ui]').forEach(node => node.remove()); },
    };
}
