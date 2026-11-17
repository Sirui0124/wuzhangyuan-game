from pathlib import Path
import json,shutil
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def link(p,label):return f'[{label}](<{Path(p).resolve().as_posix()}>)'
integ=read(OUT/'integration.json');movies=read(ROOT/'GameStarter/web-demo/public/cinematics.json')
media=read(ROOT/'GameStarter/web-demo/public/video/media-manifest.json');meta={x['url']:x for x in media['clips']}
coverage=read(OUT/'audit/coverage.json');prod=read(OUT/'production.json')
oldclean=read(OUT/'audit/cleanup-receipt.json');newclean=read(OUT/'audit/generated-cleanup-receipt.json')
cleaned=len(oldclean['files'])+len(newclean['files']);size=(oldclean['bytes']+newclean['bytes'])/1048576
opening=Path(integ['openingFile']);opmeta=meta[integ['opening']['src']]
tasks=[read(p) for p in (OUT/'tasks').glob('*.json') if '.request.' not in p.name and '.latest.' not in p.name]
assert len(tasks)==22 and all(t['status']=='succeeded' for t in tasks)
report='''# 第一关视频审阅与交付｜2026-10-25

已接入可试玩的审阅版。新开场为一条36.93秒完整影片，接原有SC03醒来守营；第一关现有29组对白／行动影片、81个固定剧情节点已覆盖。结算界面文字、玩家实际输入及两处动态AI答应句保留各自呈现。全部新增／修复成片待review，技术通过不代表你已认可画面和声音。

'''
report+=link(opening,'观看完整开场')+' · [游戏试玩](http://127.0.0.1:8812/) · '+link(ROOT/'source-art/core/资产面板.html','18项核心资产')+'\n\n'
report+='''## 开场重构

原开场前四段共50.21秒。主要问题是点灯、接报、赴帐的等待动作散掉了张力，重复赴帐及文件边界削弱连续性。现在用近处灯芯、远处骑兵、帐内诸葛亮和魏延的行动交叉推进，掀帘后灭灯，节奏骤收，再揭示手机中的历史影像。现代回忆用代码、同学演示、犹豫未点下的手和抱箱离开组织“错过”，许愿后接穿越。

新片缩短约13.28秒、约26%。没有统一加速整条影片；现代画外对白使用游戏已选的“我”的音色，最后三句为1.08倍。多余念白、一次主灯复燃和重复赴帐从采用区间移除。手机揭示保留既有修补正确的3.5秒桥接，不冒充本轮新生成。

| 最终片内范围 | 内容 | 来源／处理 |
| --- | --- | --- |
| 0—10.25秒 | 点灯、奔马、接报、一次赴帐 | OP01新生成15秒源片重剪；军情句重新对齐传令镜头 |
| 10.25—15.125秒 | 掀帘、灭灯和反应 | OP02新片删复燃，沿用原C的“丞相”与现场音 |
| 15.125—26.542秒 | 手机、代码与同学AI演示 | 正确旧手机桥接＋OP03新片；统一“我”的心声 |
| 26.542—36.917秒 | 机会回忆、离开与许愿 | OP04新片剪至屏幕亮起，接SC03 |

画面885帧、24fps，36.9167秒；AAC尾延迟后容器36.928秒，显示36.93秒。时间轴覆盖完整画面，接点受采样取整有不足一帧差异。

## 第一关补齐与保留

| 片段 | 最终处理 |
| --- | --- |
| 醒觉、告示、斥候及两种回答、第一次拦魏延 | 保留当前采用片；A-29既有配音和短暂倾听定格未冒充重拍 |
| D01—D06，向甲询问禁令与责任 | 新片清洁区间＋我的两句画外配音，约17.33秒；问句拍闭帘，答句由甲开口 |
| D07，开口问乙 | 新闭口倾听近景＋原定“我”的配音，4秒 |
| J03，请亲兵通传 | 将军帐外既有活动镜头＋原定“我”的配音，4秒；新候选被背影遮挡，未采用 |
| J04、J08—J08E，亲兵答复、同行与向姜维请求 | 保留10月24日可用片，补J03后连续接入，不恢复旧错误口型 |
| J09—J13，姜维答应、担责和亲兵同行 | 采用原30秒片；新姜维候选身份和视角不一致，淘汰。“报明／报告”一词疑点仍需结合原声听审，ASR不能证明演员读错 |
| 试探军情、见证、带魏延回帐、正式接报和回令 | 保留当前影片及实际事件边界 |
| B-03—B-04，天亮前收束 | 既有夜到昼镜头补齐两句旁白，12秒；咳声不代替旁白文字 |
| 首轮未询问营门的分支 | 单独12.36秒版本，不说“营门未破”；已询问版本保留 |
| 玩家实际输入、AI实际回应 | 保留实时语音。A-40B、W07会被本次回应替换，不预录例句 |

'''
for c in integ['dialogue']:report+='- '+link(ROOT/c['src'].lstrip('/'),c['title'])+f'（{meta[c["src"]]["duration"]:.2f}秒）\n'
report+='''\n## 生成和画幅

按所给指南使用MiniMax-H3和Cloudinary，保留任务编号、原请求、幂等Key、终态及结果链接。22个任务、219秒源片请求均返回成功；9条源片被局部采用，13条因念白、缺句、视角／口型或身份问题未采用并已清理。返回成功不等于画面合格。

768P源片实测1344×768，上下各裁6像素成为严格16:9的1344×756。问乙及部分答句另做近景构图并放大，不等于原生1344细节；旧1280×720复用片也统一了发布画幅。

以下为独立导演稿。实际提交以requests、tasks内不可变请求快照为准，不能把含编号和解释的整份人工稿直接送入模型。本轮发现模型会念出部分中文导演说明；这些已从采用区间去除。R2简化文本仍不能替代逐条审片。

'''
for c in prod['clips'][:13]:report+='- '+link(Path(c['document']),c['id']+'｜'+c['name']+'｜源片请求'+str(c['duration'])+'秒')+'\n'
report+='''\n四份旧在线开场Prompt已标明历史停用。在线台账保留11列及用户备注，追加本轮进展、成片路径和待review状态；写前比较、写后回读。Prompt状态待更新专指旧在线正文尚未重建，未谎称与新本地稿一致。

## 核心资产与清理

六个人物各一个身份入口：诸葛亮、魏延、姜维、甲、乙、斥候。魏延、姜维改用单人身份图，避免旁人的脸、肩背和站位混入身份。场景、灯具、衣袖和现代空间分别标用途，共18项。先前上传附件的实际字节、哈希与两张旧帧独立保留，不用现图冒充之前任务附件。

'''
report+=f'共清理{cleaned}个文件、约{size:.2f}MiB：31个旧过渡剪辑，61个本轮淘汰视频／可重建中间文件，均已从工作目录删除至回收站。原始用户素材、现用运行资源与.meta保留。清单记录原绝对路径和SHA256。\n\n'
report+='''## 验证与仍待review

- 类型检查、构建及34项相关机制／影片映射测试通过，固定剧情行覆盖检查通过。
- 473项资源路径、39个视频哈希检查通过；7个新发布文件完整音视频解码通过。
- Chrome新开场1倍完整播放并自然接SC03；六组补片验证画幅、尾帧和音轨，无脚本错误或404。
- 甲→乙、乙→甲两种完整流程跑通结局，含读档、授权、见证、接报和回令；此项AI使用测试回应，不代表真实语义服务验收。
- 首轮A/B实际进入各自影片，B分支不产生T02，也不说“营门未破”；8812服务新开场字节哈希一致。
- 图像自查覆盖现片抽帧及新剪辑重点时段，ASR仅辅助定位。没有完成全片逐字主观听审，也没有用户审核通过。尤其请听姜维授权用词和跨片音色，看人物脸、反应与新旧接片连续感。Cocos编辑器未验证。

'''
report+=link(OUT/'audit/browser-verification.json','浏览器播放与分支证据')+' · '+link(OUT/'audit/coverage.json','覆盖证据')+' · '+link(OUT/'audit/generated-cleanup-receipt.json','本轮清理清单')+' · '+link(OUT/'audit/cleanup-receipt.json','旧剪辑清理清单')+'\n'
(OUT/'第一关视频审阅与交付.md').write_text(report,encoding='utf-8')
(OUT/'README.md').write_text('# 当前制作入口｜2026-10-25\n\n'+link(OUT/'第一关视频审阅与交付.md','审阅与交付正文')+' · '+link(opening,'完整开场')+'\n\ngenerated仅保留采用源片，edited仅保留7个发布剪辑。实际采用以游戏白名单为准，核心参考以source-art/core/assets.json为准。全部成片待review。\n\nbuild_production.py为初始编排记录，不应覆盖已完成目录重跑。复刻实际生成使用tasks请求快照及references哈希记录；已有任务只恢复查询，不重提付费任务。\n',encoding='utf-8')
save(OUT/'delivery-status.json',dict(status='generated-edited-integrated-awaiting-user-review',apiTasks=22,apiSuccess=22,selectedGeneratedSources=9,rejectedGeneratedSources=13,deletedFiles=cleaned,deletedMiB=round(size,2),coreAssets=18,opening=str(opening),openingDuration=opmeta['duration'],fixedRows=81,dialogueFilmGroups=29,browser=read(OUT/'audit/browser-verification.json'),fullGameOrders=['甲→乙','乙→甲'],subjectiveListening=False))
print('Delivery report and status written.')
