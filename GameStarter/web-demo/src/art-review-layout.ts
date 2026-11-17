// Visual review composition only. These branches show already established provenance,
// rather than creating solver edges, granting knowledge, or changing a player's graph.
type Point = [number, number, number];
const layouts: Record<string, Record<string, Point>> = {
    thoughts: {
        C02: [95, 180, 300], C03: [100, 395, 300], I01: [510, 145, 400],
        C04: [1190, 165, 300], R01: [1140, 405, 315],
        C06: [105, 715, 310], C07: [1145, 720, 310], R02: [600, 775, 340],
    },
    expression: {
        C02: [100, 180, 285], C03: [470, 145, 270], C04: [70, 650, 285],
        R01: [250, 400, 310], C08: [435, 785, 320],
    },
};
const curves: Record<string, { from: string; to: string; d: string }[]> = {
    thoughts: [
        { from: 'C02', to: 'I01', d: 'M395,210 C460,210 450,177 510,177' },
        { from: 'C03', to: 'I01', d: 'M400,426 C490,426 420,208 510,208' },
        { from: 'I01', to: 'R01', d: 'M910,177 C1080,177 1040,435 1140,435' },
        { from: 'C04', to: 'R01', d: 'M1340,298 C1410,330 1510,400 1455,435' },
        { from: 'R01', to: 'R02', d: 'M1140,470 C1070,470 1100,810 940,810' },
        { from: 'C06', to: 'R02', d: 'M415,745 C495,745 480,810 600,810' },
        { from: 'C07', to: 'R02', d: 'M1145,755 C1050,755 1050,855 940,855' },
    ],
    expression: [
        { from: 'C02', to: 'R01', d: 'M385,210 C440,275 170,350 250,434' },
        { from: 'C03', to: 'R01', d: 'M605,280 C680,330 650,382 560,432' },
        { from: 'C04', to: 'R01', d: 'M220,650 C120,600 150,480 250,480' },
        { from: 'R01', to: 'expression', d: 'M560,435 C615,435 620,445 687,445' },
        { from: 'C08', to: 'expression', d: 'M755,819 C825,810 610,690 687,575' },
    ],
};
export function composeReviewSample(raw: string, scene: string): string {
    if (!layouts[scene]) return raw;
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const screen = doc.querySelector<HTMLElement>('.thought-screen')!;
    screen.classList.add('mindmap-review');
    doc.querySelector<HTMLElement>('.thought-world')!.style.transform = 'none';
    const kept = new Set<string>();
    doc.querySelectorAll<HTMLElement>('[data-node]').forEach(note => {
        const id = note.dataset.node!, p = layouts[scene][id];
        if (!p) { note.remove(); return; }
        kept.add(id);
        note.style.left = `${p[0]}px`; note.style.top = `${p[1]}px`; note.style.width = `${p[2]}px`;
        // Review plates show the whole note. Drag handles and solver ports belong to live play.
        note.querySelector('.note-operations')?.remove();
        if (id === 'I01') note.querySelector('.note-excerpt')?.remove();
        if (scene === 'expression') {
            note.classList.toggle('review-support', !['R01', 'C08'].includes(id));
            note.classList.toggle('review-selected', ['R01', 'C08'].includes(id));
            const chosen = doc.querySelector(`[data-read-evidence="${id}"]`)?.parentElement;
            if (chosen) {
                note.querySelector('.note-excerpt')!.textContent = chosen.querySelector('p')!.textContent;
                note.querySelector('.note-source')!.textContent = chosen.querySelector('small')!.textContent;
            }
        }
    });
    const svg = doc.querySelector<SVGSVGElement>('.thought-lines')!;
    svg.setAttribute('width', '1600'); svg.setAttribute('height', '1000');
    svg.setAttribute('aria-label', '已有线索、推论与表达之间的依据关系');
    svg.replaceChildren();
    for (const edge of curves[scene]) {
        if (!kept.has(edge.from) || edge.to !== 'expression' && !kept.has(edge.to)) continue;
        const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', edge.d); path.dataset.from = edge.from; path.dataset.to = edge.to;
        path.classList.add(edge.to === 'expression' ? 'expression-branch' : 'source-branch');
        svg.append(path);
    }
    if (scene === 'expression') doc.querySelector('.expression-evidence')?.remove();
    return doc.body.innerHTML;
}
