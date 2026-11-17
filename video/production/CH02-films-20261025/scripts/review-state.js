(function(root){
 'use strict';
 const current=(clip,approvals)=>approvals[clip.id]?.[clip.file]||null;
 const approved=(clip,approvals)=>Boolean(clip.file&&current(clip,approvals)?.approved);
 function reviewClass(clip,notes,approvals,reviewed={}){
  const versions=reviewed[clip.id]||{},history=approvals[clip.id]||{};
  if(versions[clip.file]||current(clip,approvals))return 'reviewed';
  if(Object.keys(versions).length||Object.keys(history).length)return 'recheck';
  return (notes[clip.id]||'').trim()?'reviewed':'unseen';
 }
 function status(clip,notes,approvals){
  if(approved(clip,approvals))return '已通过';
  if(Object.entries(approvals[clip.id]||{}).some(([version,value])=>version!==clip.file&&value.approved))return '新版待审核';
  return (notes[clip.id]||'').trim()?'有修改意见':'待审核';
 }
 function setApproval(clip,approvals,value,now=new Date().toISOString()){
  if(!clip.file)return false;
  approvals[clip.id]||={};approvals[clip.id][clip.file]={approved:value,updatedAt:now,approvedAt:value?now:null};return true;
 }
 function editNote(clip,notes,approvals,text){const changed=notes[clip.id]!==text;notes[clip.id]=text;if(changed&&approved(clip,approvals))setApproval(clip,approvals,false);}
 function exportScene(group,notes,approvals,now=new Date().toISOString(),reviewed={}){
  const rows=['# 第二章视频审核 · '+group.title,'','导出时间：'+now,'审核范围：本场景全部 '+group.clips.length+' 条视频；通过记录仅指对应版本画面，声音意见与修复单独保留。',''];
  group.clips.forEach((clip,index)=>{const record=current(clip,approvals);rows.push('## '+(index+1)+'. '+clip.name+'（'+clip.id+'）','','审核状态：'+(reviewClass(clip,notes,approvals,reviewed)==='recheck'?'新版待复审':status(clip,notes,approvals)),'视频版本：'+(clip.file?decodeURI(clip.file):'暂无可播放文件'));if(approved(clip,approvals))rows.push('通过时间：'+record.approvedAt);rows.push('','修改意见：','',(notes[clip.id]||'').trim()||'未填写','');});return rows.join('\n');
 }
 root.ChapterReview={current,approved,status,setApproval,editNote,exportScene,reviewClass};
})(typeof globalThis!=='undefined'?globalThis:this);
