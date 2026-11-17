import { portraitStage } from '../../../game/portrait-stage';

import type { ChapterSession, GameSessionState } from '../../../chapter-session';
import type { GameUIState } from '../../../game/ui-state';
import { esc, btn, personName, createPortrait, type Media } from '../../../game/view-common';
import type { ChapterFlow } from '../../../../../../content/schema/chapter-session';
import { collectionAt } from '../../../thought-canvas-model';
import { characterId as personId, characterMood } from '../../../character-art';
import { canListenAtTent } from '../tent-visit';
import { tentSceneHTML } from './tent-visit';

/** First-chapter scene presentation. Its row IDs and character staging are chapter-specific. */
export function createSceneViews(game: ChapterSession, flow: ChapterFlow, media: Media, ui: GameUIState, voiceEnabled: () => boolean) {
    const portrait = createPortrait(media);
    function hud(state: GameSessionState, light = false) {
        if (light && state.phase !== 'expression' && state.notesPurpose !== 'P2') return `<header class="game-hud light-hud thought-hud"><div class="game-mark">思绪</div><nav aria-label="思绪菜单">${btn('pause', '菜单')}</nav></header>`;
        if (['dialogue', 'reply', 'choice', 'thought-prompt', 'spoken', 'expression'].includes(state.phase) || state.notesPurpose === 'P2') return `<header class="game-hud dialogue-hud"><div class="dialogue-place"><span>${esc(game.scene.title)}</span><small>${state.round === 1 ? '第六夜' : '再临第六夜'}</small></div><nav aria-label="游戏菜单">${btn('records', '记录')}${btn('save', '存档')}${btn('pause', '菜单')}</nav></header>`;
        return `<header class="game-hud ${light ? 'light-hud' : ''}"><div class="game-mark"><span class="chapter-seal">壹</span><div>逆转五丈原<small>五丈原 · ${state.round === 1 ? '第六夜' : '再临第六夜'}</small></div></div><nav aria-label="游戏菜单">${btn('records', '记录')}${btn('save', '存档')}${btn('pause', '菜单')}</nav></header>`;
    }
    function sceneHTML(state: GameSessionState) {
        if (state.phase === 'tent') return tentSceneHTML(state, media, hud({ ...state, phase: 'dialogue' }));
        const row = state.phase === 'reply' ? game.currentReply() : game.row();
        const scoutChoice = state.phase === 'choice';
        const character = state.phase === 'spoken' ? 'weiyan' : scoutChoice ? '' : row ? personId(row.speaker) : '';
        const background = scoutChoice ? media.scenes.scout_report_end : row?.speaker === '告示' ? media.scenes.notice_front : media.scenes[state.scene] ?? media.scenes.camp_gate;
        const actions = game.actions();
        const gain = state.phase === 'dialogue' && row && collectionAt[row.id] && !state.story.collected.includes(collectionAt[row.id]);
        const dialogueCue = state.phase === 'reply' && state.speech?.result !== 'execute' ? '重新组织' : '继续';
        return `<main class="game-scene" data-phase="${state.phase}" data-scene="${state.scene}"><div class="scene-image" style="background-image:url('${background}')"></div><div class="scene-shade"></div>${hud(state)}${character ? portraitStage(portrait(character, '', state.phase === 'spoken' ? 'alert' : characterMood(character, row?.id))) : ''}${state.phase === 'choice' ? `<section class="dialogue-box scout-choice" aria-label="选择要问斥候的话"><h2 class="dialogue-speaker">向斥候问清</h2><button data-scout-choice="a"><span>${esc(game.sourceRow('A-23')!.text)}</span><i aria-hidden="true">›</i></button><button data-scout-choice="b"><span>${esc(game.sourceRow('A-23B')!.text)}</span><i aria-hidden="true">›</i></button></section>` : ''}${state.phase === 'thought-prompt' ? `<section class="dialogue-box scout-choice thought-entry-choice" aria-label="开始思考"><button data-action="begin-thinking"><span>让我想一想</span><i aria-hidden="true">›</i></button></section>` : ''}${state.phase === 'explore' ? `<div class="scene-hotspots">${canListenAtTent(state) ? `<button class="scene-hotspot" data-tent="listen"><i></i><span>${state.tent === 'heard' ? '到帐篷侧面听一听' : '听帐篷里的声音'}</span></button>` : ''}${actions.map(action => `<button class="scene-hotspot" data-scene-action="${action.id}" style="left:${action.x}%;top:${action.y}%" aria-label="${esc(action.label)}"><i></i><span>${esc(action.label)}</span><small>${esc(game.actionState(action.id).reason || action.description)}</small></button>`).join('')}${!actions.length && state.scene !== 'jiangwei_tent_front' && state.scene !== 'report_post' ? `<div class="quiet-scene">${esc(game.scene.description)}</div>` : ''}</div><nav class="scene-routes" aria-label="营地地点">${flow.scenes.map(scene => `<button data-move="${scene.id}" aria-current="${state.scene === scene.id ? 'location' : 'false'}">${esc(scene.title)}</button>`).join('')}</nav>${state.round === 2 && state.finishedSections.includes('scout-investigation') && !state.finishedSections.includes('jiang-commitment') ? `<button class="open-thought-callout" data-action="notes"><span>思绪渐起</span>整理这一夜的见闻 <i>↗</i></button>` : ''}` : ''}${row ? `<section class="dialogue-box dialogue-advance" tabindex="0" aria-label="${esc(personName(row.speaker))}：${esc(row.text)}（点击屏幕${dialogueCue}）"><span class="dialogue-speaker"><span>${esc(personName(row.speaker))}</span></span><span class="dialogue-reading"><span class="dialogue-text ${gain ? 'has-clue' : ''}"><span id="spoken-line">${esc(row.text)}</span></span></span></section>` : ''}${row ? `<p class="dialogue-key-hint" aria-hidden="true">${'点击屏幕' + dialogueCue} · 空格</p>` : ''}${state.phase === 'spoken' && state.speech ? speechHTML(state) : ''}<div id="game-notice" class="game-notice " role="status" aria-live="polite">${esc(ui.notice || ui.storageWarning)}</div></main>`;
    }
    function speechHTML(state: GameSessionState) {
        const speech = state.speech!;
        const waiting = speech.status === 'waiting';
        const status = waiting ? '魏延正在回应'
            : speech.status === 'cancelled' ? '已停止等待，原话和依据已保留。'
            : speech.status === 'failed' ? '这次未能取得回应，原话和依据已保留。'
            : voiceEnabled() ? '我的话说完后，魏延将接话' : '魏延即将回应';
        const controls = speech.status === 'ready' ? (voiceEnabled() ? btn('reveal-reply', '略过我的配音') : '')
            : waiting ? btn('cancel-speech', '停止等待')
            : `${btn('retry-speech', '重试回应')}${btn('revise', '重新组织')}`;
        return `<section class="dialogue-box speech-box" data-speech-status="${speech.status}" tabindex="0" aria-label="我已经说出的话"><div class="dialogue-speaker"><span>我</span></div><p class="said-text">${esc(speech.text)}</p><div class="dialogue-foot speech-feedback"><span class="speech-response-status" role="status" aria-live="polite" aria-atomic="true">${waiting ? '<span class="response-dots" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}<span>${status}</span></span><div class="speech-controls">${controls}</div></div></section>`;
    }
    return { hud, sceneHTML };
}

