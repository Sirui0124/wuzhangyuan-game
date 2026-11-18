import { mapRouteHTML, mapNodeStyle } from '../../../game/map-route';
import { chapterOne, grainPreview, jietingChapter, yilingChapter, jingzhouChapter, pangtongChapter } from '../../catalog';
import type { ChapterSession, GameSessionState } from '../../../chapter-session';
import type { GameUIState } from '../../../game/ui-state';
import { esc, btn, type Media } from '../../../game/view-common';
import type { EndingCatalog, EndingCollection } from '../../../endings';
import type { Clip } from '../../../cinematics';
import { hasPackagedChapter } from '../../../release-profile';
import { tentEndingHTML } from './tent-visit';
import { achievementCardHTML } from '../../../achievement-card';
import { commandActionContent, mapActionContent } from '../../../game/map-action';
import { chapterAccess, chapterAccessMessage, type ChapterId } from '../../progression';
import { RESULT_KEY } from '../../../campaign/results';
import { YILING_CAMPAIGN_KEY } from '../../../campaign/yiling-result';

export function createNavigationViews(game: ChapterSession, media: Media, movies: Record<string, Clip[]>,
    stored: (key?: string) => string | null, hasCompleted: () => boolean, archive: () => { catalog: EndingCatalog; collection: EndingCollection; warning: string }, grainCompleted: () => boolean = () => false) {
    function menu() {
        return `<main class="game-menu"><div class="menu-art"></div><header><span>三国 · 叙事解谜</span><span>建兴十二年 · 秋</span></header><section><img class="game-logo" src="/main-menu-title-v02.png" alt="逆转五丈原"><p>一灯未灭，天命未定。</p><nav aria-label="主菜单">${stored() ? btn('continue', '继续这一夜 <span>↗</span>', 'menu-continue') : ''}${btn('new', '新游戏 <span>→</span>')}${btn('chapters', '回溯舆图')}${btn('save', '存档留痕')}${btn('settings', '设置')}</nav></section><footer><span>第一章 · 守住灯之后</span><a href="/video-review.html">影像回看</a><span>风起五丈原</span></footer></main>`;
    }
    function endingHTML(state: GameSessionState) {
        if (state.end === 'tent-execution') return tentEndingHTML();
        const died = state.phase === 'death';
        if (state.end === 'weiyan-execution') return `<main class="chapter-ending execution-ending"><p class="execution-transition" aria-hidden="true">军士上前，将我押离营帐。</p><div class="ending-copy"><span class="ending-kicker">交涉失败 · ${state.round === 1 ? '首轮' : '第二轮'}</span><h1>军令落下。<br>此行止于刀下。</h1><p>军士将我带走，四下归于黑暗。</p><small>回到这次交谈之前，再说一次。</small><div>${btn('retry-weiyan', '重试本轮对话 <span>↶</span>', 'ending-primary')}</div></div><footer>${btn('menu', '返回开始页')}<span>此前取得的线索${state.round === 2 ? '与姜维的承诺' : ''}保留</span></footer></main>`;
        return `<main class="chapter-ending ${died ? 'death-ending' : ''}"><div class="ending-background" style="background-image:url('${media.scenes.camp_gate}')"></div><div class="ending-copy"><span class="ending-kicker">${died ? '第一次回溯 · 转呈未竟' : '第一章 · 守住灯之后'}</span><h1>${died ? '灯还亮着。<br>你却没等到天明。' : '灯火尚在。'}</h1><p>${died ? esc(game.flow.endings.find(ending => ending.id === 'tutorial-sacrifice')!.description) : '一份军报，有人接。<br>一道命令，有人听见。'}</p>${died ? '' : '<small>「那我有办法。」</small>'}<div>${died ? btn('rewind', '回到那一片夕阳 <span>↶</span>', 'ending-primary') : btn('map', '循着时光，再往前 <span>→</span>', 'ending-primary')}${btn('chapters', '查看成就')}</div></div><footer>${btn('menu', '返回开始页')}<span>${died ? '首次死亡已记入卡册' : '本章军情与回令已完成交接'}</span></footer></main>`;
    }
    function mapHTML() {
        const access = chapterAccess(localStorage);
        const completed = access.wuzhang.completed;
        const grainDone = access.grain.completed;
        const jietingDone = access.jieting.completed;
        const yilingDone = access.yiling.completed;
        const { catalog, collection, warning } = archive();
        const unlocked = catalog.endings.filter(ending => collection.unlocked[ending.id]);
        const laterChapter = (chapter: typeof grainPreview | typeof jietingChapter | typeof yilingChapter | typeof jingzhouChapter | typeof pangtongChapter, number: string, done: boolean) => {
            if (!hasPackagedChapter(chapter.id)) return '';
            const progress = access[chapter.id];
            const locked = !progress.unlocked;
            const replay = done || progress.replayable;
            if (chapter.id === 'yiling') {
                const session = stored(YILING_CAMPAIGN_KEY);
                let finished = false;
                try {
                    const result = JSON.parse(stored(RESULT_KEY) ?? '{}')?.yiling;
                    finished = !!session && result?.status === 'completed' && result.source?.startsWith(`yiling-rescue-campaign:${session}:`);
                } catch { /* The chapter will verify the save when opened. */ }
                const label = session ? finished ? '查看本章结局' : '继续这一章' : '开始这一章';
                return `<section class="map-chapter next" data-map-node="yiling" aria-label="夷陵${progress.earlyAccess ? '，抢先体验' : ''}" style="${mapNodeStyle(chapter)}"><small>第四章${done ? ' · 已通关' : ''}</small><div class="map-chapter-heading"><h2>${esc(chapter.mapTitle)}</h2>${progress.earlyAccess ? '<small class="map-early-access">抢先体验</small>' : ''}</div><a class="chapter-prefix-link map-chapter-action" href="/?chapter=yiling">${commandActionContent(label)}</a></section>`;
            }
            const continueFinale = chapter.id === 'luofengpo' && !!stored('luofengpo-chapter-seven-v1');
            const trial = ''; 
            return `<section class="map-chapter ${locked ? 'locked' : 'next'}" data-map-node="${chapter.id}" aria-label="${chapter.mapTitle}${locked ? '，未解锁' : ''}" style="${mapNodeStyle(chapter)}"><small>${locked ? '未解锁' : `第${number}章${done ? ' · 已通关' : replay ? ' · 已解锁' : ''}`}</small><h2>${esc(chapter.mapTitle)}</h2>${locked ? `<small class="map-lock-hint">${esc(chapterAccessMessage(chapter.id))}</small>${trial}` : ` ${continueFinale ? '<a class="chapter-prefix-link map-chapter-action" href="/?chapter=luofengpo">继续这一程</a>' : ''}<a class="chapter-prefix-link map-chapter-action" href="/?chapter=${chapter.id}${replay ? '&restart=1' : ''}">${mapActionContent(replay)}</a>`}</section>`;
        };
        const blocked = new URLSearchParams(location.search).get('locked') as ChapterId | null;
        const accessNotice = blocked && access[blocked] && !access[blocked].unlocked ? chapterAccessMessage(blocked) : '';
        return `<main class="chapter-map archive-map">
          <header><h1>回溯舆图</h1>${accessNotice ? `<p class="map-access-notice" role="status">${esc(accessNotice)}</p>` : ''}${btn('menu', '返回开始页')}</header>
          <div class="map-archive-layout">
            <section class="map-stage" aria-label="章节舆图">
              <div class="map-art"></div>
              ${mapRouteHTML()}${mapRouteHTML(true)}
              <section class="map-chapter first" data-map-node="wuzhang" style="${mapNodeStyle(chapterOne)}"><small>${completed || access.wuzhang.completed ? '第一章 · 已通关' : access.wuzhang.replayable ? '第一章 · 已解锁' : '第一章'}</small><h2>${esc(chapterOne.mapTitle)}</h2>${btn(completed || access.wuzhang.replayable ? 'replay-first' : stored() ? 'continue' : 'start-first', mapActionContent(completed || access.wuzhang.replayable), 'map-chapter-action')}</section>
              ${laterChapter(grainPreview, '二', grainDone || access.grain.completed)}
              ${laterChapter(jietingChapter, '三', jietingDone || access.jieting.completed)}
              ${laterChapter(yilingChapter, '四', yilingDone || access.yiling.completed)}
              ${laterChapter(jingzhouChapter, '五', access.jingzhou.completed)}
              ${laterChapter(pangtongChapter, '七', access.luofengpo.completed)}
            </section>
            <aside class="achievement-archive" aria-labelledby="achievement-title">
              <header><h2 id="achievement-title">成就档案</h2><button class="archive-browse" data-action="achievements">全部卡册 <span>${unlocked.length} / ${catalog.endings.length}</span> ↗</button></header>
              ${warning ? `<p class="archive-warning" role="status">${esc(warning)}</p>` : ''}
              <div class="achievement-shelf">${unlocked.length ? unlocked.map(ending => `<button class="achievement-card" data-action="achievement" data-achievement-id="${esc(ending.id)}" aria-label="查看成就：${esc(ending.title)}" aria-haspopup="dialog">${achievementCardHTML(ending)}</button>`).join('') : '<div class="archive-empty"><span aria-hidden="true">卷</span><p>尚未解锁成就</p><small>调查、相遇与结局，都会在这里留下档案。</small></div>'}</div>
            </aside>
          </div>
        </main>`;
    }
    return { menu, endingHTML, mapHTML };
}
