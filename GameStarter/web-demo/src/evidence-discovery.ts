/** Let the player read the new fact before it joins the evidence collection. */
export function playEvidenceDiscovery(notice: HTMLElement, finish: () => void): () => void {
    let timer = 0, flight: Animation | null = null, landing: Animation | null = null;
    let stopped = false;
    const destination = () => document.querySelector<HTMLElement>('.evidence-browse')
        ?? document.querySelector<HTMLElement>('.evidence-entry');
    const dispose = () => {
        stopped = true;
        clearTimeout(timer);
        flight?.cancel(); landing?.cancel();
        notice.classList.remove('discovery-flying');
        window.removeEventListener('resize', end);
    };
    const end = () => { if (!stopped) { dispose(); finish(); } };
    const arrive = () => {
        if (stopped) return;
        notice.classList.remove('show', 'discovery-flying');
        // Rendering may have replaced the entry while the notice was moving.
        const target = destination();
        if (target) landing = target.animate([
            { filter: 'brightness(1)' },
            { filter: 'brightness(1.65)', offset: .35 },
            { filter: 'brightness(1)' },
        ], { duration: 480, easing: 'ease-out' });
        timer = window.setTimeout(end, 500);
    };
    window.addEventListener('resize', end);
    // The engine announces before rendering; resolve geometry after the reading hold.
    const hold = Math.min(3200, Math.max(1800, (notice.textContent?.length ?? 0) * 85));
    timer = window.setTimeout(() => {
        const target = destination();
        if (!target) { end(); return; }
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { arrive(); return; }
        const from = notice.getBoundingClientRect(), to = target.getBoundingClientRect();
        if (!to.width || !to.height) { end(); return; }
        const dx = to.x + to.width / 2 - (from.x + from.width / 2);
        const dy = to.y + to.height / 2 - (from.y + from.height / 2);
        notice.classList.add('discovery-flying');
        flight = notice.animate([
            { transform: 'translateX(-50%) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${dx * .55}px), ${dy * .35 - 28}px) scale(.72)`, opacity: 1, offset: .5 },
            { transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(.12)`, opacity: 0 },
        ], { duration: 780, easing: 'cubic-bezier(.4,0,.25,1)', fill: 'forwards' });
        flight.onfinish = arrive;
    }, hold);
    return dispose;
}
