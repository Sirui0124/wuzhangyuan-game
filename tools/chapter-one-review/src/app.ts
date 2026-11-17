import { Dialogue, type Story, type Line, type AiReceipt } from './engine.js';
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const storageKey = 'wuzhang:isolated-dialogue-review:v3';
const draftKey = storageKey + ':draft';
let game: Dialogue;
let drawerOpen = false, draft = '', busy = false;
let aiAvailable: boolean | null = null;
let active: { controller: AbortController; at: string; requestId: string } | null = null;
let replyWasFixed = false;
const make = (tag: string, text = '', cls = '') => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; };
const fingerprint = () => JSON.stringify([game.story.version, game.nodeId, game.audit]);
function renderLine(line: Line) {
  if (line.speaker === '演出') return make('p', line.text, 'narration');
  if (line.speaker === '告示') return make('div', line.text, 'notice-text');
  if (line.speaker === '结算' || line.speaker === '审阅') return make('p', line.text, 'settlement');
  const row = make('div', '', 'speech' + (line.speaker.includes('心声') ? ' thought' : ''));
  row.append(make('span', line.speaker, 'speaker'), make('p', line.text)); return row;
}
function persistDraft() { try { localStorage.setItem(draftKey,JSON.stringify({at:fingerprint(),text:draft})); } catch {} }
function persist() {
  try { localStorage.setItem(storageKey, game.serialize()); el('save-status').textContent = '阅读进度已保存在此浏览器'; }
  catch { el('save-status').textContent = '本次进度未能保存，刷新将从头开始'; }
  persistDraft();
}
function cancelRequest() { if (active) { active.controller.abort(); active = null; } updateInputState(); }
function notice(text: string) { el('notice').textContent = text; el('notice').hidden = false; }
function act(action: () => void) {
  if (busy || !game) return;
  busy = true; cancelRequest(); replyWasFixed=false;
  try { action(); render(); el('scene').focus({ preventScroll: true }); el('scene').scrollIntoView({ behavior: 'instant', block: 'start' }); }
  catch (e) { notice(e instanceof Error ? e.message : '读取失败，请返回上一段重试。'); }
  finally { setTimeout(() => { busy = false; }, 100); }
}
function button(label: string, callback: () => void, cls = '', id?: string, key?: string) {
  const b = make('button', '', 'option ' + cls) as HTMLButtonElement;
  b.type = 'button'; if (id) b.dataset.choice = id;
  if (key) b.append(make('span', key, 'key'));
  b.append(make('span', label), make('span', '→', 'arrow'));
  b.addEventListener('click', () => act(callback)); return b;
}
function renderDrawer() {
  el('drawer').hidden = !drawerOpen; el('notes').setAttribute('aria-expanded', String(drawerOpen));
  const log = el('history'); log.replaceChildren();
  for (const frame of [...game.trail].reverse()) {
    const item = document.createElement('details'); item.append(make('summary', frame.selected ? `我选择：${frame.selected}` : frame.title));
    for (const line of frame.lines) item.append(make('p', (line.speaker === '演出' ? '' : line.speaker + '：') + line.text));
    log.append(item);
  }
  if (!game.trail.length) log.append(make('p', '从眼前这一段开始。', 'empty'));
}
function updateInputState() {
  const submitting=!!active;
  el<HTMLButtonElement>('submit').disabled=submitting;
  el('submit').textContent=submitting?'正在回应…':game?.aiScene?'说给魏延听':'问他';
  el('cancel').hidden=!submitting;
  el('question').setAttribute('aria-busy',String(submitting));
  el('ai-status').textContent=submitting?'正在听你的话，可以取消或修改原话。':game?.aiScene?(aiAvailable===false?'AI暂不可用，可保留原话后重试。':game.exchange.length?`已交流 ${game.exchange.length} 轮，可以接着补充。`:'可以用自己的话说，不必照填提示句。'):'小甲问话使用本地识别';
}
function render() {
  el('title').textContent = game.frame.title;
  el('eyebrow').textContent = game.frame.kind === 'ending' ? '这一夜的结果' : game.frame.kind === 'terminal' ? '本次阅读结束' : game.pending ? '我的回应' : '第一章 · 第六夜';
  el('lines').replaceChildren(...game.frame.lines.map(renderLine));
  const controls = el('controls'); controls.replaceChildren();
  if (game.pending || game.node.kind === 'passage') controls.append(button('继续', () => game.next(), 'next', 'next'));
  else if (game.node.kind === 'terminal') {
    controls.append(button('回到上一段', () => game.back(), '', 'back'));
    controls.append(button('从小甲重新开始', () => { draft = ''; game.restart(); }, '', 'restart'));
  } else if(game.aiHeld) controls.append(button('重新组织这段话',()=>{game.retryAi();draft='';},'', 'retry-ai'));
  else for (const [index, c] of game.choices.entries()) controls.append(button(c.label!, () => { draft = ''; game.choose(c.id!); }, '', c.id, String(index + 1).padStart(2, '0')));
  const ai=game.aiScene;
  el('question').hidden = !!game.pending || game.aiHeld || (!game.node.freeInput && !ai);
  el('input-label').textContent=ai?.inputLabel ?? '也可以自己问一句';
  el('scaffold').hidden=!ai; el('scaffold').textContent=ai?.scaffold ?? '';
  el('context-hint').hidden=!game.aiHint; el('context-hint').textContent=game.aiHint;
  const input=el<HTMLTextAreaElement>('input'); input.value=draft;input.maxLength=ai?800:400;input.placeholder=ai?.placeholder ?? '向小甲问一句……';
  el<HTMLButtonElement>('back').disabled = !game.history.length;
  el('notice').hidden = true;
  if(replyWasFixed)notice('AI措辞暂未生成，本轮使用预写回应，已保留原判断。');
  el('node-info').textContent = `${game.story.version} · ${game.nodeId}`;
  el('scene').dataset.node = game.nodeId;
  el('scene').dataset.phase = game.pending ? 'reply' : game.node.kind;
  el('scene').dataset.ending = game.node.endingId ?? '';
  renderDrawer(); updateInputState(); persist();
}
async function submit() {
  if(active||busy)return;
  if(!game.aiScene) {act(()=>{game.ask(draft);draft='';});return;}
  const text=draft.trim();if(!text){notice('先写下想对魏延说的话。');return;}
  const request={controller:new AbortController(),at:fingerprint(),requestId:crypto.randomUUID()};active=request;
  el('notice').hidden=true; updateInputState();persistDraft();
  try {
    const response=await fetch('/api/ai/turn',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([request.controller.signal,AbortSignal.timeout(60000)]),body:JSON.stringify({requestId:request.requestId,version:game.story.version,nodeId:game.nodeId,audit:game.audit,text})});
    const result=await response.json();
    if(active!==request || fingerprint()!==request.at || draft.trim()!==text)return;
    if(!response.ok)throw Error(result.error || 'AI暂时没有回应，原话已保留。');
    if(result.requestId!==request.requestId)throw Error('AI回应与本次发言不符，请重试。');
    game.applyAi(text,result as AiReceipt);draft='';active=null;replyWasFixed=result.replySource==='fixed';render();
    el('scene').focus({preventScroll:true});el('scene').scrollIntoView({behavior:'instant',block:'start'});
  } catch(e) {
    if(active!==request)return;
    active=null;updateInputState();notice(e instanceof Error && e.name!=='TimeoutError'?e.message:'AI回应超时，原话已保留，请重试。');
  }
}
el('back').addEventListener('click', () => act(() => { draft = ''; game.back(); }));
el('restart').addEventListener('click', () => act(() => { draft = ''; game.restart(); }));
el('notes').addEventListener('click', () => { drawerOpen = !drawerOpen; renderDrawer(); });
el('close').addEventListener('click', () => { drawerOpen = false; renderDrawer(); el('notes').focus(); });
el('cancel').addEventListener('click',()=>{cancelRequest();notice('已取消，原话保留在输入框中。');});
el('input').addEventListener('input', () => { draft = el<HTMLTextAreaElement>('input').value;if(active)cancelRequest();persistDraft(); });
el('question').addEventListener('submit', event => { event.preventDefault();void submit(); });
el('input').addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) { event.preventDefault(); el<HTMLFormElement>('question').requestSubmit(); }
});
async function init() {
  try {
    const response = await fetch('/story.json', { cache: 'no-store' });
    if (!response.ok) throw Error('剧情 JSON 未读取成功，请重新启动审阅页。');
    game = new Dialogue(await response.json() as Story);
    try {
      const saved = localStorage.getItem(storageKey); if(saved)game.load(saved);
      const stored=JSON.parse(localStorage.getItem(draftKey)??'null');if(stored?.at===fingerprint()&&typeof stored.text==='string')draft=stored.text;
    } catch { /* An invalid local review save starts fresh. */ }
    render();
    fetch('/api/ai/status').then(r=>r.json()).then(s=>{aiAvailable=!!s.configured;updateInputState();}).catch(()=>{aiAvailable=false;updateInputState();});
  } catch (error) {
    el('title').textContent = '暂时无法打开剧情'; el('lines').replaceChildren(make('p', String(error), 'narration'));
    el('controls').append(button('重新读取', () => location.reload(), 'next'));
  }
}
void init();
