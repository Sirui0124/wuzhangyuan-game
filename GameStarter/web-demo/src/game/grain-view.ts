import { narrativeChoiceHTML } from './narrative-choice';
import { expressionHeadingHTML, expressionPaperHTML } from './expression-view';
import { portraitStage } from './portrait-stage';
import { esc, btn, personName, type Media } from './view-common';

import type { GrainSession } from '../chapters/chapter-two/session';
import { materialAppearance } from '../chapters/chapter-two/materials';
import { materialView } from './material-view';
import { grainReplyStill } from './grain-dialogue-camera';
export function grainView(s: GrainSession, media: Media, v: {notes:boolean;editing:boolean;busy:boolean;error:string;polishing?:boolean;canUndoPolish?:boolean;detail?:string}) {
    const n=s.current, j=s.state.judgments[n.id], expression=n.kind==='open'&&(!j||v.editing);
    const records=/^CH2-LY02-(010|011|012|013|014|015|ACT01)$/.test(n.id)||/^CH2-LY04-/.test(n.id)||['UI-GRAIN-FLOW','UI-N2','UI-N3'].includes(n.id);
    const reply=n.kind==='open'&&!!j&&!expression;
    const bg=reply ? grainReplyStill : n.image ?? media.scenes[records||n.material?'grain_records':'grain_infirmary'];
    const hud=`<header class="game-hud dialogue-hud"><div class="dialogue-place"><span>永安 · ${n.material?'查阅资料':records?'粮队交接处':'苟安伤帐'}</span></div><nav>${btn('records','记录')}${btn('save','存档')}${btn('pause','菜单')}</nav></header>`;
    if(expression) {
        const paper = expressionPaperHTML({ evidence: '', clues:s.clues.map(c=>({id:c.id,title:c.title,text:c.detail})), selected:s.state.selected,
            draft:s.state.draft, busy:v.busy, status:v.error||(v.polishing?'正在润色……':v.busy?'正在等待回应……':''),
            polishActions:v.polishing?btn('cancel-speech','取消润色','cancel-polish'):!v.busy?`${btn('polish-expression','润色表达','polish-button',!s.state.draft.trim()&&!s.state.selected.length&&true)}${v.canUndoPolish?btn('undo-polish','撤销润色','restore-draft'):''}`:'',
            confirmActions:(v.busy&&!v.polishing?btn('cancel-speech','停止等待'):btn('speak','确认说出 ↗','confirm-expression',v.busy||!s.state.draft.trim()))+(j&&!v.busy?btn('keep','保留上次发言'):''),
        });
        return `<main class="thought-screen workspace-screen expression-workspace ${v.notes?'inventory-open':''}" data-phase="expression"><div class="thought-landscape" style="background-image:url('${bg}')"></div><div class="paper-atmosphere"></div>${hud}<div class="workspace-layout" tabindex="0" aria-label="组织表达，可上下滚动"><div class="expression-layout"><section class="thought-center expression-center">${expressionHeadingHTML('苟安',n.round==='O2'?'“该说的，我已经说了。你现在准备拿我怎么办？”':'“你要我留下，总得让我看见一条别的路。”')}${paper}</section></div></div></main>`;
    }
    if(n.kind==='letter')return `<main class="game-scene"><div class="scene-image" style="background-image:url('${bg}')"></div>${hud}<section class="grain-document"><h1>共同补报</h1><label for="letter-draft">正文</label><textarea id="letter-draft" maxlength="3000">${esc(s.state.letterDraft??s.story.letterDefault??'')}</textarea><p>附件：已取得的原始粮账、缺额报告与签认、两封信、苟安署名说明。正文补充不改变原件，也不删去各人责任。</p>${btn('next','确认寄出')}</section></main>`;
    if(n.material)return `<main class="game-scene evidence-scene ${v.notes?'workspace-screen inventory-open':''}" data-phase="material"><div class="scene-image" style="background-image:url('${bg}')"></div><div class="scene-shade"></div>${hud}${materialView(n.text, materialAppearance(n.id))}</main>`;
    const speaker=n.kind==='open'?'苟安':personName(n.speaker);
    const line=n.kind==='open'?j?.reply:n.text;
    const body=n.kind==='choice'?narrativeChoiceHTML(s.decision!, 'data-option'):`<section class="dialogue-box dialogue-advance" tabindex="0" data-action="next"><span class="dialogue-speaker">${esc(speaker)}</span><span class="dialogue-reading"><span class="dialogue-text"><span id="spoken-line">${esc(line)}</span></span></span></section>${reply?`<nav class="grain-reply-actions">${btn('revise','重新组织')}${btn('next','继续交谈 →')}</nav>`:''}${n.kind==='finish'?`<nav class="scene-routes">${btn('onward','继续往前 →','ending-primary')}${btn('menu','返回开始页')}${btn('restart','重新开始')}</nav>`:reply?'':'<p class="dialogue-key-hint">点击屏幕继续 · 空格</p>'}`;
    return `<main class="game-scene ${n.cameraHold||reply?'grain-camera-hold':''} ${reply?'grain-reply':''} ${v.notes?'workspace-screen inventory-open':''}" data-phase="dialogue"><div class="scene-image" style="background-image:url('${bg}')"></div><div class="scene-shade"></div>${hud}${speaker==='苟安'&&!n.image&&!reply?portraitStage(`<img class="character-art" data-character="gouan" src="${media.characters.gouan}" alt="苟安">`):''}${body}</main>`;
}
