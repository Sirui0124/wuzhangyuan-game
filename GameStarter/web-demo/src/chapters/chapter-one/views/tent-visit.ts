import type { GameSessionState } from '../session-state';
import { tentEnding, tentLines } from '../tent-visit';
import { esc, btn, type Media } from '../../../game/view-common';

export function tentSceneHTML(state: GameSessionState, media: Media, header: string) {
    const stage = state.tent as keyof typeof tentLines;
    const choosing = stage === 'side' || stage === 'footsteps';
    const background = stage === 'cough' ? media.scenes.camp_gate : media.scenes.tent_side;
    return `<main class="game-scene" data-phase="${choosing ? 'choice' : 'dialogue'}" data-scene="tent-${stage}">
      <div class="scene-image" style="background-image:url('${background}');background-size:cover"></div><div class="scene-shade"></div>${header}
      <section class="dialogue-box ${choosing ? 'scout-choice' : 'dialogue-advance'}" tabindex="0">
        <span class="dialogue-speaker">${stage === 'caught' ? '军士' : '我'}</span>
        <span class="dialogue-reading"><span class="dialogue-text">${esc(tentLines[stage])}</span></span>
        ${choosing ? `<button data-tent="continue"><span>${stage === 'side' ? '继续到帐篷右面听一听' : '再去后面听一听'}</span><i aria-hidden="true">›</i></button><button data-tent="leave"><span>离开</span><i aria-hidden="true">›</i></button>` : ''}
      </section>${choosing ? '' : '<p class="dialogue-key-hint">点击屏幕继续 · 空格</p>'}
    </main>`;
}

export function tentEndingHTML() {
    const title = tentEnding.title.split('，').map((part, i, parts) => `<span>${esc(part)}${i < parts.length - 1 ? '，' : ''}</span>`).join('');
    return `<main class="chapter-ending execution-ending tent-ending"><div class="ending-copy">
      <span class="ending-kicker">成就解锁</span><h1 class="tent-ending-title" aria-label="${esc(tentEnding.title)}">${title}</h1>
      <p>${esc(tentEnding.description)}</p>
      <div class="tent-ending-actions"><button class="ending-primary" data-tent="retry">回到偷听前 ↶</button>${btn('chapters', '查看成就')}</div>
      </div><footer>${btn('menu', '返回开始页')}</footer></main>`;
}
