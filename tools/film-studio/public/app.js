import { initChapter } from './chapter-ui.js';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock = t => { t = Math.max(0, Number(t) || 0); return `${String(Math.floor(t / 60)).padStart(2,'0')}:${(t % 60).toFixed(3).padStart(6,'0')}`; };
let catalog, review, current, compareURL, savedCameras = [], stageReady = false, chapterWorkbench;
const noteDrafts = new Map();
try { savedCameras = JSON.parse(localStorage.getItem('wzy-film-cameras-v1') || '[]'); } catch {}
const video = $('#video'), compareVideo = $('#compareVideo');
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 4500); }
async function request(url, options) { const r = await fetch(url, options); const d = await r.json(); if (!r.ok) throw Error(d.error || r.statusText); return d; }
async function download(name, data) { try { const saved=await request('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,data})});$('#lastExport').href=saved.url;$('#lastExport').hidden=false;$('#lastExport').title=saved.path;toast(`已保存到本机：${saved.name}`);return saved; } catch(e){toast(`导出失败：${e.message}`);} }
function imageDownload(name, url) { return download(name, url); }
function switchView(id) {
  const section = id === 'compare' ? 'review' : id === 'sequence' ? 'chapter' : id;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === section));
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === (id === 'stage' ? 'library' : id)));
  $('#heading').textContent = {chapter:'第一章台本',sequence:'顺序预览',review:'逐镜审片',compare:'版本对照',stage:'3D空间参考',library:'场景参考',prepare:'重拍准备'}[id];
  if (id === 'compare') $('.compare').open = true;
  if (section !== 'review') { video.pause(); compareVideo.pause(); }
  if(section==='chapter')chapterWorkbench?.activate(id);else chapterWorkbench?.pause();
  if (id === 'stage' && !$('#stageFrame').getAttribute('src')) $('#stageFrame').src = $('#stageFrame').dataset.src;
  if (id === 'stage' && stageReady) { stageAPI().set({}); updateNumbers(); }
}
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => switchView(b.dataset.view));
function decision(clip) { return review.decisions[`${clip.id}:${clip.version}`]?.status || '待review'; }
function listClips() {
  const q = $('#search').value.trim().toLowerCase();
  $('#clipList').innerHTML = catalog.clips.filter(c => `${c.id} ${c.title}`.toLowerCase().includes(q)).map(c => `<button class="clip-item ${c.id === current?.id ? 'active' : ''}" data-clip="${esc(c.id)}"><small>${String(c.order).padStart(2,'0')} / ${esc(c.id)}</small>${esc(c.title)}<span class="tag">${esc(decision(c))}</span></button>`).join('');
  $('#clipList').querySelectorAll('button').forEach(b => b.onclick = () => selectClip(b.dataset.clip));
}
function selectClip(id) {
  if(current)noteDrafts.set(`${current.id}:${current.version}`,$('#noteText').value);
  current = catalog.clips.find(c => c.id === id); video.pause(); compareVideo.pause(); video.src = current.url;
  $('#noteText').value=noteDrafts.get(`${current.id}:${current.version}`)||'';
  $('#clipCode').textContent = current.id; $('#clipTitle').textContent = current.title; $('#decision').value = decision(current);
  $('#source').textContent = `${current.file} · ${(current.bytes/1048576).toFixed(1)} MB · 版本 ${current.version}`;
  $('#timecode').textContent = clock(0); listClips(); renderNotes();
}
function renderNotes() {
  const notes = review.notes.filter(n => n.clip === current.id && n.version === current.version).sort((a,b) => a.time-b.time);
  $('#notes').innerHTML = notes.length ? notes.map(n => `<button class="note" data-time="${n.time}"><small>${clock(n.time)} · ${esc(n.category)}</small><p>${esc(n.text)}</p></button>`).join('') : '<p class="empty">这个版本还没有审片意见。</p>';
  $('#notes').querySelectorAll('button').forEach(b => b.onclick = () => { video.pause(); video.currentTime = Number(b.dataset.time); });
}
async function saveReview(payload) {
  $('#saveState').textContent = '正在保存';
  try { review = await request('/api/review', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({clip:current.id,version:current.version,...payload}) }); $('#saveState').textContent = '意见已保存到本机'; listClips(); renderNotes(); }
  catch (e) { $('#saveState').textContent = '保存失败'; throw e; }
}
$('#search').oninput = listClips;
$('#play').onclick = () => video.paused ? video.play().catch(e=>toast(e.message)) : video.pause();
function seek(delta) { video.pause(); video.currentTime = Math.max(0,Math.min(Number.isFinite(video.duration)?video.duration:0, video.currentTime+delta)); }
$('#back').onclick = () => seek(-.04); $('#forward').onclick = () => seek(.04);
video.ontimeupdate = () => $('#timecode').textContent = clock(video.currentTime);
video.onerror = () => toast('影片未能打开，请核对文件是否仍在原位置。');
$('#capture').onclick = () => { if (!video.videoWidth) return toast('请先等待视频画面加载。'); const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0); imageDownload(`${current.id}-${video.currentTime.toFixed(3)}s.png`,c.toDataURL('image/png')); };
$('#addNote').onclick = async () => {
  const text = $('#noteText').value.trim(); if(!text) return toast('先写下需要修改的地方。');
  const savedKey = `${current.id}:${current.version}`, savedTime = video.currentTime;
  $('#addNote').disabled = true;
  try { await saveReview({action:'note',time:savedTime,category:$('#category').value,text}); if(`${current.id}:${current.version}` === savedKey) $('#noteText').value=''; noteDrafts.delete(savedKey); toast(`已保存 ${clock(savedTime)} 的意见`); } catch(e) { toast(e.message); } finally { $('#addNote').disabled=false; }
};
$('#decision').onchange = async () => { try { await saveReview({action:'decision',status:$('#decision').value}); } catch(e) { $('#decision').value=decision(current); toast(e.message); } };
$('#compareSelect').onchange = () => { compareVideo.pause(); const c=catalog.clips.find(c=>c.id===$('#compareSelect').value);if(c){compareVideo.src=c.url;compareVideo.hidden=false;$('#compareHint').textContent=`右侧对照：${c.title}。意见写入左侧现用片。`;}};
$('#localVideo').onchange = () => {const f=$('#localVideo').files[0];if(!f)return;if(compareURL)URL.revokeObjectURL(compareURL);compareURL=URL.createObjectURL(f);compareVideo.src=compareURL;compareVideo.hidden=false;$('#compareHint').textContent=`右侧临时新片：${f.name}。若要评论该新片，请在意见中写明文件名；当前记录仍归左侧现用片。`;};
$('#sync').onclick = async () => {if(compareVideo.hidden)return toast('请先选择一段对照片。');compareVideo.currentTime=video.currentTime;compareVideo.muted=true;try{await Promise.all([video.play(),compareVideo.play()]);}catch(e){toast(e.message);}};
$('#closeCompare').onclick=()=>{compareVideo.pause();compareVideo.hidden=true;$('#compareSelect').value='';};
$('#exportReview').onclick=()=>{
  download('五丈原-片场审片记录.json',JSON.stringify({exported:new Date().toISOString(),...review},null,2),'application/json');
};
function stageAPI(){return $('#stageFrame').contentWindow.studio;}
function numberFields(id, values, onChange) {
  const box=$(id);box.innerHTML=values.map(v=>`<div class="number-row"><span>${v.label}</span>${v.values.map((n,i)=>`<input aria-label="${esc(v.label)} ${['X','Y','Z'][i]}" data-key="${v.key}" data-i="${i}" type="number" step="0.1" value="${Number(n).toFixed(2)}">`).join('')}</div>`).join('');
  box.querySelectorAll('input').forEach(input=>input.oninput=input.onchange=()=>{ const n=input.valueAsNumber; if(Number.isFinite(n))onChange(input.dataset.key,Number(input.dataset.i),n); });
}
function updateNumbers(){if(!stageReady)return;const api=stageAPI(),s=api.get();numberFields('#cameraNumbers',[{label:'眼',key:'eye',values:s.eye},{label:'看',key:'target',values:s.target}],(key,i,n)=>{const state=api.get();state[key][i]=n;api.set(state);});$('#fov').value=s.fov;$('#fovValue').textContent=`${s.fov}°`;$('#hideActors').checked=s.hideActors;}
function updateActor(){if(!stageReady)return;const api=stageAPI(),actor=api.actors.find(a=>a.id===$('#actor').value);const edit=api.get().actorEdits[actor.id]||{x:actor.p[0],z:actor.p[2],yaw:actor.yaw};$('#actorNumbers').innerHTML=['x','z','yaw'].map(k=>`<label>${{x:'东西 X（米）',z:'南北 Z（米）',yaw:'朝向（度）'}[k]}<input type="number" step="${k==='yaw'?5:.1}" data-key="${k}" value="${edit[k]}"></label>`).join('');$('#actorNumbers').querySelectorAll('input').forEach(input=>input.oninput=input.onchange=()=>{const value=input.valueAsNumber;if(!Number.isFinite(value))return;const s=api.get();s.actorEdits[actor.id]={...edit,[input.dataset.key]:value};Object.assign(edit,s.actorEdits[actor.id]);api.set(s);});}
function setupStage(){const api=stageAPI();if(!api)return;stageReady=true;$('#camera').innerHTML=api.cameras.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');$('#actor').innerHTML=api.actors.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');api.set({camera:'overview'});updateNumbers();updateActor();renderSavedCameras();}
$('#stageFrame').onload=setupStage;
new ResizeObserver(entries=>{for(const entry of entries){if(entry.contentRect.width>0)$('#stageFrame').style.height=`${Math.ceil(entry.contentRect.width*9/16+100)}px`;}}).observe($('#stageFrame'));
$('#camera').onchange=()=>{stageAPI().set({camera:$('#camera').value});updateNumbers();updateActor();};
$('#actor').onchange=updateActor;
$('#fov').oninput=()=>{stageAPI().set({fov:Number($('#fov').value)});$('#fovValue').textContent=`${$('#fov').value}°`;};
$('#hideActors').onchange=()=>stageAPI().set({hideActors:$('#hideActors').checked});
$('#stageImage').onclick=async()=>{if(!stageReady)return toast('片场尚未加载完成。');try{const s=stageAPI().get();await imageDownload(`五丈原-${s.camera}-参考图.png`,stageAPI().image());}catch(e){toast(e.message);}};
$('#saveCamera').onclick=()=>{const name=$('#cameraName').value.trim();if(!name)return toast('给这个机位起个名称。');savedCameras.push({name,state:stageAPI().get(),created:new Date().toISOString()});try{localStorage.setItem('wzy-film-cameras-v1',JSON.stringify(savedCameras));renderSavedCameras();toast('机位已保存在当前浏览器');}catch(e){toast('浏览器保存失败，请导出片场配置。');}};
function renderSavedCameras(){$('#savedCameras').innerHTML=savedCameras.map((c,i)=>`<button data-saved="${i}">${esc(c.name)} ↗</button>`).join('');$('#savedCameras').querySelectorAll('button').forEach(b=>b.onclick=()=>{const s=savedCameras[Number(b.dataset.saved)].state;stageAPI().set(s);$('#camera').value=s.camera;updateNumbers();updateActor();});}
$('#exportCamera').onclick=()=>{download('五丈原-片场机位.json',JSON.stringify({units:'meter',coordinate:'Y up; Z south',model:'camp-v1',current:stageAPI().get(),savedCameras},null,2),'application/json');};
$('#restoreStage').onclick=()=>{stageAPI().set({camera:$('#camera').value,fov:55,actorEdits:{},hideActors:false});updateNumbers();updateActor();toast('已恢复预设片场；保存的机位仍保留。');};
function showPrompt(id){const p=catalog.prompts.find(p=>p.id===id);$('#promptPreview').innerHTML=`<div class="eyebrow">${esc(p.id)} / 本地准备稿 · 人工待审</div><h2>${esc(p.name.slice(4))}</h2><a target="_blank" href="${encodeURI(p.url)}">打开原始 Markdown ↗</a><div class="prompt-refs">${p.refs.map((r,i)=>r.exists&&r.url?`<a href="${encodeURI(r.url)}" target="_blank"><img src="${encodeURI(r.url)}" alt="参考图${i+1}"></a>`:`<p>参考图${i+1}路径缺失</p>`).join('')}</div><pre>${esc(p.text)}</pre>`;document.querySelectorAll('[data-prompt]').forEach(b=>b.classList.toggle('active',b.dataset.prompt===id));}
async function init(){
  try{[catalog,review]=await Promise.all([request('/api/catalog'),request('/api/review')]);$('#clipCount').textContent=`${catalog.clips.length}段`;$('#saveState').textContent='本机素材已就绪';selectClip(catalog.clips[0].id);
  $('#compareSelect').innerHTML='<option value="">选择现有片段对照</option>'+catalog.clips.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
  $('#resourceCards').innerHTML=catalog.resources.map(r=>`<article class="resource-card"><div class="eyebrow">${esc(r.kind)}</div><h3>${esc(r.title)}</h3>${r.image?`<img src="${r.image}" alt="现有军营3D总览">`:''}<p>${esc(r.format)}</p><p>${esc(r.use)}</p><p class="subtle">${esc(r.limitation)}</p><a href="${r.url}" target="_blank" rel="noopener">查看来源 ↗</a></article>`).join('');
  const titles={'preview-overview.png':'全营鸟瞰','preview-interior.png':'主帐剖视','preview-ritual.png':'借寿机位','preview-council.png':'议事案与帐门','preview-guard.png':'甲的对话机位','preview-report.png':'传报棚环境','preview-jiangwei.png':'姜维帐前环境','preview-jiang.png':'姜维候见','preview-judgment.png':'问责机位','preview-ending.png':'姜维章末','preview-SC03.png':'醒来见主帐','preview-report-dialogue.png':'传报对话','camp-plan.png':'全营平面','main-tent-plan.png':'主帐平面'};
  $('#gallery').innerHTML=catalog.assetImages.map(i=>`<article><a href="${i.url}" target="_blank"><img loading="lazy" src="${i.url}" alt="${esc(titles[i.name]||i.name)}"></a><p>${esc(titles[i.name]||i.name)}</p></article>`).join('');
  $('#promptList').innerHTML=catalog.prompts.map(p=>`<button data-prompt="${p.id}">${esc(p.name)}</button>`).join('');$('#promptList').querySelectorAll('button').forEach(b=>b.onclick=()=>showPrompt(b.dataset.prompt));showPrompt('R00');if(stageAPI())setupStage();
  chapterWorkbench=await initChapter({catalog,switchView,toast,download});
  }catch(e){$('#saveState').textContent='读取失败';toast(e.message);}
}
init();
