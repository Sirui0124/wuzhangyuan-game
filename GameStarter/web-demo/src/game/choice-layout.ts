/** Ordinary choices share a row only when every option fits on one line. */
export function observeChoiceLayout(root: HTMLElement) {
    let frame = 0;
    const layout = () => {
        frame = 0;
        root.querySelectorAll<HTMLElement>('.scout-choice').forEach(group => {
            const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>(':scope > button'));
            if (!buttons.length) return;
            group.classList.add('choice-layout');
            group.style.setProperty('--choice-columns', String(buttons.length));
            group.classList.remove('choices-stacked');
            const wraps = buttons.some(button => {
                const label = button.querySelector<HTMLElement>('span');
                if (!label) return true;
                const lineHeight = Number.parseFloat(getComputedStyle(label).lineHeight);
                return label.scrollWidth > label.clientWidth + 1 || label.getBoundingClientRect().height > lineHeight + 1;
            });
            group.classList.toggle('choices-stacked', wraps);
        });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(layout); };
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    document.fonts.addEventListener('loadingdone', schedule);
    void document.fonts.ready.then(schedule);
    schedule();
    return () => {
        observer.disconnect(); cancelAnimationFrame(frame);
        window.removeEventListener('resize', schedule);
        document.fonts.removeEventListener('loadingdone', schedule);
    };
}
