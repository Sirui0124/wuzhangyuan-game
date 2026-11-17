import { composeReviewSample } from './art-review-layout';
type StyleId = 'cinnabar' | 'jade' | 'night';
type SceneId = 'thoughts' | 'expression' | 'dialogue' | 'camp';
type Samples = { viewport: { width: number; height: number }; samples: Record<SceneId, string> };
const styles: Record<StyleId, { name: string; note: string }> = {
    cinnabar: { name: 'A · 松烟朱砂', note: '最贴近现有气质。暖纸保留呼吸感，深墨承载正文，朱砂只强调推论与行动。' },
    jade: { name: 'B · 青碧铜金', note: '更鲜明的青绿层次。青墨组织线索，铜金提示推论，整体仍然明亮、克制。' },
    night: { name: 'C · 夜青鎏金', note: '更强的夜营氛围。夜青底衬月白文字，暖金突出行动，人物与营地更有存在感。' },
};
const sceneNames: Record<SceneId, string> = { thoughts: '线索推理', expression: '向魏延开口', dialogue: '人物对白', camp: '营地探索' };
const params = new URLSearchParams(location.search);
let style: StyleId = Object.hasOwn(styles, params.get('style') ?? '') ? params.get('style') as StyleId : 'cinnabar';
let scene: SceneId = Object.hasOwn(sceneNames, params.get('scene') ?? '') ? params.get('scene') as SceneId : 'thoughts';
let compare = params.get('compare') === '1', original = false;
let font = params.get('font') === 'song' ? 'song' : 'kai';
const gallery = document.querySelector<HTMLElement>('#preview-gallery')!;
const status = document.querySelector<HTMLElement>('#review-status')!;
let data: Samples;
const resize = () => {
    for (const frame of Array.from(gallery.querySelectorAll<HTMLIFrameElement>('iframe'))) {
        const host = frame.parentElement!;
        const full = document.fullscreenElement === host;
        const scale = Math.min(host.clientWidth / 1600, full ? host.clientHeight / 1000 : Infinity);
        frame.style.transform = `${full ? 'translate(-50%,-50%) ' : ''}scale(${scale})`;
    }
};
const observer = new ResizeObserver(resize);
function render() {
    observer.disconnect();
    gallery.replaceChildren();
    gallery.classList.toggle('is-comparing', compare && !original);
    for (const id of original ? ['original'] : compare ? Object.keys(styles) : [style]) {
        const item = document.createElement('figure'); item.className = 'sample';
        const caption = document.createElement('figcaption');
        caption.textContent = id === 'original' ? '原版 · 淡墨纸色' : styles[id as StyleId].name;
        const detail = document.createElement('small'); detail.textContent = sceneNames[scene] + ' / ' + (original ? '原版参考' : font === 'kai' ? '楷体 · 舒展曲线' : '宋体 · 同构图对照'); caption.append(detail);
        const host = document.createElement('div'); host.className = 'sample-window';
        const frame = document.createElement('iframe'); frame.title = `${caption.textContent}视觉样张`;
        // No game script, API request, or storage access runs inside a display sample.
        frame.setAttribute('sandbox', 'allow-same-origin'); frame.tabIndex = -1;
        const sample = id === 'original' ? data.samples[scene] : composeReviewSample(data.samples[scene], scene);
        frame.srcdoc = `<!doctype html><html lang="zh-CN" data-reduced="true" ${id === 'original' ? '' : `data-art-style="${id}" data-art-font="${font}"`}><head><meta charset="utf-8"><link rel="stylesheet" href="/game.css"><link rel="stylesheet" href="/art-review/themes.css"><link rel="stylesheet" href="/art-review/mindmap.css"><style>button{cursor:default}</style></head><body><div id="game-root" inert>${sample}</div></body></html>`;
        frame.addEventListener('load', () => {
            const doc = frame.contentDocument;
            if (doc) {
                doc.querySelectorAll<HTMLImageElement>('img').forEach(img => { img.classList.add('is-ready'); });
                doc.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(input => { input.readOnly = true; });
            }
            resize();
        });
        host.append(frame); item.append(caption, host); gallery.append(item); observer.observe(host);
    }
    document.querySelectorAll<HTMLButtonElement>('[data-style]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.style === style && !original)));
    document.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.scene === scene)));
    document.querySelector('#compare')!.setAttribute('aria-pressed', String(compare && !original));
    document.querySelector('#original')!.setAttribute('aria-pressed', String(original));
    document.querySelectorAll<HTMLButtonElement>('[data-font]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.font === font && !original)));
    document.querySelector('#direction-note')!.textContent = original ? '原版参考：相同画面、相同内容，对照文字浓度、人物可见度和行动强调。' : compare ? '三版使用同一画面。点击上方配色可切回单版大图；也可以对照原版。' : styles[style].note;
    history.replaceState(null, '', `?style=${style}&scene=${scene}&font=${font}${compare ? '&compare=1' : ''}`);
    resize();
}
document.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!target || !data) return;
    if (target.dataset.style) { style = target.dataset.style as StyleId; original = false; compare = false; }
    else if (target.dataset.font) { font = target.dataset.font; original = false; }
    else if (target.dataset.scene) scene = target.dataset.scene as SceneId;
    else if (target.id === 'compare') { compare = !compare; original = false; }
    else if (target.id === 'original') original = !original;
    else if (target.id === 'fullscreen') {
        if (compare) { compare = false; render(); }
        const host = gallery.querySelector<HTMLElement>('.sample-window');
        if (host?.requestFullscreen) void host.requestFullscreen().catch(() => { status.textContent = '当前浏览器未开启全屏，可直接在此查看大图。'; });
        else status.textContent = '当前浏览器未开启全屏，可直接在此查看大图。';
        return;
    } else return;
    render();
});
document.addEventListener('fullscreenchange', resize);
try {
    const response = await fetch('/art-review/scenes.json');
    if (!response.ok) throw new Error('Missing review samples');
    data = await response.json() as Samples;
    status.textContent = ''; render();
} catch { status.textContent = '画面样张暂未加载，请刷新后再试。'; }
export {};
