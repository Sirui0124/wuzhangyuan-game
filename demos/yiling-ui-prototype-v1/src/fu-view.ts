import type {FuSession,FuTask} from './fu-client.js';
export const FU_TASKS:Record<FuTask,string>={rescue:'护送傅肜',scout:'探查撤路',relieve:'接替断后',suppress:'压制追兵',verify:'核实刘备消息',signal:'传撤离信号',hold:'原地待命',rest:'原地休整',retreat:'撤回接应营'};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function fuMessages(session:FuSession|null,busy:boolean){
  if(!session)return `<div class="empty">${busy?'正在建立与傅肜的联络……':'暂未读到傅肜的营救记录。'}</div>`;
  return session.messages.map(m=>{
    const mine=['我','玩家','player','user'].includes(m.speaker),who=mine?'我':m.speaker;
    const kind=({chat:'对话',dialogue:'回应',question:'问话',reply:'回应',order:'军令',orders:'军令',round:'本轮回报',report:'军报',system:'军情',receipt:'行动回执'} as Record<string,string>)[m.kind]||'回报';
    return `<article class="entry ${mine?'mine':''}" data-fu-message="${esc(String(m.id))}"><div class="meta"><strong>${esc(who)}</strong><span>${kind}</span><time>第${m.round}轮</time></div><p>${esc(m.text)}</p></article>`;
  }).join('')||'<div class="empty">写下想对傅肜说的话。</div>';
}
