from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'scripts/scene-review.html';s=p.read_text(encoding='utf-8')
s=s.replace('*{box-sizing:border-box}','[hidden]{display:none!important}*{box-sizing:border-box}')
s=s.replace('<button id="refresh">','<select id="review-filter" aria-label="审核筛选"><option value="unseen">尚未审过（隐藏已审）</option><option value="recheck">新版待复审</option><option value="reviewed">已审过（含新版）</option><option value="all">全部</option></select><button id="refresh">')
s=s.replace('<div id="scenes"></div>','<p id="review-counts" class="muted"></p><p id="disk-status" class="muted" role="status"></p><p id="empty-filter" hidden>此筛选下没有视频。</p><div id="scenes"></div>')
s=s.replace('review-state.js?v=scene-review-1','review-state.js?v=scene-review-2')
s=s.replace("badge.textContent=R.status(c,notes,approvals);","badge.textContent=R.reviewClass(c,notes,approvals,reviewed)==='recheck'?'新版待复审':R.status(c,notes,approvals);")
s=s.replace("'意见与通过状态保存在本机浏览器。'","'意见与通过状态自动保存到本机文件。'")
s=s.replace("const stored=save();saved.textContent=stored?(had?'意见已保存；修改后请重新确认通过。':'修改意见已保存。'):'保存失败，请导出本场景意见。';update();","recordReview(c);diskSave(c,saved);update();")
s=s.replace("const stored=save();saved.textContent=stored?(next?'当前视频版本已标记为画面通过。':'已撤销通过，修改意见保留。'):'保存失败，请导出本场景意见。';update();","recordReview(c);diskSave(c,saved);update();")
s=s.replace("pass.addEventListener('click'","input.addEventListener('change',applyFilter);\n pass.addEventListener('click'")
s=s.replace("diskSave(c,saved);update();});actions", "diskSave(c,saved);update();applyFilter();});actions")
s=s.replace("+' 段可播放';","+' 段可播放';applyFilter();")
s=s.replace("$('refresh').onclick=refresh;refresh();","")
s=s.replace('</script></html>', '''</script>
<script src="/scripts/review-sync.js?v=2"></script>
<script>
$('review-filter').onchange=applyFilter;
$('refresh').onclick=async()=>{await saveChain;await refresh();};
(async()=>{try{await hydrateReviews();await refresh();
 for(const g of state.groups)for(const c of g.clips){if(notes[c.id]||Object.keys(approvals[c.id]||{}).length){await diskSave(c,$('disk-status'));}}
 $('disk-status').textContent='现有意见与通过记录已保存到本机文件；后续修改自动保存。';
}catch(e){$('storage-warning').textContent='文件同步失败：'+e.message;await refresh();}})();
</script></html>''')
p.write_text(s,encoding='utf-8');(root/'审片台.html').write_text(s,encoding='utf-8')
# Persist the user's correction separately from verbatim historical comments.
import json
comments=root/'reviews/user-20261025-1549/comments.json';d=json.loads(comments.read_text(encoding='utf-8-sig'))
d['audioModelCorrection']='用户明确指定豆包音频生成模型1.0（Seed-Audio1.0），上传参考音频生成；不使用Seed-TTS预置音色或新克隆替代。错误2.0生成隔离且未混入候选。'
comments.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
with (root/'reviews/user-20261025-1549/返修要求.md').open('a',encoding='utf-8') as f:f.write('\n## 用户模型更正（覆盖前述含糊的语音模型表述）\n\n指定豆包音频生成模型1.0 Seed-Audio1.0，以实际上传的参考音频生成。禁止用Seed-TTS预置speaker、新克隆或2.0替代；标准TTS权限错误不能视作Seed-Audio权限结果。此前7条错误预置TTS2.0已隔离，未采用。\n')
