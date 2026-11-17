import { esc } from '../../game/view-common';
import type { JingzhouSession } from './session';
import { opening, aftermath, replies, ending } from './narrative';

/** Uses the same scene, dialogue and ordinary-choice markup as chapters one to three. */
export function storyView(session: JingzhouSession, state: { background: string; notice: string; isolated?: boolean }) {
    const intro = session.phase === 'intro', page = intro ? session.introPage : session.aftermathPage;
    const score = session.result?.judged ?? 0, done = !intro && page === 5, choosing = !intro && page === 1;
    const line = (intro ? opening : aftermath(score, session.reply))[page];
    const scenery = `<div class="scene-image" style="background-image:url('${esc(state.background)}')"></div><div class="scene-shade"></div>`;
    const hud = `<header class="game-hud dialogue-hud"><div class="dialogue-place"><span>荆州 · ${intro ? '关羽帐中' : '复命'}</span></div><nav aria-label="本章操作"><button data-jz="rules">规则</button><button data-jz="restart">重玩本章</button><button data-jz="map">返回舆图</button></nav></header>`;
    const notice = state.notice ? `<p class="jz-story-notice" role="status">${esc(state.notice)}</p>` : '';
    if (done) {
        const e = ending(score);
        return `<main class="game-scene chapter-ending jz-narrative" data-stage="result" data-phase="ending" data-ending="${session.result!.outcome}"><div class="ending-background" style="background-image:url('${esc(state.background)}')"></div>${hud}<div class="jz-story-content"><section class="ending-copy"><span class="ending-kicker">第五章 · 荆州</span><h1>${e.title}</h1><p>${e.text}</p><div class="ending-actions"><button data-jz="restart">重玩第五章</button><a class="ending-primary" href="/?chapter=luofengpo${state.isolated ? '&playtest=pangtong' : ''}">前往终章 · 庞统</a><a href="/?view=chapters">回到舆图</a></div></section>${notice}</div></main>`;
    }
    const action = intro && page === opening.length - 1 ? 'begin' : 'story-next';
    const body = choosing
        ? `<section class="dialogue-box scout-choice"><h2 class="dialogue-speaker">${esc(line.text)}</h2>${replies(score).map(r => `<button data-jz="story-reply" data-reply="${r.id}"><span>${esc(r.text)}</span><i aria-hidden="true">›</i></button>`).join('')}</section>`
        : `<section class="dialogue-box dialogue-advance" data-jz="${action}" tabindex="0"><span class="dialogue-speaker">${esc(line.speaker)}</span><span class="dialogue-reading"><span class="dialogue-text" id="spoken-line">${esc(line.text)}</span></span></section>`;
    return `<main class="game-scene jz-narrative" data-stage="${intro ? 'intro' : 'aftermath'}" data-phase="${choosing ? 'choice' : 'dialogue'}">${scenery}${hud}${!intro && page === 0 ? `<p class="jz-score-line" role="status">6 条军报，判断正确 ${score} 条</p>` : ''}<div class="jz-story-content">${body}${notice}</div>${choosing ? '' : `<p class="dialogue-key-hint">${action === 'begin' ? '点击开始问报' : '点击继续 · 空格'}</p>`}</main>`;
}
