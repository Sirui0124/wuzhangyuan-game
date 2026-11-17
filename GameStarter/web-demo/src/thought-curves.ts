import type { GameSessionState } from './chapter-session';
import { thoughtRevealDuration, type ThoughtView } from './thought-workspace-view';

const attr = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Lines follow actual element bounds and the evidence recorded by the reasoning model. */
export function drawThoughtCurves(root: HTMLElement, state: GameSessionState, view: ThoughtView) {
    const expression = state.phase === 'expression' || state.notesPurpose === 'P2';
    const host = root.querySelector<HTMLElement>(expression ? '.expression-layout' : '.reasoning-timeline');
    const svg = host?.querySelector<SVGSVGElement>('.reasoning-curves');
    if (!host || !svg) return;
    const box = host.getBoundingClientRect(), elapsed = Date.now() - view.revealAt;
    if (!box.width || !box.height) return;
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const paths: string[] = [];
    const add = (d: string, from: string, to: string, animate = false, index = 0, kind = '') => {
        paths.push(`<path class="reasoning-curve ${kind} ${animate ? 'ink-drawing' : ''}" data-from="${attr(from)}" data-to="${attr(to)}" pathLength="1" d="${d}" style="animation-delay:${index * 90 - elapsed}ms"/>`);
    };
    const point = (element: Element) => {
        const r = element.getBoundingClientRect();
        return { left: r.left - box.left, right: r.right - box.left, top: r.top - box.top, bottom: r.bottom - box.top, midY: r.top + r.height / 2 - box.top };
    };
    const connect = (source: HTMLElement, target: HTMLElement, from: string, to: string, animate = false, branch = 0) => {
        const a = point(source), b = point(target);
        if (b.left >= a.right + 8) {
            const bend = (b.left - a.right) * .45;
            add(`M${a.right},${a.midY} C${a.right + bend},${a.midY} ${b.left - bend},${b.midY} ${b.left},${b.midY}`, from, to, animate, branch);
        } else {
            const x = (a.left + a.right) / 2, tx = (b.left + b.right) / 2;
            const bend = Math.max(18, Math.abs(b.top - a.bottom) * .45);
            add(`M${x},${a.bottom} C${x + 12},${a.bottom + bend} ${tx},${b.top - bend} ${tx},${b.top}`, from, to, animate, branch);
        }
    };
    if (expression) {
        const topic = host.querySelector<HTMLElement>('.speech-evidence>header'), target = host.querySelector<HTMLElement>('[data-expression-output]');
        const sources = host.querySelectorAll<HTMLElement>('[data-expression-source]');
        if (topic) {
            const q = point(topic);
            sources.forEach((source, index) => {
                const b = point(source), x = q.left + 9, y = q.bottom + 3;
                add(`M${x},${y} C${x + 18},${y + 18} ${b.left - 28},${b.midY} ${b.left},${b.midY}`, 'expression-topic', source.dataset.expressionSource!, false, index, 'question-curve');
                if (target && state.composition.status === 'ready' && state.story.draft.trim()) {
                    connect(source, target, source.dataset.expressionSource!, 'expression-draft', !view.reduced && elapsed < thoughtRevealDuration, index);
                }
            });
        }
    } else {
        let stageQuestion: HTMLElement | null = null;
        host.querySelectorAll<HTMLElement>('.thought-page').forEach(page => {
            const ownQuestion = page.querySelector<HTMLElement>('[data-thought-question]');
            if (ownQuestion) stageQuestion = ownQuestion;
            const question = stageQuestion;
            if (!question) return;
            const q = point(question);
            // A compact timeline reuses the actual prior result rather than drawing
            // a second copy of that result at the top of every round.
            const previousResult = (id: string) => Array.from(host.querySelectorAll<HTMLElement>(`[data-thought-result="${id}"] .outcome-title`))
                .find(result => !!(result.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING));
            if (ownQuestion) for (const id of (page.dataset.thoughtStartIds ?? '').split(' ').filter(Boolean)) {
                const start = previousResult(id);
                if (!start) continue;
                const a = point(start), tx = q.right + 8, bend = Math.max(32, Math.abs(a.left - tx) * .35);
                add(`M${a.left - 4},${a.midY} C${a.left - bend},${a.midY} ${tx + bend},${q.midY - 8} ${tx},${q.midY}`, id, 'question', false, 0, 'continuation-curve');
            }
            page.querySelectorAll<HTMLElement>('[data-thought-node]').forEach(node => {
                const b = point(node), x = q.left + 9, y = q.bottom + 3;
                add(`M${x},${y} C${x + 18},${y + 18} ${b.left - 28},${b.midY} ${b.left},${b.midY}`, 'question', node.dataset.thoughtNode!, false, 0, 'question-curve');
            });
            page.querySelectorAll<HTMLElement>('[data-thought-result]').forEach(outcome => {
                const result = outcome.querySelector<HTMLElement>('.outcome-title');
                if (!result) return;
                (outcome.dataset.resultInputs ?? '').split(' ').filter(Boolean).forEach((id, branch) => {
                    const source = page.querySelector<HTMLElement>(`[data-thought-node="${id}"]`);
                    // Inherited answer connects to the new question; do not imply a second answer.
                    if (source) connect(source, result, id, outcome.dataset.thoughtResult!, page.classList.contains('is-revealing'), branch);
                });
            });
        });
    }
    svg.innerHTML = paths.join('');
    highlightThoughtCurves(root, document.activeElement);
}

/** Focus changes line emphasis without changing evidence or inference. */
export function highlightThoughtCurves(root: HTMLElement, target: EventTarget | null) {
    const node = target instanceof Element ? target.closest<HTMLElement>('[data-thought-node],[data-thought-result],[data-thought-start],[data-expression-source],[data-expression-output]') : null;
    const id = node?.dataset.thoughtNode ?? node?.dataset.thoughtResult ?? node?.dataset.thoughtStart ?? node?.dataset.expressionSource ?? (node?.hasAttribute('data-expression-output') ? 'expression-draft' : undefined);
    root.querySelectorAll<SVGPathElement>('.reasoning-curve').forEach(path => {
        const related = !!id && (path.dataset.from === id || path.dataset.to === id);
        path.classList.toggle('is-related', related);
        path.classList.toggle('is-unrelated', !!id && !related);
    });
}

