/* Server persistence is acknowledged only after an atomic file save. */
const REVIEWED_KEY='ch2-film-reviewed-versions-20261025';
const reviewed=load(REVIEWED_KEY),revisions={},pending=new Set();
let saveChain=Promise.resolve(),hydrated=false;
const saveQueue=new Map();let draining=false;
function persistBrowser(){save();localStorage.setItem(REVIEWED_KEY,JSON.stringify(reviewed));}
function recordReview(c){reviewed[c.id]||={};reviewed[c.id][c.file]={editedAt:new Date().toISOString()};}
function diskSave(c,label){
 persistBrowser();pending.add(c.id);label.textContent='正在保存到本机文件…';
 const payload=JSON.parse(JSON.stringify({id:c.id,note:notes[c.id]||'',approvals:approvals[c.id]||{},reviewedVersions:reviewed[c.id]||{}}));
 saveQueue.set(c.id,{payload,label});
 if(draining)return saveChain;
 draining=true;
 saveChain=(async()=>{while(saveQueue.size){
  const [id,item]=saveQueue.entries().next().value;saveQueue.delete(id);
  const {payload,label}=item;
  try{
   const response=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,baseRevision:revisions[id]||0})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'写入失败');
   revisions[id]=result.record.revision;if(!saveQueue.has(id)){pending.delete(id);label.textContent='已保存到本机文件';}
  }catch(e){label.textContent='未同步成功：'+e.message;$('storage-warning').textContent='当前输入仍保留在浏览器；请导出意见备份。'+e.message;}
 }draining=false;})();return saveChain;
}
async function hydrateReviews(){
 const response=await fetch('/api/reviews',{cache:'no-store'});if(!response.ok)throw Error('无法读取已保存意见');
 const stored=await response.json();
 for(const [id,r] of Object.entries(stored.records)){
  revisions[id]=r.revision;
  // Preserve both histories. Never assign a prior review to a new video version.
  reviewed[id]={...(reviewed[id]||{}),...r.reviewedVersions};
  approvals[id]={...r.approvals,...(approvals[id]||{})};
  if(r.revision>0){
   if(notes[id]!==undefined&&notes[id]!==r.note){
    localStorage.setItem('ch2-review-conflict-'+id+'-'+Date.now(),notes[id]);
    $('storage-warning').textContent='发现另一页面的不同意见，已保留浏览器备份；页面显示最后保存到文件的版本。';
   }
   notes[id]=r.note;approvals[id]={...(approvals[id]||{}),...r.approvals};
  }else if(notes[id]===undefined)notes[id]=r.note;
 }
 persistBrowser();hydrated=true;
}
function applyFilter(){
 const mode=$('review-filter').value,counts={unseen:0,reviewed:0,recheck:0};let shown=0;
 for(const g of state.groups){let visible=0;for(const c of g.clips){
  const kind=R.reviewClass(c,notes,approvals,reviewed);counts[kind]++;
  const show=mode==='all'||mode===kind||(mode==='reviewed'&&kind==='recheck');
  const card=$('clip-'+c.id);card.hidden=!show;if(show){visible++;shown++;}else card.querySelector('video')?.pause();
 }$('scene-'+g.group).hidden=visible===0;const opt=Array.from($('scene-nav').options).find(o=>o.value===g.group);if(opt)opt.disabled=visible===0;}
 $('review-counts').textContent=`尚未审过 ${counts.unseen} · 已审过 ${counts.reviewed+counts.recheck}（其中新版待复审 ${counts.recheck}）· 当前显示 ${shown}`;
 $('empty-filter').hidden=shown!==0;
}
window.addEventListener('beforeunload',e=>{if(pending.size){e.preventDefault();e.returnValue='';}});
