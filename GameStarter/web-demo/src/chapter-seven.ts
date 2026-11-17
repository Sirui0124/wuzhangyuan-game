import { captureCampaign } from './campaign/results';
import { recordChapterHistory } from './chapters/progression';
import { PangtongSession,type PangtongStory,type PangtongSave } from './chapters/chapter-seven/session';
import { pangtongView,campaignPanel } from './chapters/chapter-seven/view';
import { frameModal } from './game-ui-panels';
import { esc,type Media } from './game/view-common';
import { GameAudio } from './audio';
import {recordPangtongEnding} from './chapters/chapter-seven/achievements';

const root=document.querySelector<HTMLElement>('#game-root')!;
root.tabIndex=-1;
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/chapter-seven.css';document.head.append(sheet);
const SAVE='luofengpo-chapter-seven-v1';
type Stored={game:PangtongSave;savedAt:number};
async function json<T>(url:string):Promise<T>{const r=await fetch(url);if(!r.ok)throw new Error('第七章内容未载入。');return r.json();}
async function start(){
    const [story,media]=await Promise.all([json<PangtongStory>('/story/chapter-seven.story.json'),json<Media>('/media/manifest.json')]);
    const isolated=new URLSearchParams(location.search).get('playtest')==='pangtong';
    const key=isolated?`${SAVE}:playtest:pangtong`:SAVE;
    const audio=new GameAudio();
    let session=new PangtongSession(story,await captureCampaign()),notice='',modal='',blocked=false,focus='',lastRaw:string|null=null,pendingSlot='',archiveWarning='';
    const restore=(raw:string)=>{const s=JSON.parse(raw) as Stored;if(!s?.game)throw new Error('存档身份错误');return new PangtongSession(story,s.game.history,s.game);};
    try{lastRaw=localStorage.getItem(key);if(lastRaw)session=restore(lastRaw);}catch{blocked=true;notice='旧进度无法读取，原记录仍保留。请从菜单重玩本章，备份后再开始。';}
    function render(){root.dataset.chapter='luofengpo';root.innerHTML=pangtongView(session,media,notice||archiveWarning,isolated);if(modal){root.querySelector('main')!.inert=true;root.insertAdjacentHTML('beforeend',frameModal('第七章 · 庞统',modal,'history'));root.querySelector('.game-modal')?.setAttribute('aria-modal','true');root.querySelector<HTMLElement>('.game-modal button')?.focus();}else root.focus({preventScroll:true});}
    function open(html:string){focus=(document.activeElement as HTMLElement)?.dataset.action??'';modal=html;render();}
    function close(){modal='';pendingSlot='';render();root.querySelector<HTMLElement>(`[data-action="${focus}"]`)?.focus();}
    function write(next:PangtongSession){
        try{
            const latest=localStorage.getItem(key);
            if(latest!==lastRaw){if(latest)session=restore(latest);else blocked=true;lastRaw=latest;notice='另一窗口已改变本章进度。请核对当前画面后再操作。';render();return false;}
            const raw=JSON.stringify({game:next.snapshot(),savedAt:Date.now()} satisfies Stored);
            localStorage.setItem(key,raw);lastRaw=raw;session=next;
            if(!isolated)recordChapterHistory('luofengpo',session.ending?.kind==='complete');
            archiveWarning=recordPangtongEnding(session,isolated)?'':'结局进度已保存，成就卡册暂未写入；再次进入本章时会重试。';return true;
        }catch{notice='进度没有保存，本次选择尚未执行。请释放存储空间后重试。';render();return false;}
    }
    function advance(option?:string){if(modal||blocked)return;const next=new PangtongSession(story,session.history,session.snapshot());if(next.advance(option)&&write(next)){notice='';audio.action('next');render();}}
    function savePanel(){
        return `<div class="pt-slots"><p>手动存档保留本轮选择与此前经历。</p>${[1,2,3].map(i=>{let stamp='空';try{const raw=localStorage.getItem(`${key}:slot:${i}`);if(raw){const value=JSON.parse(raw);stamp=new Date(value.savedAt).toLocaleString('zh-CN');}}catch{stamp='记录无法读取';}return `<div class="pt-slot"><span>位置 ${i} · ${esc(stamp)}</span><button class="folio-button" data-action="save-slot" data-slot="${i}">保存</button><button class="quiet-button" data-action="load-slot" data-slot="${i}" ${stamp==='空'?'disabled':''}>读取</button></div>`;}).join('')}</div>`;
    }
    function commitSlot(slot:string){try{localStorage.setItem(`${key}:slot:${slot}`,JSON.stringify({game:session.snapshot(),savedAt:Date.now()} satisfies Stored));notice='已保存。';pendingSlot='';modal=savePanel();render();}catch{notice='手动存档未能写入。';render();}}
    async function restart(){try{const raw=localStorage.getItem(key);if(raw)localStorage.setItem(`${key}:before-new`,raw);lastRaw=raw;const fresh=new PangtongSession(story,await captureCampaign());if(write(fresh)){blocked=false;notice='';modal='';render();}}catch{notice='原记录未能备份，尚未重玩。';render();}}
    function records(){return `<div class="pt-records">${session.transcript.length?session.transcript.map(l=>`<article><strong>${esc(l.speaker)}</strong><p>${esc(l.text)}</p></article>`).join(''):'<p>这一程刚刚开始。</p>'}</div>`;}
    root.addEventListener('click',event=>{
        const el=event.target as HTMLElement,button=el.closest<HTMLElement>('[data-action],[data-option]');
        if(modal&&!el.closest('.game-modal'))return;
        if(button?.dataset.option){advance(button.dataset.option);return;}
        const a=button?.dataset.action;
        if(a==='next'){advance();return;}
        if(a==='close-modal'||a==='resume'||a==='cancel'){close();return;}
        if(a==='pause')open(`<div class="pt-modal-actions"><button class="folio-button" data-action="resume">继续</button><button class="folio-button" data-action="save">存档</button><button class="folio-button" data-action="records">对话记录</button><button class="quiet-button" data-action="restart">重玩本章</button><button class="quiet-button" data-action="map">返回舆图</button></div>`);
        else if(a==='history')open(campaignPanel(session));
        else if(a==='records')open(records());
        else if(a==='save')open(savePanel());
        else if(a==='save-slot'){
            const slot=button!.dataset.slot!;if(blocked){notice='旧进度尚未恢复，不能用当前画面覆盖手动档。';render();return;}
            if(localStorage.getItem(`${key}:slot:${slot}`)){pendingSlot=slot;open(`<p>覆盖位置 ${slot} 的旧记录？</p><div class="pt-modal-actions"><button class="folio-button" data-action="overwrite">确认覆盖</button><button class="quiet-button" data-action="cancel">取消</button></div>`);}else commitSlot(slot);
        }else if(a==='overwrite'&&pendingSlot)commitSlot(pendingSlot);
        else if(a==='load-slot'){
            try{const raw=localStorage.getItem(`${key}:slot:${button!.dataset.slot}`);if(!raw)throw new Error();const next=restore(raw);if(lastRaw)localStorage.setItem(`${key}:before-load`,lastRaw);if(write(next)){blocked=false;notice='已读取。';modal='';render();}}
            catch{notice='这份存档无法读取，当前进度未改变。';render();}
        }else if(a==='retry'){
            try{if(write(session.retry())){modal='';notice='';render();}}catch{notice='重试起点无法恢复，当前存档仍保留。';render();}
        }else if(a==='restart')open('<p>当前进度会先备份。重玩从章首开始，并重新读取此前各章的结果。</p><div class="pt-modal-actions"><button class="folio-button" data-action="restart-confirm">重玩第七章</button><button class="quiet-button" data-action="cancel">继续这一程</button></div>');
        else if(a==='restart-confirm')void restart();
        else if(a==='map')location.href='/?view=chapters';
        else if(a==='album')location.href='/?view=chapters&album=luofengpo';
        else if(a==='home')location.href='/';
        else if(!button&&!modal&&!el.closest('button,a,input,summary,nav,select,textarea')&&session.current.kind==='line')advance();
    });
    root.addEventListener('keydown',event=>{
        if(modal){
            if(event.key==='Escape'){event.preventDefault();close();}
            if(event.key==='Tab'){const items=Array.from(root.querySelectorAll<HTMLElement>('.game-modal button:not([disabled]),.game-modal a[href]'));const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
        }else if([' ','Enter'].includes(event.key)&&!(event.target as HTMLElement).closest('button,a,input,textarea,select')){event.preventDefault();if(session.current.kind==='line')advance();}
    });
    window.addEventListener('storage',event=>{if(event.key!==key)return;try{if(!event.newValue)throw new Error();session=restore(event.newValue);lastRaw=event.newValue;blocked=false;modal='';notice='本章已同步另一窗口的进度。';}catch{lastRaw=event.newValue;blocked=true;notice='本章记录已变化，请通过菜单重玩或读取手动档。';}render();});
    if(!blocked&&!lastRaw)write(session);
    else if(!blocked)archiveWarning=recordPangtongEnding(session,isolated)?'':'结局进度已保存，成就卡册暂未写入；再次进入本章时会重试。';
    render();
    const url=new URL(location.href);if(url.searchParams.get('restart')==='1'){url.searchParams.delete('restart');history.replaceState(null,'',url);open('<p>重玩会备份当前记录，重新读取此前经历。</p><div class="pt-modal-actions"><button class="folio-button" data-action="restart-confirm">重玩第七章</button><button class="quiet-button" data-action="cancel">继续当前进度</button></div>');}
}
start().catch(error=>{root.innerHTML=`<main style="padding:15vh 10vw"><h1>第七章暂未载入</h1><p>${esc(error instanceof Error?error.message:'请刷新重试。')}</p><a href="/?view=chapters">返回舆图</a></main>`;});
