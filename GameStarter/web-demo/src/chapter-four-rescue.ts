import { createRescueShell } from './game/rescue-shell';
import { chapterAccess, recordChapterHistory } from './chapters/progression';
import { adoptedYilingResult, YILING_CAMPAIGN_KEY } from './campaign/yiling-result';
import { emptyResult, publishChapterResult } from './campaign/results';
import { openAISetup } from './game/ai-setup-dialog';
import { CinematicPlayer } from './cinematics';

const root = document.querySelector<HTMLElement>('#game-root')!;
root.dataset.chapter = 'yiling';
const earlyAccess = chapterAccess(localStorage).yiling.earlyAccess;
const commandMap = new URLSearchParams(location.search).get('playtest') === 'command';
// Keep map/session startup behind the film so no game audio or mutations run underneath it.
const opening = new CinematicPlayer('yiling-opening-v2.17', 'wzy-yiling-opening-v1', false, false);
const openingKey = 'yiling-retreat-and-seal';
const params = new URLSearchParams(location.search);
if (params.get('restart') === '1' || params.get('intro') === '1') {
    opening.resetPlayback();
    opening.forget(openingKey);
}
if (opening.done(openingKey)) mountChapter();
else opening.mount(root, openingKey, [{
    id: 'yiling-opening-v2.17',
    src: '/video/current/yiling-opening-v2.17-20261117.mp4',
    title: '夷陵撤离 · 认印托付',
}], 'opening', () => {
    const url = new URL(location.href);
    url.searchParams.delete('intro');
    history.replaceState(null, '', url);
    mountChapter();
});

function mountChapter() {
    root.innerHTML = commandMap
        ? '<iframe title="第四章 · 前线军令" src="/yiling-command/index.html?campaign=1" style="position:fixed;inset:0;width:100%;height:100dvh;border:0;background:#171714"></iframe>'
        : `<iframe title="第四章 · 夷陵归路" src="/yiling-rescue/index.html?campaign=1${earlyAccess ? '&early=1' : ''}" style="position:fixed;inset:0;width:100%;height:100dvh;border:0;background:#171714"></iframe>`;
    const frame = root.querySelector('iframe')!;
    if (!commandMap) {
        const link = document.createElement('a');link.href='/?chapter=yiling&playtest=command';link.textContent='前线军令 · 三路试玩';
        link.style.cssText='position:fixed;right:18px;bottom:12px;z-index:10;padding:8px 14px;border:1px solid #a58a58;background:#302a22;color:#e3c995;font-size:14px;text-decoration:none';root.append(link);
    }
    const shell = createRescueShell(root, frame);
    async function showAIStatus() {
        let configured = false;
        try { const response = await fetch('/api/yiling-rescue/health', { cache: 'no-store' }); configured = response.ok && (await response.json()).configured === true; } catch { /* Keep configuration guidance available. */ }
        root.querySelector('.rescue-ai-guide')?.remove();
        if (configured) return;
        const guide = document.createElement('aside'); guide.className = 'rescue-ai-guide';
        guide.innerHTML = '<p>夷陵的自由问讯、军令核对与军报需要 AI Token。未配置时可以查看营地，提交军令前请先配置。</p><button type="button">配置 AI Token</button>';
        guide.querySelector('button')!.addEventListener('click', () => openAISetup(() => { void showAIStatus(); }));
        root.append(guide);
    }
    if (!commandMap) void showAIStatus();
    let pending = Promise.resolve();
    async function syncResult() {
        const id = localStorage.getItem(YILING_CAMPAIGN_KEY);
        if (!id) return false;
        const response = await fetch('/api/yiling-rescue/state?session=' + encodeURIComponent(id));
        if (!response.ok) throw new Error('营救进度尚未核实，请重试。');
        const { state } = await response.json();
        if (id !== localStorage.getItem(YILING_CAMPAIGN_KEY) || state.id !== id) return false;
        const finished = state.phase === 'ended';
        const result = finished ? { ...adoptedYilingResult(state), ending: 'multi-route-rescue',
            detail: '夷陵十二时辰营救已结束，各路结果按本轮军报记录。' } : emptyResult('yiling', 'in-progress');
        result.source = `yiling-rescue-campaign:${id}:${state.revision}`;
        publishChapterResult(result);
        recordChapterHistory('yiling', finished);
        return finished;
    }
    window.addEventListener('message', event => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
        const type = event.data?.type;
        if (commandMap) {
            // This scenario covers three fronts. Never publish it as a completed nine-route chapter.
            if (type === 'wzy-shared-map') location.assign('/?view=chapters');
            if (type === 'wzy-shared-next') location.assign('/?chapter=yiling');
            return;
        }
        if (type === 'wzy-rescue-pause') { shell.open(); return; }
        if (!['wzy-rescue-progress', 'wzy-rescue-next', 'wzy-rescue-map', 'wzy-rescue-ready'].includes(type)) return;
        pending = pending.then(async () => {
            if (type === 'wzy-rescue-map') { location.assign('/?view=chapters'); return; }
            const finished = await syncResult();
            if (type === 'wzy-rescue-next') {
                if (!finished) throw new Error('请先完成本轮营救结算。');
                if (!chapterAccess(localStorage).jingzhou.unlocked) { location.assign('/?view=chapters'); return; }
                location.assign('/?chapter=jingzhou');
            }
            if (type === 'wzy-rescue-ready') {
                const url = new URL(location.href);
                if (url.searchParams.get('restart') === '1') {
                    url.searchParams.delete('restart'); history.replaceState(null, '', url);
                    if (localStorage.getItem(YILING_CAMPAIGN_KEY)) frame.contentWindow?.postMessage({ type: 'wzy-rescue-restart' }, location.origin);
                }
            }
        }).catch(error => frame.contentWindow?.postMessage({ type: 'wzy-rescue-error', message: error instanceof Error ? error.message : '记录未能保存，请重试。' }, location.origin));
    });
}
