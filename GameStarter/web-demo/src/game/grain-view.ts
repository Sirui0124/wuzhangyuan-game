import { phoneLauncherHTML } from '../phone/launcher-view';
import { expressionHeadingHTML, expressionPaperHTML } from './expression-view';
import { portraitStage } from './portrait-stage';
import { esc, btn, personName, type Media } from './view-common';
import { itemSystemEnabled } from '../runtime-mode';
import type { GrainSession } from '../chapters/chapter-two/session';
import { inventoryPanelHTML } from '../thought-workspace-view';
import { selectionRowHTML } from '../inventory/selection-view';
import { supplyById, isAvailableSupply } from '../phone/supplies';
import { eraEndingHTML } from './era-ending';
import { materialAppearance } from '../chapters/chapter-two/materials';
import { materialView } from './material-view';
import { grainReplyStill } from './grain-dialogue-camera';
export function grainView(s: GrainSession, media: Media, v: {notes:boolean;items:boolean;editing:boolean;busy:boolean;error:string;phoneEnabled?:boolean;polishing?:boolean;canUndoPolish?:boolean;detail?:string}) {
    if(s.state.end==='era-arrest')return eraEndingHTML();
    const n=s.current, j=s.state.judgments[n.id], expression=n.kind==='open'&&!s.eraFailure&&(!j||v.editing);
    const records=/^CH2-LY02-(010|011|012|013|014|015|ACT01)$/.test(n.id)||/^CH2-LY04-/.test(n.id)||['UI-GRAIN-FLOW','UI-N2','UI-N3'].includes(n.id);
    const reply=n.kind==='open'&&!!j&&!s.eraFailure&&!expression;
    const bg=reply ? grainReplyStill : n.image ?? media.scenes[records||n.material?'grain_records':'grain_infirmary'];
    const hud=`<header class="game-hud dialogue-hud"><div class="dialogue-place"><span>永安 · ${n.material?'查阅资料':records?'粮队交接处':'苟安伤帐'}</span></div><nav>${btn('notes','线索')}${v.phoneEnabled !== false&&n.kind==='open'&&!s.eraFailure?phoneLauncherHTML(expression?'准备佐证':''):''}${itemSystemEnabled() ? btn('bag', '物品') : ''}${btn('records','记录')}${btn('save','存档')}${btn('pause','菜单')}</nav></header>`;
    const clues=s.clues.map(c=>({id:c.id,title:c.title}));
    const items=s.state.supplies.purchases.filter(id=>isAvailableSupply(id,s.state.supplies)).map(id=>({id:'item:'+id,title:supplyById(id,s.state.supplies)!.name}));
    const chosen=(id:string)=>id.startsWith('item:')?s.state.supplies.attached.includes(id.slice(5)):s.state.selected.includes(id);
    const chips=(list:typeof clues)=>list.filter(c=>chosen(c.id)).map(c=>`<article class="working-clue"><button class="working-clue-title" data-detail="${esc(c.id)}" aria-haspopup="dialog">${esc(c.title)}</button><button class="working-clue-remove" data-select="${esc(c.id)}" aria-label="收回${esc(c.title)}">×</button></article>`).join('');
    const inventory=v.notes?inventoryPanelHTML(v.items?'物品':'线索',(v.items?items:clues).map(c=>selectionRowHTML({ id:c.id, title:c.title, detailAction:'data-detail', toggle:expression ? { action:'data-select', selected:chosen(c.id), disabled:c.id.startsWith('item:')&&!chosen(c.id)&&s.state.supplies.attached.length>=2 } : undefined })).join(''),v.items?'尚无可用物品':'尚无已得线索'):'';
    if(expression) {
        const item = v.detail?.startsWith('item:') ? supplyById(v.detail.slice(5),s.state.supplies) : undefined;
        const clue = s.clues.find(c=>c.id===v.detail);
        const detail = v.notes && (item || clue) ? `<aside class="thought-detail-popover" role="dialog" aria-label="${esc(item?.name??clue!.title)}"><header><span>${esc(item?.name??clue!.title)}</span><button data-action="close-evidence-detail" aria-label="收起详情">×</button></header><div class="thought-detail-content">${item?`<p>${esc(item.ability)}</p><p>${esc(item.boundary)}</p>`:(clue!.sources??[]).map(source=>`<blockquote>${esc(source.speaker)}：${esc(source.text)}</blockquote>`).join('')}</div></aside>` : '';
        const paper = expressionPaperHTML({
            inspection:detail,
            evidence: `<section class="speech-evidence"><header><button data-action="clue-items" class="speech-add" aria-expanded="${v.notes&&!v.items}" aria-controls="thought-inventory">＋ 添加线索</button></header><div class="speech-evidence-items">${chips(clues)}</div>${s.state.selected.length ? `<p class="expression-selection-note grain-selection-note">${s.state.selectedAt && s.state.selectedAt !== n.id ? '这里沿用上次选的线索，可按 × 收回。' : '所选线索供这次写话参考，可按 × 收回。'}</p>` : ''}</section>${v.phoneEnabled === false ? '' : `<section class="speech-items"><header><button data-action="items" class="speech-add-item" aria-expanded="${v.notes&&v.items}" aria-controls="thought-inventory">＋ 添加物品</button></header><div class="speech-evidence-items">${chips(items)}</div></section>`}`,
            draft:s.state.draft, busy:v.busy, status:v.error||(v.polishing?'正在润色……':v.busy?'正在等待回应……':''),
            polishActions:v.polishing?btn('cancel-speech','取消润色','cancel-polish'):!v.busy?`${btn('polish-expression','润色表达','polish-button',!s.state.draft.trim()&&!s.state.selected.length&&!s.state.supplies.attached.length)}${v.canUndoPolish?btn('undo-polish','撤销润色','restore-draft'):''}`:'',
            confirmActions:(v.busy&&!v.polishing?btn('cancel-speech','停止等待'):btn('speak','确认说出 ↗','confirm-expression',v.busy||!s.state.draft.trim()))+(j&&!v.busy?btn('keep','保留上次发言'):''),
        });
        return `<main class="thought-screen workspace-screen expression-workspace ${v.notes?'inventory-open':''}" data-phase="expression"><div class="thought-landscape" style="background-image:url('${bg}')"></div><div class="paper-atmosphere"></div>${hud}${inventory}<div class="workspace-layout" tabindex="0" aria-label="组织表达，可上下滚动"><div class="expression-layout"><section class="thought-center expression-center">${expressionHeadingHTML('苟安',n.round==='O2'?'“该说的，我已经说了。你现在准备拿我怎么办？”':'“你要我留下，总得让我看见一条别的路。”')}${paper}</section></div></div></main>`;
    }
    if(n.kind==='letter')return `<main class="game-scene"><div class="scene-image" style="background-image:url('${bg}')"></div>${hud}<section class="grain-document"><h1>共同补报</h1><label for="letter-draft">正文</label><textarea id="letter-draft" maxlength="3000">${esc(s.state.letterDraft??s.story.letterDefault??'')}</textarea><p>附件：已取得的原始粮账、缺额报告与签认、两封信、苟安署名说明。正文补充不改变原件，也不删去各人责任。</p>${btn('next','确认寄出')}</section></main>`;
    if(n.material)return `<main class="game-scene evidence-scene ${v.notes?'workspace-screen inventory-open':''}" data-phase="material"><div class="scene-image" style="background-image:url('${bg}')"></div><div class="scene-shade"></div>${hud}${materialView(n.text, materialAppearance(n.id))}${inventory}</main>`;
    const speaker=n.kind==='open'?'苟安':personName(n.speaker);
    const line=n.kind==='open'?j?.reply:n.text;
    const tentEntry=s.canVisitOwnTent()?`<nav class="scene-routes">${btn('own-tent','看看自己的军帐')}</nav>`:'';
    const body=n.kind==='choice'?`<section class="dialogue-box scout-choice"><h2 class="dialogue-speaker">${esc(n.text)}</h2>${n.options!.map(o=>`<button data-option="${o.id}"><span>${esc(o.text)}</span><i>›</i></button>`).join('')}</section>`:`<section class="dialogue-box dialogue-advance" tabindex="0" data-action="next"><span class="dialogue-speaker">${esc(speaker)}</span><span class="dialogue-reading"><span class="dialogue-text"><span id="spoken-line">${esc(line)}</span></span></span></section>${reply?`<nav class="grain-reply-actions">${btn('revise','重新组织')}${btn('next','继续交谈 →')}</nav>`:''}${n.kind==='finish'?`<nav class="scene-routes">${btn('onward','继续往前 →','ending-primary')}${btn('menu','返回开始页')}${btn('restart','重新开始')}</nav>`:reply?'':'<p class="dialogue-key-hint">点击屏幕继续 · 空格</p>'}`;
    return `<main class="game-scene ${n.cameraHold||reply?'grain-camera-hold':''} ${reply?'grain-reply':''} ${v.notes?'workspace-screen inventory-open':''}" data-phase="dialogue"><div class="scene-image" style="background-image:url('${bg}')"></div><div class="scene-shade"></div>${hud}${speaker==='苟安'&&!n.image&&!reply?portraitStage(`<img class="character-art" data-character="gouan" src="${media.characters.gouan}" alt="苟安">`):''}${body}${tentEntry}${inventory}</main>`;
}
