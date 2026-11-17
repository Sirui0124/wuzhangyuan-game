import { acceptsChoice } from './narrative/presentation';
import { recordChapterHistory } from './chapters/progression';
import { esc } from './game/view-common';
import { frameModal } from './game-ui-panels';
import { dimensions, JingzhouSession, type Story, type Save, type Action, type Verdict, type Dimension } from './chapters/chapter-five/session';
import { jingzhouView } from './chapters/chapter-five/view';
import { understandInquiry, inquiryNotices } from './chapters/chapter-five/inquiry';
import { aiEnabled, readRuntimeMode, initializeRuntimeMode, RUNTIME_MODE_KEY } from './runtime-mode';
import { openAISetup } from './game/ai-setup-dialog';
import type { Reply } from './chapters/chapter-five/narrative';

const root = document.querySelector<HTMLElement>('#game-root')!;
const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/chapter-five.css'; document.head.append(style);
const SAVE = 'jingzhou-chapter-five-v1';
const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const restartDialog = '<p>重开后重新排列六份军报，提问次数和判断重新开始。当前记录先保留一份备份。</p><div class="jz-modal-actions"><button class="folio-button" data-jz="restart-confirm">重开本轮</button><button class="quiet-button" data-jz="cancel">继续当前一轮</button></div>';
async function start() {
    await initializeRuntimeMode();
    const response = await fetch('/story/chapter-five.reports.json');
    if (!response.ok) throw new Error('军报未载入，请刷新重试。');
    const story = await response.json() as Story;
    let background = '';
    try { const media = await (await fetch('/media/manifest.json')).json(); background = media.scenes.relay_tent || media.scenes.jieting_evening_camp || media.scenes.camp_gate || ''; } catch { /* Paper layout remains playable without scenery. */ }
    const isolated = new URLSearchParams(location.search).get('playtest') === 'reports';
    const key = isolated ? `${SAVE}:playtest:reports` : SAVE;
    let session = new JingzhouSession(story, seed()), active = '', notice = '', modal = '', pending: Action | null = null;
    let blocked = false, returnFocus = '';
    let inquiry: AbortController | null = null, draftSeed = -1, drafts: Record<string, string> = {};
    try {
        const raw = localStorage.getItem(key);
        if (raw) {
            const saved = JSON.parse(raw) as Save;
            if (saved.schemaVersion === 1 && saved.chapterId === 'jingzhou'
                && saved.contentVersion === 'jingzhou-reports-20261028-v1' && story.version === 'jingzhou-reports-20261028-v2') {
                // Changed testimony must not inherit verdicts made against the old puzzle.
                const backup = `${key}:before-story-v2`;
                if (localStorage.getItem(backup) === null) localStorage.setItem(backup, raw);
                localStorage.setItem(key, JSON.stringify(session.snapshot()));
                notice = '六份军报已改写。上一轮已备份，本轮从头开始。';
            } else session = new JingzhouSession(story, saved.seed, saved);
        }
    } catch { blocked = true; notice = '旧记录无法读取，原文件仍保留。请通过重开本轮备份后再开始。'; }
    active = session.phase === 'intro' || session.phase === 'result' ? '' : session.current || session.pending[0] || '';
    function readDrafts() {
        if (draftSeed === session.seed) return;
        draftSeed = session.seed; drafts = {};
        try {
            const saved = JSON.parse(localStorage.getItem(`${key}:drafts:${draftSeed}`) || '{}');
            for (const id of session.order) if (typeof saved?.[id] === 'string') drafts[id] = saved[id].slice(0, 300);
        } catch { /* An unreadable draft never affects the saved interview. */ }
    }
    function saveDrafts() {
        try { localStorage.setItem(`${key}:drafts:${draftSeed}`, JSON.stringify(drafts)); }
        catch { notice = '草稿暂时无法保存，离开页面前请复制。'; }
    }
    function render() {
        readDrafts();
        root.dataset.chapter = 'jingzhou'; root.dataset.activeReport = active;
        root.dataset.storyPage = String(session.phase === 'intro' ? session.introPage : session.aftermathPage);
        root.innerHTML = jingzhouView(session, { active, notice, background, isolated, draft: drafts[active] || '', busy: !!inquiry, aiEnabled: aiEnabled(readRuntimeMode()) });
        if (inquiry) root.querySelectorAll<HTMLButtonElement>('button:not([data-jz="cancel-inquiry"])').forEach(button => { button.disabled = true; });
        root.querySelector<HTMLElement>('.jz-roster nav .is-active')?.scrollIntoView({ block: 'nearest' });
        if (modal) {
            root.querySelector<HTMLElement>('main')!.inert = true;
            root.insertAdjacentHTML('beforeend', frameModal('荆州 · 帐前问报', modal, 'history'));
            root.querySelector<HTMLElement>('.game-modal')?.setAttribute('aria-modal', 'true');
            root.querySelector<HTMLElement>('.game-modal button')?.focus();
        }
    }
    function open(html: string) {
        const el = document.activeElement as HTMLElement;
        returnFocus = el?.dataset.jz || '';
        modal = html; render();
    }
    function close() { modal = ''; pending = null; render(); root.querySelector<HTMLElement>(`[data-jz="${returnFocus}"]`)?.focus(); }
    function persist(next: JingzhouSession) {
        try { localStorage.setItem(key, JSON.stringify(next.snapshot())); return true; }
        catch { notice = '进度未能保存，本次操作没有扣除次数。请释放存储空间后重试。'; render(); return false; }
    }
    function commit(action: Action) {
        if (blocked) { notice = '请先重开本轮，备份无法读取的旧记录。'; render(); return false; }
        // Read the latest round before every mutation; an older tab cannot restore spent questions.
        try {
            const raw = localStorage.getItem(key);
            if (raw && raw !== JSON.stringify(session.snapshot())) {
                const saved = JSON.parse(raw) as Save; session = new JingzhouSession(story, saved.seed, saved);
                active = session.current || session.pending[0] || ''; notice = '另一窗口已更新本轮，已载入最新进度，请重新选择操作。'; render(); return false;
            }
        } catch { notice = '当前记录无法读取，本次操作未执行。'; render(); return false; }
        const next = new JingzhouSession(story, session.seed, session.snapshot());
        if (!next.apply(action)) { notice = '当前不能执行此操作，请查看剩余次数和待命位置。'; render(); return false; }
        if (action.type === 'judge' && next.phase === 'selection') next.apply({ type: 'settle' });
        if (!persist(next)) return false;
        session = next; notice = '';
        if (action.type === 'begin' || action.type === 'judge') active = session.current || session.pending[0] || '';
        if (action.type === 'finish') active = '';
        if (!isolated) recordChapterHistory('jingzhou', !!session.result);
        render();
        if (action.type === 'ask') {
            root.querySelector('.jz-transcript')?.scrollTo({ top: 100000 });
            root.querySelector<HTMLElement>('#jz-inquiry:not(:disabled),[data-jz="judge"]')?.focus({ preventScroll: true });
        }
        return true;
    }
    async function askCustom() {
        const id = active, entry = session.entry(id), question = drafts[id]?.trim() || '';
        if (blocked || inquiry || !entry || entry.asked.length >= 3 || (id !== session.current && entry.verdict !== 'pending')) return;
        if (!question || question.length > 300) { notice = '请写下一个问题，最多300字。'; render(); return; }
        if (!aiEnabled(readRuntimeMode())) {
            const report = session.report(id);
            const preset = dimensions.find(d => ['source', 'sequence', 'evidence'].includes(d.id) && question === (report.questions?.[d.id] ?? d.question));
            if (!preset) { notice = '自定义问法需开启 AI。当前可选择上方的引导问题发送。'; render(); return; }
            if (commit({ type: 'ask', id, dimension: preset.id, question })) { drafts[id] = ''; saveDrafts(); render(); root.querySelector('.jz-transcript')?.scrollTo({ top: 100000 }); }
            return;
        }
        const before = JSON.stringify(session.snapshot()), controller = new AbortController();
        inquiry = controller; notice = ''; render();
        try {
            const reply = await understandInquiry(session.report(id), entry, question, controller.signal);
            if (inquiry !== controller || controller.signal.aborted) return;
            if (active !== id || before !== JSON.stringify(session.snapshot()) || before !== localStorage.getItem(key)) {
                notice = '本轮记录已改变，这次回答没有采用，也没有扣次数。'; return;
            }
            if (reply.kind !== 'answer') { notice = inquiryNotices[reply.kind]; return; }
            if (commit({ type: 'ask', id, dimension: reply.dimension, question })) { drafts[id] = ''; saveDrafts(); }
        } catch (error) {
            if (inquiry === controller && !controller.signal.aborted) notice = `${error instanceof Error ? error.message : '暂时无法回应，请重试。'} 问题已保留，未扣次数。`;
        } finally {
            if (inquiry === controller) {
                inquiry = null; render(); root.querySelector('.jz-transcript')?.scrollTo({ top: 100000 });
                root.querySelector<HTMLTextAreaElement>('#jz-inquiry')?.focus({ preventScroll: true });
            }
        }
    }
    function cancelInquiry() { inquiry?.abort(); inquiry = null; }
    function restart() {
        try {
            const raw = localStorage.getItem(key);
            if (raw) localStorage.setItem(`${key}:before-new`, raw);
            const fresh = new JingzhouSession(story, seed());
            if (!persist(fresh)) return;
            session = fresh; blocked = false; active = ''; notice = ''; modal = ''; pending = null; render();
        } catch { notice = '旧记录未能备份，尚未重开。'; render(); }
    }
    root.addEventListener('click', event => {
        const target = event.target as HTMLElement;
        const el = target.closest<HTMLElement>('button,a,[data-jz]') ?? (!target.closest('header,nav,input,textarea,.game-modal') ? root.querySelector<HTMLElement>('.jz-narrative .dialogue-advance') : null);
        if (!el) return;
        if (el.dataset.action === 'configure-ai') { cancelInquiry(); openAISetup(render); return; }
        if (el.dataset.action === 'close-modal' || el.dataset.action === 'close' || el.dataset.action === 'resume') { close(); return; }
        const action = el.dataset.jz;
        if (action === 'cancel-inquiry') { cancelInquiry(); notice = '已取消。问题仍保留，未扣次数。'; render(); return; }
        if (inquiry) return;
        if (modal && !['cancel', 'confirm', 'restart-confirm'].includes(action || '')) return;
        if (action === 'cancel') close();
        else if (action === 'confirm' && pending) { const a = pending; modal = ''; pending = null; commit(a); }
        else if (action === 'restart-confirm') restart();
        else if (action === 'begin') commit({ type: 'begin' });
        else if (action === 'story-next') commit({ type: 'narrate', stage: session.phase === 'intro' ? 'intro' : 'aftermath' });
        else if (action === 'story-reply' && acceptsChoice(session.decision, el.closest<HTMLElement>('[data-decision]')?.dataset.decision, el.dataset.reply ?? '')) commit({ type: 'reply', reply: el.dataset.reply as Reply });
        else if (action === 'settle') commit({ type: 'settle' });
        else if (action === 'map') location.assign('/?view=chapters');
        else if (action === 'suggest') {
            const d = dimensions.find(d => d.id === el.dataset.dimension);
            if (!d || el.dataset.id !== active || !session.canAsk(active, d.id)) return;
            drafts[active] = session.report(active).questions?.[d.id] ?? d.question;
            saveDrafts(); render(); root.querySelector<HTMLTextAreaElement>('#jz-inquiry')?.focus({ preventScroll: true });
        }
        else if (action === 'custom-ask') void askCustom();
        else if (action === 'view') { active = el.dataset.id!; notice = ''; render(); }
        else if (action === 'overview') { active = ''; render(); }
        else if (action === 'judge') {
            const verdict = el.dataset.verdict as Verdict;
            pending = { type: 'judge', id: el.dataset.id!, verdict };
            open(`<p>将${esc(session.report(el.dataset.id!).name)}的军报判为${verdict === 'true' ? '属实' : verdict === 'false' ? '不属实' : '存疑，留在待命栏'}？</p><p>${verdict === 'pending' ? '之后可使用剩余追问次数，再作判断。' : '确认后不再更改，问答仍可回看。'}</p><div class="jz-modal-actions"><button class="folio-button" data-jz="confirm">确认判断</button><button class="quiet-button" data-jz="cancel">再想一想</button></div>`);
        } else if (action === 'restart') open(restartDialog);
        else if (action === 'rules') open('<p>每人最多追问三次。引导问题只填入输入框，发送并得到回答才扣一次；重复核实也占一次，取消和服务失败不扣次数。</p><p>当场判为属实、不属实或存疑。存疑待命最多两人，可用剩余次数补问；明确判断后不能更改。六条全部定夺后，向关羽复命。</p><p>最后只告知判断正确的条数，随后的处境由这六次判断决定。</p><button class="folio-button" data-jz="cancel">继续</button>');
    });
    root.addEventListener('input', event => {
        const el = event.target as HTMLTextAreaElement;
        if (el.id === 'jz-inquiry') { drafts[active] = el.value; saveDrafts(); }
    });
    window.addEventListener('keydown', event => {
        if (!modal && !inquiry && [' ', 'Enter'].includes(event.key) && !event.repeat && !event.isComposing && !(event.target as HTMLElement).closest('button,a,input,textarea')) {
            const advance = root.querySelector<HTMLElement>('.jz-narrative .dialogue-advance');
            if (advance) { event.preventDefault(); advance.click(); return; }
        }
        if (!modal && event.target instanceof HTMLTextAreaElement && event.target.id === 'jz-inquiry' && event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); void askCustom(); }
        if (!modal) return;
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key === 'Tab') {
            const controls = Array.from(root.querySelectorAll<HTMLElement>('.game-modal button,.game-modal a[href]')).filter(el => !el.hasAttribute('disabled'));
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
    });
    window.addEventListener('storage', event => {
        if (event.key === RUNTIME_MODE_KEY) { cancelInquiry(); render(); return; }
        if (event.key !== key) return;
        cancelInquiry();
        try { const s = JSON.parse(event.newValue || 'null') as Save; session = new JingzhouSession(story, s.seed, s); active = session.current || session.pending[0] || ''; modal = ''; pending = null; notice = '本轮已更新，已同步当前进度。'; render(); }
        catch { blocked = true; notice = '本轮记录已改变，请重开本轮后继续。'; render(); }
    });
    window.addEventListener('pagehide', cancelInquiry);
    window.addEventListener('ai-settings-changed', () => { cancelInquiry(); render(); });
    if (!blocked) persist(session);
    render();
    const url = new URL(location.href);
    if (url.searchParams.get('restart') === '1') {
        url.searchParams.delete('restart'); history.replaceState(null, '', url);
        if (session.phase !== 'intro') open(restartDialog);
    }
}
start().catch(error => { root.innerHTML = `<main class="jz-error"><h1>第五章暂未载入</h1><p>${esc(error instanceof Error ? error.message : '请刷新重试。')}</p><a href="/?view=chapters">返回舆图</a></main>`; });
