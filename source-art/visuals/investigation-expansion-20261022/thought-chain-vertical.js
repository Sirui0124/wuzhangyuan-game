"use strict";
const { stages, evidence, steps, assess } = GrainJudgment;
const scroll = document.querySelector('#scroll'), flow = document.querySelector('#flow'), detail = document.querySelector('#detail');
const blank = () => ({ choice: null, proofs: [], saved: false, picker: false, feedback: '', kind: null });
let opened = 0, states = steps.map(blank), phase = null;
let motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const previewKey = 'wuzhang-grain-chain-preview-v3';
const wrongRoute = () => states[0].saved && states[0].kind === 'inquiry';
const fullTrace = () => states.every(s => s.saved && s.kind === 'supported');
try {
  const p = JSON.parse(sessionStorage.getItem(previewKey) || 'null');
  if (p && Number.isInteger(p.opened) && p.opened >= 0 && p.opened < 4 && Array.isArray(p.states) && p.states.length === 4) {
    opened = p.opened;
    states = p.states.map((s, i) => {
      const next = blank();
      next.choice = [0, 1].includes(s.choice) ? s.choice : null;
      next.proofs = Array.isArray(s.proofs) ? [...new Set(s.proofs.filter(id => steps[i].available.includes(id)))] : [];
      const v = assess(i, next.choice, next.proofs);
      next.saved = !!s.saved && v.ok; next.kind = next.saved ? v.kind : null;
      next.feedback = next.saved ? v.reason : ''; return next;
    });
    states.forEach((s, i) => { if (states.slice(0, i).some(prev => !prev.saved || prev.kind !== 'supported')) { s.saved = false; s.kind = null; } });
    if (wrongRoute() && ['proposal', 'questioned', 'confirm', 'bad'].includes(p.phase)) phase = p.phase;
    else if (fullTrace() && ['trace-ready', 'trace-done'].includes(p.phase)) phase = p.phase;
  }
} catch {}
function keepPreview() { try { sessionStorage.setItem(previewKey, JSON.stringify({ opened, states, phase })); } catch {} }
function closeDetail() { detail.hidden = true; }
function invalidateFrom(i) {
  states.slice(i).forEach((s, offset) => { s.saved = false; s.kind = null; s.feedback = offset ? '前面的判断已改动，这一步需要重新核对。' : ''; });
  phase = null;
}
function actionHTML() {
  if (!phase) return '';
  const head = '<section id="action-panel" class="action-panel" aria-live="polite">';
  if (phase === 'proposal') return head + '<span class="action-mark">可以行动</span><h2>去问苟安，途中究竟损耗了多少。</h2><p>这一步有经手与损耗记录可循。但询问损耗，尚不能把整笔缺额归罪于他。</p><div class="action-buttons"><button class="save" data-action="ask">去找苟安核问</button><button class="revise" data-action="return">先回去对账</button></div></section>';
  if (phase === 'questioned') return head + '<span class="action-mark">伤帐 · 苟安</span><h2>“好，这笔罪，我认。”</h2><blockquote>“你报上去吧，别再查了。”</blockquote><p>他认下了罪，却没有解释领粮时已经存在的缺口。</p><button class="testimony" data-testimony>查看这句口供</button><div class="action-buttons"><button class="save" data-action="return">继续核查粮账</button><button class="danger-action" data-action="close-case">采信认罪，停止追查</button></div></section>';
  if (phase === 'confirm') return head + '<span class="action-mark">呈报之前</span><h2>就凭现有材料，结束调查？</h2><p>你将把粮账与苟安的口供一同呈报，并停止继续追查。口供尚未解释清楚这笔缺额。</p><div class="action-buttons"><button class="revise" data-action="cancel-close">再问一问</button><button class="danger-action" data-action="confirm-close">确认结案并呈报</button></div></section>';
  if (phase === 'bad') return head + '<span class="action-mark">调查失败</span><h2>认下来的罪</h2><p>材料呈交，查办接管。真实缺额上报后，大军因粮不足而退。苟安被带走时，只问了一句：</p><blockquote>“大军退了吗？”</blockquote><p>你收下了他的认罪，却没有查清他要让大军退去的安排。</p><button class="save" data-action="retry">回到对质前重查</button></section>';
  if (phase === 'trace-ready') return head + '<span class="action-mark">可以行动</span><h2>粮从未备齐。再核苟安当时知不知道。</h2><p>账目能说明缺额所在，还不能仅凭缺额判断他的用意。</p><button class="save" data-action="verify-signature">请管事核查缺额报告与签认</button></section>';
  return head + '<span class="action-mark">仓中核验</span><h2>他早已签认“未征齐”。</h2><p>管事取出仓中留存的缺额报告，经手人核实：同村、同批、同日；苟安在受杖前已签认未征齐，同日仓账也未补足。</p><p>下一步，可以带着这份签认，问他为何仍说“粮已备妥”。</p><div class="sample-boundary">样稿演示至此；后续对白与结局留待第二幕完整策划。</div></section>';
}
function render(newStep = -1, toAction = false) {
  keepPreview(); const top = scroll.scrollTop; closeDetail();
  flow.innerHTML = steps.slice(0, opened + 1).map((s, i) => {
    const st = states[i];
    return `<section class="step ${newStep === i ? 'new' : ''}" id="step-${i}" aria-label="${s.question}">
      <div class="stage"><span class="ordinal">${['壹', '贰', '叁', '肆'][i]}</span><span class="from">${stages[i]}</span><span>↓</span><span class="to">${stages[i + 1]}</span></div>
      <h2>${s.question}</h2><div class="pair"><div><div class="choices">${s.choices.map((c, n) => `<button class="choice" data-step="${i}" data-choice="${n}" aria-pressed="${st.choice === n}" ${st.saved || phase === 'bad' ? 'disabled' : ''}>${c}</button>`).join('')}</div>
      ${st.saved && phase !== 'bad' ? `<button class="revise" data-revise="${i}">修改判断与依据</button>` : ''}</div>
      ${st.choice !== null ? `<div class="proofs"><p>${st.saved ? '提交时的依据' : '凭什么这样想？'}</p><div class="placed">${st.proofs.map(id => `<span class="slip"><button data-read="${id}">${evidence[id][0]}</button>${st.saved || phase === 'bad' ? '' : `<button class="remove" data-remove="${id}" data-step="${i}" aria-label="收回${evidence[id][0]}">×</button>`}</span>`).join('')}</div>
      ${st.saved || phase === 'bad' ? '' : `<button class="add" data-picker="${i}" aria-expanded="${st.picker}">＋ 添入线索</button>${st.picker ? `<div class="picker" aria-label="已取得的材料">${s.available.map(id => `<div class="pickrow"><button class="read" data-read="${id}">${evidence[id][0]}</button><button class="put" data-put="${id}" data-step="${i}" aria-label="${st.proofs.includes(id) ? '收回' : '放入'}${evidence[id][0]}">${st.proofs.includes(id) ? '✓' : '＋'}</button></div>`).join('')}</div>` : ''}
      <div class="submission"><button class="save" data-submit="${i}">提交判断</button><span>核对依据后，才形成下一步。</span></div>`}</div>` : ''}</div>
      ${st.feedback ? `<div class="summary ${st.saved ? 'accepted' : 'blocked'}" role="status"><em>${st.saved ? st.kind === 'inquiry' ? '可据此追问' : '依据相合' : '尚不能提交'}</em><p>${st.feedback}</p></div>` : ''}</section>`;
  }).join('') + (!phase && opened < 3 ? `<div class="future" aria-label="后续粮路">${stages.slice(opened + 2).map(n => `<span>↓　${n}</span>`).join('')}</div>` : '') + actionHTML();
  scroll.scrollTop = top;
  document.querySelector('#progress').textContent = phase === 'bad' ? '调查失败' : `${['壹', '贰', '叁', '肆'][opened]} · ${stages[opened]}`;
  if (toAction || newStep >= 0) requestAnimationFrame(() => (toAction ? document.querySelector('#action-panel') : document.querySelector('#step-' + newStep))?.scrollIntoView({ block: 'start', behavior: motion ? 'smooth' : 'auto' }));
}
function showDetail(id, anchor) {
  const row = id === 'testimony' ? ['苟安的认罪', '“好，这笔罪，我认。你报上去吧，别再查了。”这是他实际说出的口供，不能自动当作已查清的事实。', '伤帐对话 · 行动后取得'] : evidence[id];
  detail.innerHTML = `<button id="close-detail" aria-label="关闭详情">×</button><strong>${row[0]}</strong><p>${row[1]}</p><small>${row[2]}</small>`;
  detail.hidden = false;
  const r = anchor.getBoundingClientRect(), w = detail.offsetWidth, h = detail.offsetHeight;
  let left = r.right + 12;
  if (left + w > innerWidth - 12) left = Math.max(12, r.left - w - 12);
  let top = Math.max(12, Math.min(r.top, innerHeight - h - 12));
  if (innerWidth < 700) { left = 12; top = r.bottom + h + 12 < innerHeight ? r.bottom + 8 : Math.max(12, r.top - h - 8); }
  detail.style.left = left + 'px'; detail.style.top = top + 'px';
}
function returnToBooks() { phase = null; invalidateFrom(0); states[0].picker = true; render(0); }
function act(action) {
  if (action === 'return' && wrongRoute() && phase !== 'bad') returnToBooks();
  else if (action === 'ask' && wrongRoute() && phase === 'proposal') { phase = 'questioned'; render(-1, true); }
  else if (action === 'close-case' && wrongRoute() && phase === 'questioned') { phase = 'confirm'; render(-1, true); }
  else if (action === 'cancel-close' && phase === 'confirm') { phase = 'questioned'; render(-1, true); }
  else if (action === 'confirm-close' && wrongRoute() && phase === 'confirm') { phase = 'bad'; render(-1, true); }
  else if (action === 'retry' && phase === 'bad') returnToBooks();
  else if (action === 'verify-signature' && fullTrace() && phase === 'trace-ready') { phase = 'trace-done'; render(-1, true); }
}
function submit(i) {
  if (phase === 'bad') return;
  if (states.slice(0, i).some(s => !s.saved || s.kind !== 'supported')) { states[i].feedback = '前面的依据还没有核对成立，先回看前面的判断。'; render(); return; }
  const st = states[i], result = assess(i, st.choice, st.proofs);
  st.feedback = result.reason;
  if (!result.ok) { st.saved = false; st.kind = null; render(); return; }
  st.saved = true; st.kind = result.kind; st.picker = false;
  if (result.route === 'ask-loss') { phase = 'proposal'; render(-1, true); }
  else if (i < 3) { opened = Math.max(opened, i + 1); render(i + 1); }
  else if (fullTrace()) { phase = 'trace-ready'; render(-1, true); }
}
 document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) { if (!detail.contains(e.target)) closeDetail(); return; }
  if (t.disabled) return;
  const i = Number(t.dataset.step);
  if (t.dataset.choice !== undefined) {
    if (phase === 'bad') return;
    const st = states[i], n = Number(t.dataset.choice);
    if (st.choice !== n) { invalidateFrom(i); st.proofs = []; }
    st.choice = n; st.picker = false; render();
  } else if (t.dataset.picker !== undefined) { const st = states[Number(t.dataset.picker)]; st.picker = !st.picker; render(); }
  else if (t.dataset.put || t.dataset.remove) {
    const id = t.dataset.put || t.dataset.remove, st = states[i];
    if (st.choice === null || !steps[i].available.includes(id) || phase === 'bad') return;
    invalidateFrom(i); st.proofs = st.proofs.includes(id) ? st.proofs.filter(x => x !== id) : [...st.proofs, id]; render();
  } else if (t.dataset.read) showDetail(t.dataset.read, t);
  else if (t.hasAttribute('data-testimony') && ['questioned', 'confirm', 'bad'].includes(phase)) showDetail('testimony', t);
  else if (t.dataset.submit !== undefined) submit(Number(t.dataset.submit));
  else if (t.dataset.revise !== undefined) { invalidateFrom(Number(t.dataset.revise)); render(); }
  else if (t.dataset.action) act(t.dataset.action);
  else if (t.id === 'close-detail') closeDetail();
  else if (!detail.contains(t)) closeDetail();
});
scroll.addEventListener('scroll', closeDetail, { passive: true });
window.addEventListener('resize', closeDetail);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
document.querySelector('#latest').onclick = () => (document.querySelector('#action-panel') || document.querySelector('#step-' + opened)).scrollIntoView({ block: 'start', behavior: motion ? 'smooth' : 'auto' });
document.querySelector('#reset').onclick = () => { opened = 0; states = steps.map(blank); phase = null; render(); scroll.scrollTo({ top: 0, behavior: motion ? 'smooth' : 'auto' }); };
function setMotion() { document.body.classList.toggle('no-motion', !motion); const b = document.querySelector('#motion'); b.textContent = '动效 ' + (motion ? '开' : '关'); b.setAttribute('aria-pressed', String(motion)); }
document.querySelector('#motion').onclick = () => { motion = !motion; setMotion(); };
setMotion(); render(opened > 0 && !phase ? opened : -1, !!phase);
