import { chapterCatalog } from '../chapters/catalog';

type Point = readonly [number, number];
type MapPosition = { x: number; y: number; narrowX: number; narrowY: number };
export function mapNodeStyle(node: MapPosition): string {
    return `--map-x:${node.x}%;--map-y:${node.y}%;--map-narrow-x:${node.narrowX}%;--map-narrow-y:${node.narrowY}%`;
}

/** Hand-shaped bends follow the landscape; endpoints share the chapter marker coordinates. */
export function mapRouteHTML(narrow = false): string {
    const points: Point[] = chapterCatalog.map(node => narrow ? [node.narrowX * 10, node.narrowY * 10] : [node.x * 10, node.y * 10]);
    const controls: readonly (readonly [Point, Point])[] = narrow ? [
        [[220, 850], [390, 650]], [[675, 620], [290, 440]], [[35, 415], [400, 325]], [[705, 280], [255, 150]], [[55, 90], [410, 20]],
    ] : [
        [[170, 795], [235, 540]], [[490, 625], [555, 390]], [[890, 480], [895, 120]], [[595, 100], [520, 180]], [[265, 320], [205, 75]],
    ];
    const pair = (p: Point) => p.join(' ');
    const curve = (i: number) => `C${pair(controls[i][0])} ${pair(controls[i][1])} ${pair(points[i + 1])}`;
    const path = (start: number, end: number) => `M${pair(points[start])}${controls.slice(start, end).map((_, offset) => curve(start + offset)).join('')}`;
    const sample = (i: number, t: number): Point => {
        const [a, d] = [points[i], points[i + 1]], [b, c] = controls[i], u = 1 - t;
        const axis = (index: 0 | 1) => +(u ** 3 * a[index] + 3 * u ** 2 * t * b[index] + 3 * u * t ** 2 * c[index] + t ** 3 * d[index]).toFixed(2);
        return [axis(0), axis(1)];
    };
    const size = narrow ? 24 : 19, name = narrow ? 'narrow' : 'wide';
    return `<svg class="map-route-${name}" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id="map-arrow-${name}" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="${size}" markerHeight="${size}" orient="auto" markerUnits="userSpaceOnUse"><path d="M2 1L11 6L2 11L4.5 6Z"/></marker></defs>
        <path class="map-route-shadow" d="${path(0, 5)}"/>
        <path class="map-route-open" d="${path(0, 3)}"/>
        <path class="map-route-planned" d="${path(3, 5)}"/>
        ${controls.map((_, i) => `<path class="map-route-arrows${i >= 3 ? ' is-planned' : ''}" marker-end="url(#map-arrow-${name})" d="M${pair(sample(i, .52))}L${pair(sample(i, .525))}"/>`).join('')}
    </svg>`;
}
