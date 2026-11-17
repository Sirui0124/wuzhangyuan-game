from pathlib import Path
import json
O=Path(__file__).resolve().parent;R=O/'user-review-20261025';read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
D=read(O/'delivery.json');Q=read(O/'review/picture-usability.json');U=read(O/'user-review-repair.json');q={x['id']:x for x in Q['clips']}
def link(label,p):return f'[{label}](<{Path(p).resolve().as_posix()}>)'
target=O/'本组交付.md';prior=R/'本组交付-返修前.md'
if target.exists() and not prior.exists():prior.write_bytes(target.read_bytes())
lines=['# G3｜用户实审后画面返修交付','',
'本轮依据2026-10-25用户实审的全片纠正执行，优先于此前制作可用结论。V21已切换到独立“无字卡返修V1”；其余四条经本轮完整静音播放及全范围画面扫查后保留原SHA，不重导。五条均记录reviewPolicy=20261025-no-meta-no-cards-no-boxes，仍为制作候选，userApproved=false，待用户审核。','',
'当前声音未获通过：本组没有点名声音替换意见，也没有新增TTS授权；本轮零新增TTS，V21完整既有音频PCM逐样本保留。旧NPC临时原声、元说明误读/BGM风险、音色、混音和精确声口仍单独登记，未完成逐字听审。画面政策标记不代表音频通过。','',
'| 当前逻辑段 | 成片 | 时长 | 本轮处理 |','|---|---|---:|---|']
for v in D['logicalClips']:
 action='撤摘要卡/纸面失焦，折信真实交接及干净原片近景' if v['id']=='V21' else '新标准扫查后保留当前文件'
 lines.append(f"| {v['id']} {v['name']} | {link('播放MP4',v['path'])} | {v['duration']:.3f}秒 | {action} |")
lines+=['','V21新版独立视频轨解码为2061帧、CFR24、85.875秒，逐帧PTS步长一致，无检出的完整黑场；已完成0至终点静音播放及关键动作、切点和时间序列检查。原片、旧摘要卡版、模糊层版和用户评论均保留为历史，不再作为当前修复依据。','',
link('逐条旧SHA/区间到修复、新SHA及证据',O/'user-review-repair.json')+' · '+link('五条画面可用性与本轮政策证据',O/'review/picture-usability.json')+' · '+link('V21视频轨与音频样本保留检查',R/'V21-track-coverage.json')+' · '+link('当前机器交付索引',O/'delivery.json'),'','## 保留的剧情与接入条件','']
for v in D['logicalClips']:
 for c in v.get('integrationConditions',[]):lines.append(f"- {v['id']}：{c}")
lines+=['',link('第二封信准确事实及既有信息层来源映射',R/'second-letter-information-mapping.json'),'','## 本轮唯一新生成请求','',
'V21-03-UR1：8秒，一次补拍完成。实际API只提交镜头指令和空发声白名单；闭合折信素白外背朝镜头，保留接住、松手、收近，不展开、不新增对白或朗读，不生成BGM。原声未用于替换本轮保留的完整既有音轨。','',
link('独立生成审核正文',O/'prompts/V21-03-UR1.md')+' · '+link('实际模型指令',O/'prompts/V21-03-UR1.api.txt')+' · '+link('独立发声白名单',R/'V21-03-UR1-dialogue-whitelist.json'),'','## 版本与验证边界','',
'本轮不修改游戏、线上剧本、用户原评论或浏览器通过标记。第二封信事实留原稳定编号及已设计信息层映射，不能因删除烧入影片的摘要卡而删去事实，也不能将接信动画播完直接视为已读全文。V24仍为苟安口述回忆；V25仍为尚未实施的计划。','',
'原34条子片及历史修订继续保存在逐句计划和任务记录中，历史全文Prompt不作为本轮新请求模板。'+link('逐句与请求计划',O/'plan.json')+' · '+link('返修前交付文档',prior),'']
target.write_text('\n'.join(lines),encoding='utf-8');print('Current user-review delivery document written.')
