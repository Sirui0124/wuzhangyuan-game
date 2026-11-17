const list = document.querySelector('#videos');
const message = document.querySelector('#message');
const editors = [];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || '读取失败'), {status:response.status, data});
  return data;
}
function clock(time) { return `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2,'0')}`; }
function attachComment(card, clip, saved, notes) {
  const key = `${clip.id}:${clip.version}`;
  const localKey = `film-studio-comment:${key}`;
  const input = card.querySelector('textarea');
  const status = card.querySelector('.save-state');
  const retry = card.querySelector('.retry');
  const conflictBox = card.querySelector('.conflict');
  let revision = saved?.revision || 0;
  let savedText = saved?.text || '';
  let timer, busy = false, conflict = false;
  input.value = savedText;
  function show(text, error = false) { status.textContent = text; status.classList.toggle('error',error); }
  function stash() {
    try {
      if (input.value === savedText) localStorage.removeItem(localKey);
      else localStorage.setItem(localKey,JSON.stringify({text:input.value,baseRevision:revision}));
    } catch { show('浏览器暂存不可用，请等待本机保存完成。',true); }
  }
  function resolveConflict(remote) {
    conflict = true;
    show('另一页面更新了评论，请核对后选择。',true);
    conflictBox.hidden = false;
    conflictBox.querySelector('p').textContent = remote?.text || '（已清空）';
    conflictBox.querySelector('[data-use="saved"]').onclick = () => {
      revision = remote?.revision || 0; savedText = remote?.text || ''; input.value = savedText;
      conflict = false; conflictBox.hidden = true; retry.hidden = true; stash(); show('已载入保存的评论');
    };
    conflictBox.querySelector('[data-use="mine"]').onclick = () => {
      revision = remote?.revision || 0; savedText = remote?.text || '';
      conflict = false; conflictBox.hidden = true; stash(); save();
    };
  }
  async function save() {
    clearTimeout(timer);
    if (busy || conflict) return;
    if (input.value === savedText) { stash(); show(saved ? '已保存' : ''); return; }
    busy = true; retry.hidden = true;
    const text = input.value;
    show('保存中…');
    let success = false;
    try {
      const review = await request('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'comment',clip:clip.id,version:clip.version,revision,text})});
      const next = review.comments[key];
      revision = next.revision; savedText = next.text; saved = next; success = true;
      stash(); show(input.value === savedText ? '已保存' : '等待保存…');
    } catch (error) {
      if (error.status === 409 && error.data.comment) resolveConflict(error.data.comment);
      else { show(`${error.message} · 输入已保留`,true); retry.hidden = false; }
    } finally {
      busy = false;
      if (success && input.value !== savedText) save();
    }
  }
  input.oninput = () => { stash(); if (!conflict) { show('等待保存…'); clearTimeout(timer); timer = setTimeout(save,700); } };
  input.onblur = save;
  retry.onclick = save;
  editors.push({dirty:() => busy || input.value !== savedText, save});
  if (saved) show('已保存');
  try {
    const draft = JSON.parse(localStorage.getItem(localKey) || 'null');
    if (draft && typeof draft.text === 'string' && draft.text !== savedText) {
      input.value = draft.text;
      if (draft.baseRevision !== revision) resolveConflict(saved);
      else { show('已恢复未保存输入'); timer = setTimeout(save,700); }
    }
  } catch { /* 保存接口仍可用。 */ }
  if (notes.length) {
    const previous = document.createElement('details');
    previous.className = 'previous-notes';
    previous.innerHTML = `<summary>之前的审片记录（${notes.length}）</summary>` + notes.map(n => `<p><small>${clock(n.time)} · ${esc(n.category)}</small><br>${esc(n.text)}</p>`).join('');
    card.querySelector('.comment-area').append(previous);
  }
}
async function init() {
  try {
    const [catalog, review] = await Promise.all([request('/api/catalog'),request('/api/review')]);
    document.querySelector('#summary').textContent = `${catalog.clips.length} 段视频 · 评论自动保存到本机`;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        const video = entry.target;
        video.src = `${video.dataset.src}#t=0.1`;
        observer.unobserve(video);
      }
    },{rootMargin:'250px'});
    for (const clip of catalog.clips) {
      const card = document.createElement('article');
      card.className = 'video-card';
      card.dataset.search = `${clip.id} ${clip.title}`.toLowerCase();
      const label = `comment-${clip.order}`;
      card.innerHTML = `<h2><span class="number">${String(clip.order).padStart(2,'0')}</span>${esc(clip.title)}</h2><div class="card-body"><video controls playsinline preload="metadata" aria-label="${esc(clip.title)}" data-src="${esc(clip.url)}"></video><div class="comment-area"><label for="${label}">评论</label><textarea id="${label}" maxlength="15000" placeholder="在这里记下需要修改的地方…"></textarea><span class="save-state" role="status"></span><button class="retry" hidden>重新保存</button><details class="conflict" hidden><summary>查看已保存的评论</summary><p></p><button data-use="saved">使用已保存的评论</button> <button data-use="mine">保存我的评论</button></details></div></div>`;
      list.append(card);
      attachComment(card,clip,review.comments?.[`${clip.id}:${clip.version}`],review.notes.filter(n => n.clip === clip.id && n.version === clip.version));
      const video = card.querySelector('video');
      observer.observe(video);
      video.onplay = () => list.querySelectorAll('video').forEach(other => { if (other !== video) other.pause(); });
    }
    document.querySelector('#search').oninput = event => {
      const query = event.target.value.trim().toLowerCase();
      let visible = 0;
      for (const card of list.children) {
        card.hidden = !card.dataset.search.includes(query);
        if (!card.hidden) visible++; else card.querySelector('video').pause();
      }
      message.textContent = visible ? '' : '没有找到对应的视频。';
    };
  } catch (error) { message.textContent = `读取失败：${error.message}。请确认片场服务已启动，再刷新页面。`; }
}
window.addEventListener('beforeunload',event => {
  if (editors.some(editor => editor.dirty())) { event.preventDefault(); event.returnValue = ''; }
});
document.addEventListener('visibilitychange',() => { if (document.hidden) editors.forEach(editor => editor.save()); });
init();
