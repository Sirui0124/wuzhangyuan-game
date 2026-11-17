import { narrativeChoiceHTML } from '../../game/narrative-choice';
import { portraitStage } from '../../game/portrait-stage';
import { btn,esc,personName,type Media } from '../../game/view-common';
import type { PangtongSession } from './session';
const places:Record<string,string>={luocheng_archive:'文书帐',luocheng_tent:'军师帐中',luocheng_gate:'安置处',pangtong_retreat:'山中',pangtong_future:'后世'};
export function pangtongView(s:PangtongSession,media:Media,notice='',isolated=false) {
    const n=s.current,e=s.ending,bg=media.scenes[n.scene]??'';
    const scenery=`<div class="scene-image" style="background-image:url('${esc(bg)}')"></div><div class="scene-shade"></div>`;
    const hud=`<header class="game-hud dialogue-hud"><div class="dialogue-place"><span>庞统 · ${esc(places[n.scene])}</span></div><nav aria-label="本章操作">${btn('history','前尘')}${btn('records','记录')}${btn('save','存档')}${btn('pause','菜单')}</nav></header>`;
    const status=notice?`<p class="pt-status" role="status">${esc(notice)}</p>`:'';
    if(e)return `<main class="game-scene chapter-ending pt-scene pt-ending" data-phase="ending" data-ending="${e.id}" data-node="${n.id}">${scenery}${hud}<div class="pt-ending-scroll"><section class="ending-copy"><span class="ending-kicker">第七章 · ${e.kind==='investigation'?'调查未竟':isolated?'结局试玩':'此行的结局'}</span><h1>${esc(e.title)}</h1><p>${esc(e.description)}</p><div class="pt-actions">${btn('retry',e.kind==='investigation'?'回到这次判断前':'重谈最后一场', 'ending-primary')}${e.kind==='complete'&&!isolated?btn('album','查看终章卡册'):''}${btn('map','返回舆图')}${e.kind==='complete'?btn('home','返回开始页'):''}${btn('restart','重玩第七章')}</div></section></div>${status}</main>`;
    const art=n.portrait&&media.characters[n.portrait]?portraitStage(`<img class="character-art" data-character="${esc(n.portrait)}" src="${esc(media.characters[n.portrait])}" alt="${n.portrait==='pangtong'?'庞统':'陈简'}" draggable="false">`):'';
    const body=n.kind==='choice'?narrativeChoiceHTML(s.decision!, 'data-option'):`<section class="dialogue-box dialogue-advance" tabindex="0" data-action="next"><span class="dialogue-speaker">${esc(personName(n.speaker))}</span><span class="dialogue-reading"><span class="dialogue-text" id="spoken-line">${esc(n.text)}</span></span></section><p class="dialogue-key-hint">点击继续 · 空格</p>`;
    return `<main class="game-scene pt-scene" data-phase="${n.kind==='choice'?'choice':'dialogue'}" data-scene="${n.scene}" data-node="${n.id}">${scenery}${hud}${art}${body}${status}</main>`;
}
export function campaignPanel(s:PangtongSession) {
    return `<div class="pt-history"><p>以下是这一程开始时记下的经历。重试沿用这些经历，重玩本章时重新读取。</p>${s.history.results.map(r=>`<article><h3>${esc(r.title)}</h3><p>${esc(r.detail)}</p>${r.people.map(p=>`<p>${esc(p.detail)}</p>`).join('')}${r.rescued!==null?`<p>实际归队 ${r.rescued} 人${r.missing!==null?`，途中未归 ${r.missing} 人（不能据此判为死亡）`:''}。</p>`:''}</article>`).join('')}</div>`;
}
