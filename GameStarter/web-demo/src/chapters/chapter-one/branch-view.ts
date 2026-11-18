import { bindDialogueScreenInput } from '../../game/dialogue-screen-input';
import type { ChapterOneSession } from './session';
import type { GameUIState } from '../../game/ui-state';
import { esc, btn, createPortrait, type Media } from '../../game/view-common';
import { handleCluePopup } from '../../game/dialogue-clues';
import { expressionHeadingHTML, expressionPaperHTML } from '../../game/expression-view';
import { portraitStage } from '../../game/portrait-stage';
import type { AiReceipt } from './branch-engine';
import { checkLocalPlan, type LocalPlan } from './local-plan';

/** New chapter graph uses the existing menu, save slots, portraits and clue popover. */
export function createBranchView(root: HTMLElement, game: ChapterOneSession, media: Media, ui: GameUIState, render:()=>void, persist:()=>void) {
    let request: AbortController | null=null, status='', task='', previousDraft='', failedTurn=false, fixedInput=false;
    let localMode=false, localMatch: {text:string;plan:LocalPlan;stamp:string} | null=null;
    const clueNoticeDuration=4500;
    let knownClues=game.branch?.clues.map(c=>c.id)??[], clueNotice='', clueNoticeStarted=0, clueNoticeTimer=0;
    const clearClueNotice=()=>{
        clearTimeout(clueNoticeTimer);clueNoticeTimer=0;clueNotice='';
        root.querySelector('.branch-clue-gained')?.remove();
    };
    const clueToast=()=>{
        const elapsed=Math.max(0,performance.now()-clueNoticeStarted);
        // Scene renders must resume the original animation, never restart its lifetime.
        return clueNotice&&elapsed<clueNoticeDuration?`<aside class="branch-clue-gained" role="status" style="animation-delay:-${elapsed}ms"><small>记下线索</small><span>${esc(clueNotice)}</span></aside>`:'';
    };
    const fingerprint=()=>JSON.stringify([game.branch?.dialogue.audit,game.branch?.line,game.runtimeMode()]);
    const cancel=()=>{request?.abort();request=null;task='';};
    const portrait=createPortrait(media);
    function html() {
        const b=game.branch!, g=b.dialogue, line=b.currentLine;
        const timeLabel=g.nodeId==='C01-EPILOGUE'?'七日期满':['C01-JOINT-DAWN','C01-END-JOINT','C01-END-DEATH'].includes(g.nodeId)?'天明':g.state.deathSeen?'再试第六夜':'第六夜';
        const speaker=line?.speaker ?? '', character=({'魏延':'weiyan','姜维':'jiangwei','小甲':'guard','亲兵':'jiangwei_guard','诸葛亮':'zhugeliang'} as Record<string,string>)[speaker];
        const background=speaker==='告示'?media.scenes.notice_front:media.scenes[game.snapshot().scene] ?? media.scenes.camp_gate;
        const ready=b.atLastLine, input=ready&&!g.pending&&!g.aiHeld&&(g.aiScene||g.node.freeInput);
        const reading = !ready || !!g.pending || g.node.kind==='passage'||!!g.node.autoChoice;
        const controls=reading ? ''
            : g.aiHeld?'<button data-branch="retry">重新组织这段话</button>'
            :g.node.kind==='terminal'?btn('chapters','展开舆图')
            :g.choices.map(c=>`<button data-branch="choose" data-choice="${esc(c.id)}">${esc(g.nodeId==='C01-EPILOGUE'&&c.id==='stop'?'返回舆图':c.label)}</button>`).join('');
        const offline=[
            ...(g.state.knowsJiang ? [['INVITE_JIANG',g.state.jiangAgreed?'带将军去见伯约':'请伯约听报',g.state.jiangAgreed?'伯约已经答应接报，我带将军过去。':'我去请伯约来听报，由他判断是否要禀报丞相。']] : []),
            ['SELF_RELAY','由我转呈军报','军报交给我，我去转呈，有回令便送回前营。'],
            ['ENTER','让将军进去','我不拦将军了，请将军进去见丞相。'],
        ];
        const hud=`<header class="game-hud dialogue-hud"><div class="dialogue-place"><span>${esc(game.scene.title)}</span><small>${timeLabel}</small></div><nav>${btn('records','记录')}${btn('save','存档')}${btn('pause','菜单')}</nav></header>`;
        if(g.node.kind==='ending'&&ready&&!g.pending) {
            const labels:Record<string,string>={continue:'继续',reread:'重玩',rewind:'重试',stop:'返回'};
            return `<main class="chapter-ending branch-scene branch-ending" data-phase="ending" data-node="${g.nodeId}" data-line="${b.line}" data-ending="${g.node.endingId??''}">
                <div class="ending-background" style="background-image:url('${esc(background)}')"></div>${hud}
                <section class="ending-copy" aria-labelledby="branch-ending-title"><span class="ending-kicker">第一章 · 五丈原</span>
                <h1 id="branch-ending-title">${esc(g.node.title)}</h1><p>${esc(line?.text??'')}</p>
                <div class="branch-ending-actions">${g.choices.map((c,i)=>`<button class="${i===0?'ending-primary':''}" data-branch="choose" data-choice="${esc(c.id)}">${esc(labels[c.id??'']??c.label)}</button>`).join('')}</div></section>
                </main>`;
        }
        if(b.noticePending) return `<main class="game-scene branch-scene" data-phase="explore" data-node="${g.nodeId}" data-line="${b.line}" data-scene="camp_gate"><div class="scene-image" style="background-image:url('${esc(media.scenes.camp_gate)}')"></div><div class="scene-shade"></div>${hud}<div class="scene-hotspots"><button class="scene-hotspot" data-branch="notice" style="left:52%;top:48%"><i></i><span>查看告示</span></button></div><p class="dialogue-key-hint">先看看帐前的告示</p></main>`;
        if(input) {
            const offlineInput=g.aiScene&&!localMode&&(!game.aiEnabled()||fixedInput);
            const options=offlineInput?offline.map(([outcome,label,text])=>`<button data-branch="offline" data-outcome="${outcome}" data-words="${esc(text)}">${esc(label)}<i aria-hidden="true">›</i></button>`).join(''):controls;
            const paper=offlineInput?'':expressionPaperHTML({
                evidence:'', clues:b.clues, selected:b.selected, draft:b.draft, status,
                inputId:'branch-input', statusId:'branch-status', maxLength:g.aiScene?800:400,
                placeholder:g.aiScene?'我的回应…':'也可以自己问一句……', guidance:false,
                polishActions:g.aiScene&&!localMode?`<button type="button" class="polish-button" data-branch="polish" ${request||!b.draft.trim()?'disabled':''}>润色表达<svg class="polish-spark" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 0C9 6 10 7 16 8C10 9 9 10 8 16C7 10 6 9 0 8C6 7 7 6 8 0Z" fill="currentColor"/></svg></button>${previousDraft?'<button type="button" data-branch="undo-polish">撤回润色</button>':''}`:'',
                clearButton:'<button type="button" data-branch="clear">清空</button>',
                confirmActions:`<button type="submit" class="confirm-expression" ${request||!b.draft.trim()?'disabled':''}>${request?task:localMode?'本地规则检查':failedTurn?'重试':g.aiScene?'确认说出':'问他'}</button>${request?'<button type="button" data-branch="cancel">取消</button>':''}${failedTurn&&!localMode?'<button type="button" data-branch="local-check">本地规则检查</button>':''}${failedTurn||localMode?'<button type="button" data-branch="use-fixed">改用固定说法</button>':''}`,
                help:g.aiScene&&g.aiHint?`<details class="expression-help"><summary>${g.state.jiangAgreed?'回想伯约的话':'回想小甲的话'}</summary><p class="branch-hint">${esc(g.state.jiangAgreed?b.clues.find(c=>c.id==='branch-jiang')?.text??g.aiHint:g.aiHint)}</p></details>`:'',
            });
            return `<main class="workspace-screen expression-workspace narrative-expression branch-scene" data-phase="expression" data-node="${g.nodeId}" data-line="${b.line}" data-ending="${g.node.endingId??''}">
                <div class="thought-landscape" style="background-image:url('${esc(background)}')"></div>${character?portraitStage(portrait(character)):''}${hud}
                <div class="workspace-layout"><section class="expression-center">${expressionHeadingHTML(speaker,line?.text??'')}
                ${offlineInput?'<p role="status">选择一句固定说法继续。</p>':''}
                ${localMode?'<p role="status">本地规则模式：只检查本次原话，不调用AI；无法识别时不计轮次。</p>':''}
                ${options?`<div class="branch-options branch-preset-options">${options}</div>`:''}
                ${offlineInput&&game.aiEnabled()?'<button type="button" data-branch="use-free">返回自由输入</button>':''}
                ${offlineInput?'<button type="button" data-branch="local-input">自己输入（本地规则）</button>':''}
                ${paper?`<form data-branch-form>${paper}</form>`:''}
                ${localMatch?`<section class="branch-local-result" aria-label="本地规则识别结果"><p>本地规则识别：${esc(localMatch.plan.label)}</p><p>依据：${esc(localMatch.plan.evidence)}</p><p>确认后按你的原话继续，魏延使用预写回应。</p><button type="button" data-branch="local-confirm">按原话继续</button></section>`:''}</section></div>${clueToast()}</main>`;
        }
        return `<main class="game-scene branch-scene" data-phase="${reading ? 'dialogue' : 'choice'}" data-reading-notice="${speaker==='告示'}" data-node="${g.nodeId}" data-line="${b.line}" data-ending="${g.node.endingId??''}">
          <div class="scene-image" style="background-image:url('${esc(background)}')"></div><div class="scene-shade"></div>
          <header class="game-hud dialogue-hud"><div class="dialogue-place"><span>${esc(game.scene.title)}</span><small>${timeLabel}</small></div><nav>${btn('records','记录')}${btn('save','存档')}${btn('pause','菜单')}</nav></header>
          ${character?portraitStage(portrait(character)):''}
          <section class="dialogue-box ${reading ? 'dialogue-advance' : 'scout-choice'}" tabindex="0" aria-label="当前对白">
            <span class="dialogue-speaker">${esc(speaker==='演出'?'':speaker)}</span>
            <span class="dialogue-reading"><span class="dialogue-text"><span id="spoken-line">${esc(line?.text ?? '')}</span></span></span>
            ${g.nodeId==='C01-CONFIRMED-RETURN' && g.state.jiangAgreed ? '<p class="branch-hint">伯约已应允接报。若须丞相定夺，由他入帐禀明。</p>' : ''}
            ${controls ? `<div class="branch-options">${controls}</div>` : ''}
            ${status ? `<p id="branch-status" role="status">${esc(status)}</p>` : ''}
          </section>${reading ? '<p class="dialogue-key-hint" aria-hidden="true">点击屏幕继续 · 空格</p>' : ''}${clueToast()}
        </main>`;
    }
    const canRead = () => {
        const b=game.branch;
        return !ui.home && !ui.overlay && !root.querySelector('#film-host') && game.snapshot().phase==='branch' && !!b
            && !b.noticePending && (!b.atLastLine || !!b.dialogue.pending || b.dialogue.node.kind==='passage'||!!b.dialogue.node.autoChoice);
    };
    bindDialogueScreenInput(root, () => canRead() ? () => game.branchAct('next') : undefined, '.branch-scene');
    function sync() { if(ui.home || ui.overlay || game.snapshot().phase!=='branch'){cancel();clearClueNotice();} }
    let at=fingerprint();
    game.onChange(()=>{
        const next=fingerprint();if(next!==at){cancel();status='';previousDraft='';failedTurn=false;fixedInput=false;localMode=false;localMatch=null;}at=next;
        const clues=game.branch?.clues??[], gained=clues.filter(c=>!knownClues.includes(c.id));
        if(ui.restoring || clues.length<knownClues.length)clearClueNotice();
        else if(gained.length){clearClueNotice();clueNotice=gained.map(c=>c.title).join(' · ');clueNoticeStarted=performance.now();clueNoticeTimer=window.setTimeout(clearClueNotice,clueNoticeDuration);}
        knownClues=clues.map(c=>c.id);
    });
    function inspectLocal() {
        cancel();localMode=true;fixedInput=false;localMatch=null;
        const b=game.branch!;const result=checkLocalPlan(b.draft,b.dialogue.state);
        if(result.match){localMatch={text:b.draft.trim(),plan:result.match,stamp:fingerprint()};status='已用本地规则检查，请确认识别结果。';}
        else status=result.reason;
        persist();render();
    }
    async function submit(polish=false) {
        const b=game.branch;if(!b||request)return;const g=b.dialogue,text=b.draft.trim();
        if(localMode&&!polish){inspectLocal();return;}
        if(!text){root.querySelector<HTMLTextAreaElement>('#branch-input')?.focus();return;}
        if(!g.aiScene){game.branchAct('ask',text);return;}
        const pending=new AbortController(), stamp=fingerprint(), id=crypto.randomUUID();request=pending;task=polish?'正在润色…':'魏延正在回应…';status='';render();
        try {
            const response=await fetch(`/api/chapter-one/${polish?'polish':'turn'}`,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([pending.signal,AbortSignal.timeout(65000)]),body:JSON.stringify({version:g.story.version,nodeId:g.nodeId,audit:g.audit,requestId:id,text})});
            const result=await response.json();
            if(request!==pending||fingerprint()!==stamp||b.draft.trim()!==text)return;
            if(!response.ok)throw Error(result.error??'暂时没有收到回应，原话已保留。');
            if(!polish&&result.requestId!==id)throw Error('回应与这次发言不符，请重试。');
            request=null;task='';
            if(polish){previousDraft=b.draft;b.draft=result.text;status='已润色，检查后再说给魏延听。';persist();render();}
            else {game.branchReply(text,result as AiReceipt);status=result.replySource==='fixed'?'本轮使用预写回应，保留 AI 对发言的判断。':'';render();}
        }catch(e){if(request!==pending)return;request=null;task='';failedTurn=!polish;const message=e instanceof Error?e.message:'';status=/fetch|network|load failed|timeout/i.test(message)?'暂时连不上AI服务，原话已保留。可重试，或改用本地规则、固定说法继续。':message||'连接暂不可用，原话已保留。';render();}
    }
    root.addEventListener('input',event=>{
        const input=event.target as HTMLTextAreaElement;if(input.id!=='branch-input')return;
        cancel();status='';localMatch=null;root.querySelector('.branch-local-result')?.remove();game.branchDraft(input.value);persist();
        root.querySelectorAll<HTMLButtonElement>('[data-branch="polish"], [data-branch-form] button[type="submit"]').forEach(button=>button.disabled=!input.value.trim());
        root.querySelector<HTMLButtonElement>('[data-branch-form] button[type=submit]')!.textContent=localMode?'本地规则检查':game.branch?.dialogue.aiScene?'确认说出':'问他';
        root.querySelector('[data-branch="cancel"]')?.remove();
    });
    root.addEventListener('submit',event=>{if(!(event.target as HTMLElement).matches('[data-branch-form]'))return;event.preventDefault();void submit();});
    root.addEventListener('click',event=>{
        if(ui.home||ui.overlay||game.snapshot().phase!=='branch')return;
        const target=(event.target as HTMLElement).closest<HTMLElement>('button');if(!target)return;
        const b=game.branch!;
        if(target.hasAttribute('data-clue-picker')||target.hasAttribute('data-clue-preview')||target.hasAttribute('data-clue-close')){event.preventDefault();event.stopImmediatePropagation();handleCluePopup(root,target);return;}
        if(['insert-clue','remove-clue'].includes(target.dataset.action??'')){
            event.preventDefault();event.stopImmediatePropagation();const clue=b.clues.find(c=>c.id===target.dataset.clue);if(!clue)return;cancel();localMatch=null;
            if(target.dataset.action==='insert-clue'&&!b.selected.includes(clue.id)){b.selected.push(clue.id);b.draft=(b.draft+(b.draft?'\n':'')+clue.text).slice(0,800);}
            else b.selected=b.selected.filter(id=>id!==clue.id);
            persist();render();return;
        }
        const action=target.dataset.branch;if(!action)return;event.preventDefault();event.stopImmediatePropagation();
        if(event.detail>1)return;
        try {
            if(action==='local-check'){inspectLocal();return;}
            if(action==='local-input'){cancel();localMode=true;fixedInput=false;localMatch=null;render();return;}
            if(action==='local-confirm'){
                const m=localMatch,result=checkLocalPlan(b.draft,b.dialogue.state);
                if(!m||m.text!==b.draft.trim()||m.stamp!==fingerprint()||result.match?.outcome!==m.plan.outcome){inspectLocal();return;}
                game.branchAct('offline',m.plan.outcome,m.text);status='本轮使用本地规则与预写回应，未调用AI。';render();return;
            }
            if(action==='use-fixed'){cancel();fixedInput=true;localMode=false;localMatch=null;persist();render();return;}
            if(action==='use-free'){fixedInput=false;localMode=false;localMatch=null;render();return;}
            if(action==='cancel'){cancel();failedTurn=!!b.dialogue.aiScene;status='已取消，原话已保留。';render();return;}
            if(action==='clear'){cancel();b.draft='';b.selected=[];previousDraft='';localMatch=null;status='';persist();render();return;}
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
