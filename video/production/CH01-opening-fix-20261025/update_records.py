from pathlib import Path
import json,shutil
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def link(p,label):return f'[{label}](<{Path(p).resolve().as_posix()}>)'
integ=read(OUT/'integration.json');clip=integ['opening'];report=OUT/'开场修订说明.md'
for rel in ['docs/video/ASSET-INDEX.md','docs/video/ASSET-INDEX.json','docs/video/VIDEO-SELECTION-MANIFEST.json','video/README.md']:
 p=ROOT/rel;backup=OUT/'audit'/(p.name+'-before')
 if not backup.exists():shutil.copy2(p,backup)
index=read(ROOT/'docs/video/ASSET-INDEX.json')
for c in index['records']:
 if c['group']=='opening' and c['id']==integ['previous']['id']:
  c.update(**clip,absolutePath=integ['openingFile'],sha256=integ['sha256'],duration=integ['duration'])
assert index['records'][0]['id']==clip['id']
save(ROOT/'docs/video/ASSET-INDEX.json',index)
md='# 当前视频资产索引｜2026-10-25\n\n'+link(report,'开场最新修订')+' · '+link(ROOT/'video/production/CH01-cinematic-20261025/第一关视频审阅与交付.md','第一关对白与资产记录')+' · '+link(ROOT/'source-art/core/README.md','核心资产')+' · [游戏试玩](http://127.0.0.1:8812/)\n\n以游戏cinematics.json和public/video/media-manifest.json为准。现有39个唯一播放文件，第一关对白／行动29组、固定节点81个。当前开场44.42秒：已燃烛光起始、重拍面部反应、恢复旧版30秒回忆与穿越，后接SC03。成片待review。\n\n| 分组 | ID | 内容 | 时长 | 当前文件 |\n| --- | --- | --- | ---: | --- |\n'
for c in index['records']:md+=f'| {c["group"]} | {c["id"]} | {c["title"]} | {c["duration"]:.2f}秒 | '+link(c['absolutePath'],Path(c['absolutePath']).name)+' |\n'
md+='\n两处动态AI答应句、玩家输入和结算界面文字保留原呈现。对白的人物、语音与用词仍待用户review。旧36.93秒开场为历史，已退出游戏播放配置。\n'
(ROOT/'docs/video/ASSET-INDEX.md').write_text(md,encoding='utf-8')
selection=read(ROOT/'docs/video/VIDEO-SELECTION-MANIFEST.json')
for c in selection['selections']:
 if not c.get('scene','').startswith('PR01-'):continue
 c.update(selectedFile=integ['openingFile'],selectedSha256=integ['sha256'],gameClipId=clip['id'],gameUrl=clip['src'],humanState='待review',integratedFile=integ['openingFile'],integratedSha256=integ['sha256'],selectionReason='用户纠正：截掉点灯，直接已燃烛光开始；替换异形兵器面部反应；完整恢复旧版30秒回忆与穿越。44.42秒完整开场。',integrationNote='详见CH01-opening-fix-20261025/开场修订说明.md；未标用户通过')
save(ROOT/'docs/video/VIDEO-SELECTION-MANIFEST.json',selection)
(ROOT/'video/README.md').write_text('# 视频素材\n\n'+link(report,'当前开场交付')+' · '+link(ROOT/'docs/video/ASSET-INDEX.md','当前播放索引')+' · '+link(ROOT/'source-art/core/README.md','18项核心资产')+'\n\n- current：发布影片及有追溯需要的源版本，是否采用以游戏白名单为准。\n- raw：用户提供的原始素材。\n- production/CH01-opening-fix-20261025：当前44.42秒开场，直接已燃烛光开始、面部反应重拍、旧版30秒回忆与穿越。\n- production/CH01-cinematic-20261025：第一关对白补片、资产整理与开场历史记录；其中36.93秒开场已被替换。\n- review：技术核验，历史记录不代表当前采用。\n\n实际播放以GameStarter/web-demo/public/cinematics.json和public/video/media-manifest.json为准。成片待review；核心人物与场景从source-art/core选择。\n',encoding='utf-8')
old=ROOT/'video/production/CH01-cinematic-20261025'
banner='> 开场采用已更新：'+link(report,'烛光起始／重拍反应／原版穿越，44.42秒')+'。本页36.93秒开场为历史版，停止采用；第一关对白与资产整理记录仍可查阅。\n\n'
for name in ['README.md','第一关视频审阅与交付.md']:
 p=old/name;text=p.read_text(encoding='utf-8')
 if not text.startswith('> 开场采用已更新：'):p.write_text(banner+text,encoding='utf-8')
status=read(old/'delivery-status.json');status['openingSupersededBy']=str(report.resolve());status['openingHistorical']=True
save(old/'delivery-status.json',status)
verified=read(OUT/'audit/restored-modern-verification.json')
report.write_text('# 开场修订｜2026-10-25\n\n'+link(Path(integ['openingFile']),'观看当前完整开场')+' · [进入游戏](http://127.0.0.1:8812/) · '+link(OUT/'诸葛亮反应镜头-重拍Prompt.md','重拍Prompt')+'\n\n当前完整开场44.42秒、1344×756、24fps、16:9，已替换游戏开场第一条，接原SC03醒来段。成片状态为待review。\n\n本次按用户三项纠正处理：\n\n1. 开篇从已燃烛光特写直接开始，删除点灯、引火和持火棒过程。烛光→奔马→急报→掀帘灭灯，动作按原速剪接。\n2. 异形兵器近景停止采用。新生成4秒纯面部反应，采用0.5—1.9秒；参考图只绑定诸葛亮身份，构图不包含手或道具。已查看全部96帧图格及相邻全景，反应镜头无兵器入镜。\n3. 时光倒流／现代回忆／许愿恢复旧版PR01-DEF-20261024-77fc2fdd.mp4完整30秒，原画面、原声、原速，仅统一发布画幅和编码。前一版新做的现代画面与重配音不再采用。\n\n| 成片范围 | 内容 |\n| --- | --- |\n| 0—9.417秒 | 已燃烛光、骑兵、急报、赴帐 |\n| 9.417—14.417秒 | 掀帘、灭灯、重拍面部反应、烟气 |\n| 14.417—44.417秒 | 原版完整30秒手机、回忆与穿越 |\n\n原版恢复验证对照末720帧，缩略像素平均误差'+str(round(verified['meanPixelError64x36'],3))+'／255，音频波形相关度'+str(round(verified['audioCorrelation'],6))+'。全片解码、构建和473项资源检查已通过。浏览器播放与SC03衔接证据见audit/browser-verification.json；这些检查不代表用户主观审核通过。\n\n实际来源区间见edit-record.json，任务请求和原片见tasks、requests、generated；当前采用以integration.json及游戏白名单为准。旧36.93秒开场只保留历史追溯，不再播放。旧在线Prompt状态保持待更新，未冒充已同步的新稿。视频台账已按实时表头定点更新，并回读核验。\n',encoding='utf-8')
print('Current indexes updated; previous opening marked historical.')
