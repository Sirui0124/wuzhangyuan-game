import { bindDialogueScreenInput } from '../../game/dialogue-screen-input';
import type { ChapterOneSession } from './session';
import type { GameUIState } from '../../game/ui-state';
import { esc, btn, createPortrait, type Media } from '../../game/view-common';
import { handleCluePopup } from '../../game/dialogue-clues';
import { expressionHeadingHTML, expressionPaperHTML } from '../../game/expression-view';
import { portraitStage } from '../../game/portrait-stage';
import type { AiReceipt } from './branch-engine';

/** New chapter graph uses the existing menu, save slots, portraits and clue popover. */
export function createBranchView(root: HTMLElement, game: ChapterOneSession, media: Media, ui: GameUIState, render:()=>void, persist:()=>void) {
    let request: AbortController | null=null, status='', task='', previousDraft='';
    let knownClues=game.branch?.clues.map(c=>c.id)??[], clueNotice='', clueNoticeUntil=0;
    const clueToast=()=>clueNotice&&Date.now()<clueNoticeUntil?`<aside class="branch-clue-gained" role="status"><small>记下线索</small><span>${esc(clueNotice)}</span></aside>`:'';
    const fingerprint=()=>JSON.stringify([game.branch?.dialogue.audit,game.branch?.line,game.runtimeMode()]);
    const cancel=()=>{request?.abort();request=null;task='';};
    const portrait=createPortrait(media);
    function html() {
        const b=game.branch!, g=b.dialogue, line=b.currentLine;
        const speaker=line?.speaker ?? '', character=({'魏延':'weiyan','姜维':'jiangwei','小甲':'guard','亲兵':'jiangwei_guard','诸葛亮':'zhugeliang'} as Record<string,string>)[speaker];
        const background=speaker==='告示'?media.scenes.notice_front:media.scenes[game.snapshot().scene] ?? media.scenes.camp_gate;
        const ready=b.atLastLine, input=ready&&!g.pending&&!g.aiHeld&&(g.aiScene||g.node.freeInput);
        const reading = !ready || !!g.pending || g.node.kind==='passage';
        const controls=reading ? ''
            : g.aiHeld?'<button data-branch="retry">重新组织这段话</button>'
            :g.node.kind==='terminal'?btn('chapters','展开舆图')
            :g.choices.map(c=>`<button data-branch="choose" data-choice="${esc(c.id)}">${esc(c.label)}</button>`).join('');
        const offline=g.state.knowsJiang ? [ ['INVITE_JIANG','请伯约来听报','魏军还没攻营，我去请伯约来听报，再传回军令。'], ['RELAY_JIANG','我送去请伯约看','魏军还没攻营，我拿军报请伯约看，再把回令送回前营。'] ]
            :[ ['SELF_RELAY','由我转呈军报','魏军还没攻营，我来转呈军报，有回令便送回前营。'], ['ENTER','让将军进去','我不拦将军了，请将军进去见丞相。'] ];
        const hud=`<header class="game-hud dialogue-hud"><div class="dialogue-place"><span>${esc(game.scene.title)}</span><small>${g.state.deathSeen?'再临第六夜':'第六夜'}</small></div><nav>${btn('records','记录')}${btn('save','存档')}${btn('pause','菜单')}</nav></header>`;
        if(b.noticePending) return `<main class="game-scene branch-scene" data-phase="explore" data-node="${g.nodeId}" data-line="${b.line}" data-scene="camp_gate"><div class="scene-image" style="background-image:url('${esc(media.scenes.camp_gate)}')"></div><div class="scene-shade"></div>${hud}<div class="scene-hotspots"><button class="scene-hotspot" data-branch="notice" style="left:52%;top:48%"><i></i><span>查看告示</span></button></div><p class="dialogue-key-hint">先看看帐前的告示</p></main>`;
        if(input) {
            const offlineInput=g.aiScene&&!game.aiEnabled();
            const options=offlineInput?offline.map(([outcome,label,text])=>`<button data-branch="offline" data-outcome="${outcome}" data-words="${esc(text)}">${esc(label)}<i aria-hidden="true">›</i></button>`).join(''):controls;
            const paper=offlineInput?'':expressionPaperHTML({
                evidence:'', clues:b.clues, selected:b.selected, draft:b.draft, status,
                inputId:'branch-input', statusId:'branch-status', maxLength:g.aiScene?800:400,
                placeholder:g.aiScene?'我的回应…':'也可以自己问一句……', guidance:false,
                polishActions:g.aiScene?`<button type="button" class="polish-button" data-branch="polish" ${request?'disabled':''}>润色表达</button>${previousDraft?'<button type="button" data-branch="undo-polish">撤回润色</button>':''}`:'',
                clearButton:'<button type="button" data-branch="clear">清空</button>',
                confirmActions:`<button type="submit" class="confirm-expression" ${request?'disabled':''}>${request?task:g.aiScene?'确认说出':'问他'}</button>${request?'<button type="button" data-branch="cancel">取消</button>':''}`,
                help:g.aiScene&&g.aiHint?`<details class="expression-help"><summary>回想小甲的话</summary><p class="branch-hint">${esc(g.aiHint)}</p></details>`:'',
            });
            return `<main class="workspace-screen expression-workspace narrative-expression branch-scene" data-phase="expression" data-node="${g.nodeId}" data-line="${b.line}" data-ending="${g.node.endingId??''}">
                <div class="thought-landscape" style="background-image:url('${esc(background)}')"></div>${character?portraitStage(portrait(character)):''}${hud}
                <div class="workspace-layout"><section class="expression-center">${expressionHeadingHTML(speaker,line?.text??'')}
                ${options?`<div class="branch-options branch-preset-options">${options}</div>`:''}
                ${paper?`<form data-branch-form>${paper}</form>`:''}</section></div>${clueToast()}</main>`;
        }
        return `<main class="game-scene branch-scene" data-phase="${reading ? 'dialogue' : 'choice'}" data-reading-notice="${speaker==='告示'}" data-node="${g.nodeId}" data-line="${b.line}" data-ending="${g.node.endingId??''}">
          <div class="scene-image" style="background-image:url('${esc(background)}')"></div><div class="scene-shade"></div>
          <header class="game-hud dialogue-hud"><div class="dialogue-place"><span>${esc(game.scene.title)}</span><small>${g.state.deathSeen?'再临第六夜':'第六夜'}</small></div><nav>${btn('records','记录')}${btn('save','存档')}${btn('pause','菜单')}</nav></header>
          ${character?portraitStage(portrait(character)):''}
          <section class="dialogue-box ${reading ? 'dialogue-advance' : 'scout-choice'}" tabindex="0" aria-label="当前对白">
            <span class="dialogue-speaker">${esc(speaker==='演出'?'':speaker)}</span>
            <span class="dialogue-reading"><span class="dialogue-text"><span id="spoken-line">${esc(line?.text ?? '')}</span></span></span>
            ${controls ? `<div class="branch-options">${controls}</div>` : ''}
            ${status ? `<p id="branch-status" role="status">${esc(status)}</p>` : ''}
          </section>${reading ? '<p class="dialogue-key-hint" aria-hidden="true">点击屏幕继续 · 空格</p>' : ''}${clueToast()}
        </main>`;
    }
    const canRead = () => {
        const b=game.branch;
        return !ui.home && !ui.overlay && game.snapshot().phase==='branch' && !!b
            && !b.noticePending && (!b.atLastLine || !!b.dialogue.pending || b.dialogue.node.kind==='passage');
    };
    bindDialogueScreenInput(root, () => canRead() ? () => game.branchAct('next') : undefined, '.branch-scene');
    function sync() { if(ui.home || ui.overlay || game.snapshot().phase!=='branch')cancel(); }
    let at=fingerprint();
    game.onChange(()=>{
        const next=fingerprint();if(next!==at){cancel();status='';previousDraft='';}at=next;
        const clues=game.branch?.clues??[], gained=clues.filter(c=>!knownClues.includes(c.id));
        if(gained.length&&!ui.restoring){clueNotice=gained.map(c=>c.title).join(' · ');clueNoticeUntil=Date.now()+4500;}
        knownClues=clues.map(c=>c.id);
    });
    async function submit(polish=false) {
        const b=game.branch;if(!b||request)return;const g=b.dialogue,text=b.draft.trim();
        if(!text){status='先写下想说的话。';render();return;}
        if(!g.aiScene){game.branchAct('ask',text);return;}
        const pending=new AbortController(), stamp=fingerprint(), id=crypto.randomUUID();request=pending;task=polish?'正在润色…':'魏延正在回应…';status='';render();
        try {
            const response=await fetch(`/api/chapter-one/${polish?'polish':'turn'}`,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([pending.signal,AbortSignal.timeout(65000)]),body:JSON.stringify({version:g.story.version,nodeId:g.nodeId,audit:g.audit,requestId:id,text})});
            const result=await response.json();
            if(request!==pending||fingerprint()!==stamp||b.draft.trim()!==text)return;
            if(!response.ok)throw Error(result.error??'暂时没有收到回应，原话已保留。');
            request=null;task='';
            if(polish){previousDraft=b.draft;b.draft=result.text;status='已润色，检查后再说给魏延听。';persist();render();}
            else {if(result.requestId!==id)throw Error('回应与这次发言不符，请重试。');game.branchReply(text,result as AiReceipt);status=result.replySource==='fixed'?'本轮使用预写回应，保留 AI 对发言的判断。':'';render();}
        }catch(e){if(request!==pending)return;request=null;task='';status=e instanceof Error?e.message:'连接暂不可用，原话已保留。';render();}
    }
    root.addEventListener('input',event=>{
        const input=event.target as HTMLTextAreaElement;if(input.id!=='branch-input')return;
        cancel();status='';game.branchDraft(input.value);persist();
        root.querySelectorAll<HTMLButtonElement>('[data-branch="polish"], [data-branch-form] button[type="submit"]').forEach(button=>button.disabled=false);
        root.querySelector<HTMLButtonElement>('[data-branch-form] button[type=submit]')!.textContent=game.branch?.dialogue.aiScene?'确认说出':'问他';
        root.querySelector('[data-branch="cancel"]')?.remove();
    });
    root.addEventListener('submit',event=>{if(!(event.target as HTMLElement).matches('[data-branch-form]'))return;event.preventDefault();void submit();});
    root.addEventListener('click',event=>{
        if(ui.home||ui.overlay||game.snapshot().phase!=='branch')return;
        const target=(event.target as HTMLElement).closest<HTMLElement>('button');if(!target)return;
        const b=game.branch!;
        if(target.hasAttribute('data-clue-picker')||target.hasAttribute('data-clue-preview')||target.hasAttribute('data-clue-close')){event.preventDefault();event.stopImmediatePropagation();handleCluePopup(root,target);return;}
        if(['insert-clue','remove-clue'].includes(target.dataset.action??'')){
            event.preventDefault();event.stopImmediatePropagation();const clue=b.clues.find(c=>c.id===target.dataset.clue);if(!clue)return;cancel();
            if(target.dataset.action==='insert-clue'&&!b.selected.includes(clue.id)){b.selected.push(clue.id);b.draft=(b.draft+(b.draft?'\n':'')+clue.text).slice(0,800);}
            else b.selected=b.selected.filter(id=>id!==clue.id);
            persist();render();return;
        }
        const action=target.dataset.branch;if(!action)return;event.preventDefault();event.stopImmediatePropagation();
        if(event.detail>1)return;
        try {
            if(action==='cancel'){cancel();status='已取消，原话已保留。';render();return;}
            if(action==='clear'){cancel();b.draft='';b.selected=[];previousDraft='';status='';persist();render();return;}
            if(action==='polish'){void submit(true);return;}
            if(action==='undo-polish'){cancel();b.draft=previousDraft;previousDraft='';persist();render();return;}
            cancel();status='';
            if(action==='choose') {
                game.branchAct('choose',target.dataset.choice);
                if(game.branch?.dialogue.nodeId==='C01-NEXT-CHAPTER' && game.branch.completed)location.assign('/?chapter=grain');
            }
            else if(action==='offline')game.branchAct('offline',target.dataset.outcome,target.dataset.words);
            else if(action==='next'||action==='retry'||action==='notice')game.branchAct(action);
        }catch(e){status=String(e);render();}
    },true);
    root.addEventListener('keydown',event=>{
        if(event.isComposing||ui.home||ui.overlay||game.snapshot().phase!=='branch')return;
        if((event.target as HTMLElement).matches('textarea')){if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();void submit();}return;}
        if([' ','Enter'].includes(event.key)&&!(event.target as HTMLElement).closest('button,input,a,summary')&&!event.repeat){if(canRead()){event.preventDefault();game.branchAct('next');}}
    });
    return {html,sync,cancel};
}
