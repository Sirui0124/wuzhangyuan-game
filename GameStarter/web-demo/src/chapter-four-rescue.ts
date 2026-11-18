import { openAISetup } from './game/ai-setup-dialog';
import { createRescueShell } from './game/rescue-shell';
import { recordChapterHistory } from './chapters/progression';
import { commandId, commandResult, isCurrentCommand, loadCommand, YILING_CAMPAIGN_KEY } from './campaign/yiling-result';
import { publishChapterResult, RESULT_KEY } from './campaign/results';
import { CinematicPlayer } from './cinematics';

const root = document.querySelector<HTMLElement>('#game-root')!;
root.dataset.chapter = 'yiling';
const url = new URL(location.href);
url.searchParams.delete('playtest');
history.replaceState(null, '', url);
const restart = url.searchParams.get('restart') === '1';
const opening = new CinematicPlayer('yiling-opening-v2.17', 'wzy-yiling-opening-v1', false, false);
const openingKey = 'yiling-retreat-and-seal';
if (restart || url.searchParams.get('intro') === '1') {
    opening.resetPlayback();
    opening.forget(openingKey);
}
if (opening.done(openingKey)) void mountChapter();
else opening.mount(root, openingKey, [{
    id: 'yiling-opening-v2.17', src: '/video/current/yiling-opening-v2.17-20261117.mp4',
    title: '夷陵撤离 · 认印托付', subtitles: '/video/subtitles/yiling-opening-v2.16-20261117.vtt',
}], 'opening', () => { void mountChapter(); });

async function resumeFormerCommand() {
    const previousKey = 'yiling-shared-campaign-v1';
    const prior = commandId(localStorage, previousKey);
    if (!prior || localStorage.getItem(YILING_CAMPAIGN_KEY) || localStorage.getItem(YILING_CAMPAIGN_KEY + ':new-game')) return;
    let session;
    try { session = await loadCommand(prior); }
    catch (error) {
        if ([404, 409].includes((error as {status: number}).status)) return;
        throw error;
    }
    if (!isCurrentCommand(session, prior) || localStorage.getItem(YILING_CAMPAIGN_KEY) || commandId(localStorage, previousKey) !== prior) return;
    for (const suffix of ['-ui', ...Object.keys(session.fronts).map(front => `-visited-${prior}-${front}`)]) {
        const value = localStorage.getItem(previousKey + suffix);
        if (value !== null) localStorage.setItem(YILING_CAMPAIGN_KEY + suffix, value);
    }
    localStorage.setItem(YILING_CAMPAIGN_KEY, JSON.stringify({id: prior, history: [prior]}));
}
async function mountChapter() {
    try { await resumeFormerCommand(); }
    catch {
        root.innerHTML = '<p role="alert">暂时读不到上次的八路营救进度。</p><button type="button">重新读取</button>';
        root.querySelector('button')!.onclick = () => { void mountChapter(); };
        return;
    }
    const askToRestart = restart && !!commandId(localStorage);
    url.searchParams.delete('intro'); url.searchParams.delete('restart');
    history.replaceState(null, '', url);
    root.innerHTML = '<iframe title="第四章 · 夷陵八路营救" allowfullscreen src="/yiling-command/index.html?campaign=1&amp;chapter=yiling" style="position:fixed;inset:0;width:100%;height:100dvh;border:0;background:#171714"></iframe>';
    const frame = root.querySelector('iframe')!;
    const shell = createRescueShell(root, frame);
    let restartPending = askToRestart;
    let pending = Promise.resolve();
    async function syncResult(id: string) {
        if (!id || commandId(localStorage) !== id) return;
        const session = await loadCommand(id);
        if (commandId(localStorage) !== id) return;
        if (!isCurrentCommand(session, id)) throw new Error('无法核对本局八路军报，请重新读取。');
        const rawLedger = localStorage.getItem(RESULT_KEY);
        if (rawLedger && !localStorage.getItem(YILING_CAMPAIGN_KEY + ':previous-result')) {
            let previous;
            try { previous = JSON.parse(rawLedger)?.yiling; }
            catch { localStorage.setItem(YILING_CAMPAIGN_KEY + ':previous-result', rawLedger); }
            if (previous?.source?.startsWith('yiling-rescue-')) localStorage.setItem(YILING_CAMPAIGN_KEY + ':previous-result', JSON.stringify(previous));
        }
        publishChapterResult(commandResult(session));
        recordChapterHistory('yiling', session.ended);
    }
    window.addEventListener('message', event => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
        const type = event.data?.type;
        if (type === 'wzy-shared-configure-ai') { openAISetup(); return; }
        if (type === 'wzy-shared-pause') { shell.open(); return; }
        if (!['wzy-shared-map', 'wzy-shared-progress'].includes(type)) return;
        const id = event.data.scenarioId || commandId(localStorage);
        pending = pending.then(async () => {
            if (id) await syncResult(id);
            if (type === 'wzy-shared-map') { location.assign('/?view=chapters'); return; }
            if (restartPending) {
                restartPending = false;
                frame.contentWindow?.postMessage({type:'wzy-shared-restart'}, location.origin);
            }
        }).catch(error => frame.contentWindow?.postMessage({type:'wzy-shared-error', message:error instanceof Error ? error.message : '进度暂时无法核实。'}, location.origin));
    });
}
