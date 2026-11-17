import { esc } from '../../game/view-common';
import { dimensions, JingzhouSession } from './session';
import { storyView } from './story-view';
import { aiGuidanceHTML } from '../../game/ai-guidance';

export type ViewState = { active: string; notice: string; background: string; draft?: string; busy?: boolean; aiEnabled?: boolean; isolated?: boolean };
const verdictNames = { true: '判为属实', false: '判为不实', pending: '存疑待命' };
const button = (action: string, label: string, extra = '') => `<button type="button" data-jz="${action}" ${extra}>${label}</button>`;
function roster(session: JingzhouSession, active: string) {
    const item = (id: string) => {
        const r = session.report(id), e = session.entry(id)!;
        const available = !!e.verdict || session.current === id;
        return button('view', `<span>${esc(available ? r.name : '尚未入帐')}</span><small>${available ? e.verdict ? verdictNames[e.verdict] : '正在核问' : '等候传报'}</small>`,
            `data-id="${id}" class="jz-person ${active === id ? 'is-active' : ''}" ${available ? '' : 'disabled'} aria-pressed="${active === id}"`);
    };
    return `<aside class="jz-roster"><h2>军报 <small>${session.order.filter(id => session.entry(id)!.verdict !== null).length} / 6</small></h2>
        <nav aria-label="已接见的士兵">${session.order.filter(id => !session.pending.includes(id)).map(item).join('')}</nav>
        ${session.pending.length ? `<section class="jz-pending" aria-label="存疑待命"><h2>待命</h2>${session.pending.map(item).join('')}</section>` : ''}</aside>`;
}
function interview(session: JingzhouSession, active: string, state: ViewState) {
    const r = session.report(active), e = session.entry(active)!;
    const editable = session.current === active || e.verdict === 'pending';
    const npc = (text: string, opening = false) => `<div class="jz-message jz-message-npc"><span class="jz-message-name">${esc(r.name)}</span><p class="dialogue-text${opening ? ' jz-opening' : ''}">${esc(text)}</p></div>`;
    const records = e.turns.map(({ dimension: d, question }) => `<section class="jz-exchange"><div class="jz-message jz-message-player"><p class="jz-question dialogue-text">我 · ${esc(question ?? r.questions?.[d] ?? dimensions.find(x => x.id === d)!.question)}</p></div>${npc(r.answers[d])}</section>`).join('');
    const slots = 2 - session.pending.length;
    const navigation = session.current && session.current !== active ? button('view', '返回当前军报', `data-id="${session.current}"`) : !session.current ? button('overview', session.pending.length ? '待命名单' : '返回复命') : '';
    return `<article class="jz-report"><header class="jz-report-heading"><div><h1 class="dialogue-speaker">${esc(r.name)}</h1><span class="jz-kicker">${esc(r.role)} · ${esc(r.title)}</span></div><div class="jz-report-meta"><span class="jz-question-count">${editable ? `还可追问 ${3 - e.asked.length} 次` : verdictNames[e.verdict as keyof typeof verdictNames]}</span>${navigation}</div></header>
        <div class="jz-transcript" tabindex="0" aria-label="${esc(r.name)}的军报与问答">${npc(r.opening, true)}${records}</div>
        ${editable ? `<div class="jz-ask-tools${e.asked.length >= 3 ? ' is-exhausted' : ''}"><div class="scout-choice jz-questions" aria-label="便捷填入问题">${dimensions.filter(d => ['source', 'sequence', 'evidence'].includes(d.id)).map(d => button('suggest', esc(r.questions?.[d.id] ?? d.question), `data-id="${r.id}" data-dimension="${d.id}" title="${d.label}" ${e.asked.length >= 3 ? 'disabled' : ''}`)).join('')}</div>
        <div class="jz-composer"><label for="jz-inquiry">自己追问</label><textarea id="jz-inquiry" rows="2" maxlength="300" placeholder="写下想问他的话……" ${state.busy || e.asked.length >= 3 ? 'disabled' : ''}>${esc(state.draft ?? '')}</textarea><div class="jz-compose-actions">${state.busy ? button('cancel-inquiry', '取消等待') : button('custom-ask', '追问', `data-id="${r.id}" ${e.asked.length >= 3 ? 'disabled' : ''}`)}</div></div>
        ${state.busy ? '<p class="jz-note jz-inquiry-hint" role="status">正在理解问题……</p>' : aiGuidanceHTML('inquiry', state.aiEnabled !== false)}</div>
        <footer class="jz-verdict"><h2>是否属实？</h2><div class="scout-choice">${button('judge', '属实', `data-id="${r.id}" data-verdict="true"`)}${button('judge', '不属实', `data-id="${r.id}" data-verdict="false"`)}${e.verdict !== 'pending' ? button('judge', `存疑待命 <small>${slots > 0 ? `剩 ${slots} 个空位` : '已满 · 0 个空位'}</small>`, `data-id="${r.id}" data-verdict="pending" ${slots === 0 ? 'disabled' : ''}`) : `<span class="jz-pending-state">已在待命栏 · 剩 ${slots} 个空位</span>`}</div></footer>
        ${slots === 0 && e.verdict !== 'pending' ? '<p class="jz-note jz-capacity-note">待命已满，可先从左侧选一人作出判断。</p>' : ''}` : `<p class="jz-note jz-readonly">${e.verdict ? verdictNames[e.verdict] : ''} · 可回看问答，不能更改判断。</p>`}
        </article>`;
}
function selection(session: JingzhouSession) {
    return `<section class="jz-selection"><h1>${session.pending.length ? '还有军报需要定夺' : '六条军报已问完'}</h1><p class="dialogue-text">${session.pending.length ? '点开左侧待命者，用剩余的追问次数问清，再作判断。' : '关羽还在帐中等候，去向他复命。'}</p>${session.pending.length ? '' : button('settle', '向关羽复命')}</section>`;
}
export function jingzhouView(session: JingzhouSession, state: ViewState) {
    if (session.phase === 'intro' || session.phase === 'result') return storyView(session, state);
    const body = `<div class="jz-workspace">${roster(session, state.active)}${state.active ? interview(session, state.active, state) : selection(session)}</div>`;
    return `<main class="game-scene jz-scene" data-stage="${session.phase}" style="--jz-background:url('${esc(state.background)}')"><header class="jz-header"><a href="/?view=chapters">荆州 · 帐前问报</a><nav aria-label="本章操作">${button('rules', '规则')}${button('restart', '重开本轮')}<a href="/?view=chapters">返回舆图</a></nav></header>${body}<p class="jz-status" role="status" aria-live="polite">${esc(state.notice)}</p></main>`;
}
