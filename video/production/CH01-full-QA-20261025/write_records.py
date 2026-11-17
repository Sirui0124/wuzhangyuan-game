from pathlib import Path
import json,shutil
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def link(p,t):return f'[{t}](<{Path(p).resolve().as_posix()}>)'
integration=read(OUT/'integration.json');repairs={r['id']:r for r in integration['repairs']}
config=read(ROOT/'GameStarter/web-demo/public/cinematics.json');media=read(ROOT/'GameStarter/web-demo/public/video/media-manifest.json')
meta={m['url']:m for m in media['clips']};report=OUT/'第一关全视频检查与修复.md'
for rel in ['docs/video/ASSET-INDEX.json','docs/video/ASSET-INDEX.md','docs/video/VIDEO-SELECTION-MANIFEST.json','video/README.md']:
 p=ROOT/rel;backup=OUT/'audit'/(p.name+'-before-record-update')
 if not backup.exists():shutil.copy2(p,backup)
index=read(ROOT/'docs/video/ASSET-INDEX.json')
for c in index['records']:
 if c['id'] in repairs:
  r=repairs[c['id']];c.update(src=r['src'],absolutePath=r['publishedFile'],sha256=r['sha256'],duration=r['duration'])
index['reviewReport']=str(report.resolve());save(ROOT/'docs/video/ASSET-INDEX.json',index)
md='# 当前视频资产索引｜2026-10-25\n\n'+link(report,'第一关34条全视频检查与修复')+' · '+link(ROOT/'source-art/core/README.md','核心资产')+' · [游戏试玩](http://127.0.0.1:8812/)\n\n以游戏cinematics.json及public/video/media-manifest.json为准。第一关34条影片已覆盖全时段检查，其中8条修复；全部39项当前播放文件列于下表。当前开场42.50秒，保留烛光起始及旧版完整时光倒流，后接SC03。修复成片待用户review。\n\n| 分组 | ID | 内容 | 时长 | 当前文件 |\n| --- | --- | --- | ---: | --- |\n'
for c in index['records']:md+=f'| {c["group"]} | {c["id"]} | {c["title"]} | {c["duration"]:.2f}秒 | '+link(c['absolutePath'],Path(c['absolutePath']).name)+' |\n'
(ROOT/'docs/video/ASSET-INDEX.md').write_text(md,encoding='utf-8')
selection=read(ROOT/'docs/video/VIDEO-SELECTION-MANIFEST.json')
for c in selection['selections']:
 r=next((x for x in repairs.values() if x['index']==1),None) if c.get('scene','').startswith('PR01-') else repairs.get(c.get('gameClipId'))
 if not r:continue
 c.update(selectedFile=r['publishedFile'],selectedSha256=r['sha256'],gameUrl=r['src'],gameClipId=r['id'],integratedFile=r['publishedFile'],integratedSha256=r['sha256'],humanState='待review',selectionReason=r['reason'],integrationNote='第一关全视频检查与修复，见CH01-full-QA-20261025；保留原对白和分支。')
for c in selection.get('dialogueSelections',[]):
 if c['id'] in repairs:
  r=repairs[c['id']];c.update(file=r['publishedFile'],sha256=r['sha256'],reviewState='待review',repairReason=r['reason'])
save(ROOT/'docs/video/VIDEO-SELECTION-MANIFEST.json',selection)
(ROOT/'video/README.md').write_text('# 视频素材\n\n'+link(report,'当前第一关审片与修复')+' · '+link(ROOT/'docs/video/ASSET-INDEX.md','当前播放索引')+' · '+link(ROOT/'source-art/core/README.md','核心人物与场景')+'\n\n- current：游戏白名单采用的影片及有追溯必要的旧源片，实际采用见索引。\n- production/CH01-full-QA-20261025：34条第一关影片的检查、8条修复、独立生成请求和复查记录。\n- production/CH01-opening-fix-20261025：44.42秒开场历史记录；当前42.50秒版继续保留烛光起始和原版时光倒流，删去重复停留。\n- production/CH01-cinematic-20261025：先前对白补片及资产整理记录；36.93秒开场为停用历史。\n- raw：用户原始素材；review：技术核验，不代表用户认可。\n\n实际播放以GameStarter/web-demo/public/cinematics.json和public/video/media-manifest.json为准。修复成片待用户review，人物和场景参考从source-art/core选择。\n',encoding='utf-8')
banner='> 当前采用已更新：'+link(report,'第一关全视频检查与修复')+'。本页开场是历史版本，当前开场42.50秒；烛光起始和完整原版时光倒流继续保留。\n\n'
for p in [ROOT/'video/production/CH01-opening-fix-20261025/开场修订说明.md',ROOT/'video/production/CH01-cinematic-20261025/第一关视频审阅与交付.md',ROOT/'video/production/CH01-cinematic-20261025/README.md']:
 t=p.read_text(encoding='utf-8')
 if not t.startswith('> 当前采用已更新：'):p.write_text(banner+t,encoding='utf-8')
inventory=read(OUT/'inventory.json');obs={x['index']:x for x in read(OUT/'observations.json')['observations']}
browser=read(OUT/'audit/browser-verification.json');assert browser['passed'] and len(browser['clips'])==34
lines=['# 第一关全视频检查与修复｜2026-10-25','',
 '已按第一关实际播放白名单检查34条影片，覆盖开场、29组固定对白／行动和3条结局影片。发现并修复8条，已经替换到游戏；其余26条本轮未发现同类明显视觉问题。修复成片待用户review。','',
 '[进入游戏](http://127.0.0.1:8812/) · '+link(Path(next(x for x in repairs.values() if x['index']==1)['publishedFile']),'观看当前开场'),'',
 '## 已修复','',
 '| 片段 | 问题及处理 | 修复后时长 | 当前成片 |','| --- | --- | ---: | --- |']
for r in sorted(repairs.values(),key=lambda r:r['index']):
 item=inventory[r['index']-1]
 lines.append(f'| {item["title"]} | {r["reason"]} | {r["duration"]:.2f}秒 | '+link(Path(r['publishedFile']),r['id'])+' |')
lines+=['','开场继续从燃着的烛光开始；完整旧版30秒手机、现代回忆和时光倒流保留原画原声，不变速、不重配音。本轮只收紧古代赴帐中重复伸手停留的镜头。','',
 '## 检查范围与验证','',
 '对每条影片完整时间范围建立0.5秒连续时间码图格，逐段核对身份、服装、手与兵器、背景空间、说话人及动作衔接；疑点和新生成动作加密检查。以原剧情行核对谁在画内开口、谁从画外发声。ASR仅辅助定位，未当作逐字听审。','',
 '34条影片均完成全量解码与浏览器1倍速自然播完检查，未发现媒体错误或缺失文件。8条替换文件已逐一核对本地服务实际返回哈希；开场自然播完后接SC03，转呈的已问／未问营门两分支都播放各自正确版本，没有新增线索。构建、473项资源路径与39个视频哈希校验、4项既有剧情视频映射测试通过。','',
 '修复镜头保留原对白音轨及分支含义。新生成源片带有错误人影、字幕、口型或入帐动作的部分全部停用；不合格整条与采用区间分开记录。当前成片均为16:9；768P生成源片中心微裁为1344×756。','',
 '## 34条逐片记录','','| # | 片段 | 本轮判断 | 检查记录 |','| ---: | --- | --- | --- |']
for item in inventory:
 o=obs[item['index']];lines.append(f'| {item["index"]} | {item["id"]} · {item["title"]} | '+('已修复，待review' if o['result']=='repair' else '保留')+f' | {o["note"]} |')
lines+=['','## 独立重拍Prompt与任务','','参考图路径、实际顺序与用途均写在对应正文中；请求JSON与任务状态独立保存。以下均为源素材请求，采用区间以剪辑记录为准。','']
for id in ['QA-GUARD-LISTEN-R3','QA-WEI-LISTEN-R2','QA-WEI-EXIT-R2','QA-HAND-RELAX-R2']:
 state=read(OUT/'tasks'/(id+'.json'));lines.append('- '+link(OUT/'prompts'/(id+'.md'),id)+'；任务 '+state['task_id']+'。')
lines+=['','实际采用：甲只采用R3前2.25秒闭口表演，收紧构图剔除右缘肩影，随后切回现有真实闭帘画面承载我的报告；R3后续擅自讲话和字幕全部弃用；魏延倾听只用闭口的前3.5秒，接0.625秒闭帘；魏延离开只用0.75—3.75秒营道步行，其后靠近帐篷的部分弃用；手部放松采用4秒。甲R2因新增前景、字幕与开口动作整条弃用。首轮4个任务为明确的素材下载失败，改用同一Cloudinary已核验字节一致的交付别名后另立任务重试，未对未知结果盲目重提。','',
 '检查证据：inventory.json、observations.json、audit/图格及browser-verification.json。来源区间与合成方法见edit_repairs.py；当前路径和哈希见integration.json。旧版仅保留追溯，不再进入游戏播放配置。']
report.write_text('\n'.join(lines)+'\n',encoding='utf-8')
save(OUT/'delivery-status.json',dict(status='repaired-integrated-awaiting-user-review',reviewedClips=34,repairedClips=8,unchangedClips=26,browserPassed=True,subjectiveFullListening=False,report=str(report.resolve()),openingSeconds=42.5))
print('Updated primary indexes and complete 34-clip report.')
