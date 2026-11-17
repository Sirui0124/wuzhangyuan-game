from pathlib import Path
import json
O=Path(__file__).resolve().parent;R=O/'user-review-batch2';U=json.loads((O/'user-review-batch2.json').read_text(encoding='utf-8-sig'));D=json.loads((O/'delivery.json').read_text(encoding='utf-8-sig'))
def link(name,p):return f'[{name}](<{Path(p).resolve().as_posix()}>)'
doc=O/'本组交付.md';backup=R/'本组交付-before-batch2.md'
if doc.exists() and not backup.exists():backup.write_bytes(doc.read_bytes())
lines=['# G3 第二批实审返修｜V21–V25','','当前更新四条候选，V25因缺失计划句的合成请求结果未知，保留原片。新片未继承旧版用户通过记录。音色、杂音、BGM和精确声口尚未实际听审；ASR只辅助定位。','','| 影片 | 旧时长 → 当前时长 | 本轮实际变化 | 当前文件 |','|---|---:|---|---|']
for c in U['clips']:
 if c['newFile']:lines.append(f"| {c['id']} | {c['oldDuration']:.3f} → {c['newDuration']:.3f}秒 | {c['change']} | {link('新版候选',c['newFile'])} |")
 else:lines.append(f"| {c['id']} | {c['oldDuration']:.3f}秒，未替换 | P02完整原句缺失；七段部件已备，未拼成缺句新版 | {link('仍为旧片',c['oldFile'])} |")
lines+=['','四条新版均已完成浏览器0至终点静音播放、完整解码与视频帧/PTS核验，未检测到整幅黑场；ASR未再命中已定位的制作指令。V23原样复制画面流，其原始首帧时间约0.041秒，417帧至约17.416秒，未新增冻结填时。上述检查不代替听审和用户审核。','','## 未解决项','','- V25的CH2-LY09-P02：“我去魏国，求他们放我回来，散布丞相要篡位的谣言，逼朝廷召军。”Seed-Audio1.0请求网络异常，未收到HTTP响应或任务编号。客户端requestId：`a31dbf42-96db-420d-a263-a7aaa00bdacd`。状态保持unknown-no-repost，未重投。','- 已检查原片混合声和左右声道、冻结白名单及现有合成登记，未找到可验证的同角色完整同句；不拼接别句改变语义。','- V25 P04的提供方字幕与白名单一致，独立ASR疑似多出“我”字，实际听审待确认。','- 本轮新合成仅Seed-Audio1.0，共5请求：4成功、1结果未知；实际上传苟安同角色参考WAV，未使用隔离的错误预置样本。只有V22的准确禀报承诺已进入四条新版。','','## 保留的接入条件','']
for v in D['logicalClips']:
 lines.append(f"- {v['id']}："+'；'.join(v.get('integrationConditions',[])))
lines+=['','## 文件与证据','',link('逐条白名单、角色、旧新SHA、时长、切点与审核记录',O/'user-review-batch2.json')+' · '+link('当前交付索引',O/'delivery.json')+' · '+link('P02未知请求与恢复记录',R/'P02-unknown-recovery.json')+' · '+link('V25未采用部件',R/'V25-available-components.json'),'']
for c in U['clips']:
 if c['newFile']:lines.append(f"- {c['id']} SHA256：`{c['newSha256']}`；"+link('播放/画面证据',c['finalReview'])+'；'+link('帧和音轨核验',c['technicalCoverage']))
doc.write_text('\n'.join(lines)+'\n',encoding='utf-8');print(str(doc))
