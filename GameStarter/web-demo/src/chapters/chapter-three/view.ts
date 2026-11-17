import { portraitStage } from '../../game/portrait-stage';
import type { JietingSession } from './session';
import { esc, btn, personName, type Media } from '../../game/view-common';
import { jietingExpression } from './expression-view';
import { itemSystemEnabled } from '../../runtime-mode';
import { sceneNames, speakerPortrait, sceneImage } from './presentation';
import { deploymentAxisHTML } from './deployment-view';
import { aiGuidanceHTML } from '../../game/ai-guidance';

export type JietingViewState = { busy: boolean; error: string; online: boolean; phone: boolean; changedScene: boolean; readingText?: string; polishing?: boolean; questioning?: boolean; canUndoPolish?: boolean; retryAction?: 'polish' | 'speak' | 'question'; picker?: 'notes' | 'items'; detail?: string; previousBelow?: number };
export function jietingView(s: JietingSession, media: Media, v: JietingViewState) {
    const n = s.current, feedback = s.feedback;
    const expression = n.kind === 'open' && !feedback;
    const background = n.scene === 'jieting_masu_tent' && s.state.supplies.worldItems?.acquired.includes('fuhu-wood-tiger')
        ? media.scenes.jieting_masu_tent_after_gift ?? sceneImage(media, n.scene) : sceneImage(media, n.scene);
    const hud = `<header class="game-hud dialogue-hud"><div class="dialogue-place"><span>街亭 · ${esc(sceneNames[n.scene])}</span></div><nav>${n.act > 1 ? btn('situation', '军情') : ''}${itemSystemEnabled() ? btn('bag', '物品') : ''}${btn('records', '记录')}${btn('save', '存档')}${btn('pause', '菜单')}</nav></header>`;
    const speaker = feedback?.speaker ?? n.speaker;
    const portrait = speakerPortrait[speaker] ?? (n.scene === 'jieting_masu_tent' && n.kind !== 'ending' ? 'masu' : n.scene === 'jieting_wangping_camp' && n.kind !== 'ending' ? 'wangping' : '');
    const pair = n.scene === 'jieting_camp' && ['马谡', '王平'].includes(speaker);
    const art = (id: string, active = true) => media.characters[id] ? `<img data-character="${esc(id)}" class="character-art ${active ? 'is-speaking' : 'is-listening'}" src="${esc(media.characters[id])}" alt="${id === 'masu' ? '马谡' : id === 'wangping' ? '王平' : esc(speaker)}" draggable="false">` : '';
    const portraits = pair ? `<div class="jieting-pair">${art('wangping', speaker === '王平')}${art('masu', speaker === '马谡')}</div>` : portrait ? portraitStage(art(portrait)) : '';
    const base = `<div class="scene-image" style="background-image:url('${esc(background)}')"></div><div class="scene-shade"></div>`;
    if (n.kind === 'ending') {
        const ending = s.story.endings.find(e => e.id === n.ending)!;
        return `<main class="chapter-ending jieting-ending ${ending.success ? 'jieting-success' : 'death-ending'}"><div class="ending-background" style="background-image:url('${esc(background)}')"></div>${hud}<section class="ending-copy"><span class="ending-kicker">第三章 · ${ending.success ? '成功结局' : '失败结局'}</span><h1>${esc(ending.title)}</h1><p>${esc(ending.description)}</p><div>${ending.success ? btn('onward', '继续前行 →', 'ending-primary') : btn('retry', '回到这次抉择前 ↶', 'ending-primary')}${btn('records', '回看这一程')}</div></section><footer>${btn('menu', '返回开始页')}${btn('restart', '重玩第三章')}</footer></main>`;
    }
    if (expression && v.online) return jietingExpression(s, v, hud, background);
    const choice = !feedback && (n.kind === 'choice' || expression);
    const body = choice ? `<section class="dialogue-box scout-choice">${n.text ? `<h2 class="dialogue-speaker">${esc(n.text)}</h2>` : ''}${s.options.map(o => `<button data-option="${esc(o.id)}"><span>${esc(o.text)}</span><i>›</i></button>`).join('')}</section>` : `<section class="dialogue-box dialogue-advance" tabindex="0" data-action="next"><span class="dialogue-speaker">${esc(personName(speaker))}</span><span class="dialogue-reading"><span class="dialogue-text" id="spoken-line">${esc(feedback?.text ?? v.readingText ?? n.text)}</span></span></section><p class="dialogue-key-hint">${feedback?.followup ? '继续回答 · 空格' : '点击继续 · 空格'}</p>`;
    const axis = deploymentAxisHTML(s, v.previousBelow);
    const guidance = !v.online && (/^JT-R[1-5]-FIXED$/.test(n.id) || expression) ? aiGuidanceHTML('jieting', false) : '';
    const content = guidance ? body.replace('</section>', guidance + '</section>') : body;
    return `<main class="game-scene jieting-scene ${axis ? 'has-deployment ' : ''}${v.changedScene ? 'jieting-scene-enter' : ''}" data-phase="${choice ? 'choice' : 'dialogue'}" data-scene="${n.scene}">${base}${hud}${portraits}${axis}${content}${v.error ? `<p class="jieting-status" role="status">${esc(v.error)}</p>` : ''}</main>`;
}
