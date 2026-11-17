from pathlib import Path
import json
OUT=Path(__file__).resolve().parent
d=json.loads((OUT/'delivery.json').read_text(encoding='utf-8'))
lines=['# G4｜军情与第二次交谈｜增量交付索引','本索引只列已拼接的可播放制作候选，不代表用户审核通过。画面与音频分开记录；未听审，不声称逐字声音、音色或无BGM已通过。','已受理34条任务，33条成功下载，L02原任务因参考图下载失败；3条原计划回应未提交，统一暂停期间无新增POST。未将失败原任务冒称生成成功。','## 当前可播放段','| 槽位 | 名称 | 实际时长 | 播放文件 |','|---|---|---:|---|']
for c in d['clips']:lines.append(f"| {c['id']} | {c['name']} | {c['technical']['duration']:.2f}秒 | [{c['id']} MP4](<{c['file']}>) |")
lines+=['','## 未完成部分','- V26：交差核收、无字简报与两段军吏长句原片存在乱码/串镜，4个子片暂不入可用成片；待统一恢复后的最简试片与必要修复。','- V31A、V31N、V32R：提交门槛关闭前尚未生成，不用其他回应伪装成指定原句。','','## 已做的修复与复用','- V27入口仅留1.32秒，不保留原片无来源的起身搬被动作。V27第三句保留3.3–6.58秒完整原句。','- V26-03/06/07已裁出完整原句并去多余插镜/烧录字幕，待整段补齐后才列V26成片。','- V27中原越肩递乱码纸与新增血伤画面，用本组同日间、同脸、同伤帐的V28A-01安静听者段替换；具体裁剪、变速与来源见delivery.json。未循环一秒口型。','- L02是同场日间闭口听者复用候选，不是夜间坐案，也未预录自由输入。原失败任务ID仍在tasks保存。','- V29末尾心声使用同场无字案头，移除原片纸面乱写；V29-06裁掉烧录字幕，追责与不可撤回原句完整保留。','','## 验证范围','原片与成片均做解码检查；成片统一1280×720、16:9、24fps、48kHz音频。解码后精确trim/atrim并重置时基，实际首帧用不带seek和fps过滤的直接首解码帧另检。','原片0.5秒连续时序图配合浏览器逐条动态播放检查；已拼接文件正在逐段复核。ASR仅辅助定位，不冒充听审。部分玩家画面仍有口部活动，后续需结合最终音轨核对，已在audioIssues/visualReview保留限制。','','## 追溯入口',f'- [分镜脚本](<{OUT/"分镜脚本.md"}>)',f'- [计划与逻辑边界](<{OUT/"plan.json"}>)',f'- [交付机器索引](<{OUT/"delivery.json"}>)',f'- [逐条画面与音频问题](<{OUT/"review/visual-audio-review.json"}>)',f'- [真正首解码帧核验](<{OUT/"review/first-decoded-frames/verification.json"}>)','','## 独立请求稿']
for c in json.loads((OUT/'plan.json').read_text(encoding='utf-8'))['clips']:lines.append(f'- [{c["id"]}](<{OUT/"prompts"/(c["id"]+".md")}>)｜{c["duration"]}秒')
tasks=d.get('tasks',[])
lines[0]='# G4｜军情与第二次交谈｜交付索引'
lines[2]=f"实际受理{len(tasks)}条任务，{sum(t['status']=='succeeded' for t in tasks)}条成功、{sum(t['status']=='failed' for t in tasks)}条失败。L02原任务因参考图下载失败，采用已注明来源的闭口画面；未将失败原任务冒称生成成功。恢复后新图走同字节校验res-1，原任务ID保留，无新增TTS。"
at=lines.index('## 未完成部分')
lines[at:at+3]=['## 当前完整性','全部14个逻辑槽位已有独立候选，未跨选项、UI或确认边界拼接。' if not d.get('missingSlots') else '尚缺整段：'+'、'.join(d['missingSlots'])+'。源节点及实际任务状态见delivery.json。']
(OUT/'交付索引.md').write_text('\n'.join(lines),encoding='utf-8')
print('delivery index written')
