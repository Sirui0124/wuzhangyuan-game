'use strict';
// Keep the selected B2 direction and reuse the prototype's state handling.
for (const key of Object.keys(directions)) delete directions[key];
directions.b2={name:'墨笺',tag:'',description:'',materials:'',structure:'',fit:'',colors:[]};
message=(role,text)=>`<article class="message ${role}" aria-label="${role==='user'?'我':'我的系统'}"><div class="bubble">${escapeHTML(text)}</div></article>`;
product=mode=>{
 const owned=mode==='purchased';
 return `<section class="product" aria-label="纸笔套装"><div class="product-head"><div class="product-title"><h3>纸笔套装</h3></div><span class="product-price"><small>估价</small> ¥12</span></div><p class="product-description">记录本 × 1 · 中性笔 × 1</p><details><summary>详情</summary><p>可记录与复核军令，不能证明未见之事。</p><p>示例估价，未核实市场价。使用游戏资金，不产生真实订单。</p></details>${owned?'<span class="owned-note">已购入</span><button class="buy-btn attach" aria-pressed="false">附到这次发言</button>':`<button class="buy-btn purchase" ${mode==='insufficient'?'disabled':''}>${mode==='insufficient'?'资金不足':'按估价购入'}</button>`}</section>`;
};
chatHTML=mode=>{
 if(mode==='chat')return message('user','白布能证明有人死了吗？')+message('assistant','白布可以用作约定好的信号，但它本身不能证明一个人的生死。');
 if(mode==='waiting')return message('user','怎样把军令记录清楚？')+'<div class="pending" role="status"><span class="breath-dot" aria-hidden="true"></span>正在回复…</div>';
 if(mode==='failed')return message('user','怎样把军令记录清楚？')+'<div class="failure" role="status">回复中断，内容已保留。<br><button class="retry">重新发送</button></div>';
 return message('user','帮我买一套纸笔，方便记录军令。')+message('assistant','当面记下军令，再念回核对。')+product(mode);
};
phoneHTML=(key,mode)=>{
 const balance=mode==='purchased'?38:mode==='insufficient'?8:50;
 return `<div class="phone" aria-label="墨笺手机助手设计"><header class="phone-head"><span class="assistant-mark" aria-hidden="true">伴</span><div class="head-title"><h2>我的系统</h2></div><div class="wallet" aria-label="余额"><strong>¥${balance}</strong></div><button class="close" aria-label="收起手机">×</button></header><div class="chat" aria-label="聊天记录">${chatHTML(mode)}</div><section class="composer"><div class="suggestions"><button data-prompt="帮我买">买东西</button><button data-prompt="我想问问">问一问</button></div><div class="input-row"><textarea maxlength="600" rows="2" aria-label="给手机助手发消息" placeholder="想问什么，或买什么？">${mode==='failed'||mode==='waiting'?'我想问问怎样把军令记录清楚？':''}</textarea><button class="send" ${mode!=='failed'&&mode!=='waiting'?'disabled':''}>${mode==='waiting'?'停止':'发送'}</button></div></section><div class="phone-return" hidden><h3>手机已收起</h3><button class="reopen">重新打开</button></div></div>`;
};
applyView=()=>{document.body.classList.remove('single-view');document.getElementById('direction-detail').hidden=true;};
applyFont=()=>{for(const c of gallery.children)c.style.setProperty('--font-body',"'KaiTi','STKaiti',serif");};
const selectedState=new URLSearchParams(location.search).get('state')||'offer';
document.getElementById('state').value=selectedState;
render(selectedState);
