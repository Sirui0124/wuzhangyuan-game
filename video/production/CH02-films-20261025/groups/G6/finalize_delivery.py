from pathlib import Path
import json,hashlib,uuid,collections,subprocess,io
from datetime import datetime,timezone
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    t=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
def link(label,p):return f'[{label}](<{Path(p).resolve().as_posix()}>)'
plan=read(OUT/'plan.json');assignment=read(OUT/'assignment.json');delivery=read(OUT/'delivery.json')
tracks={x['id']:x for x in read(OUT/'review/tracks-final.json')}
expected={x['node']:x for c in assignment['clips'] for x in c['lines']}
actual=collections.defaultdict(str)
for c in plan['requests']:
    for x in c['lines']:actual[x['node']]+=x['text']
coverage={k:dict(expected=v['text'],planned=actual[k],matches=v['text']==actual[k]) for k,v in expected.items()}
assert len(expected)==23 and set(actual)==set(expected) and all(x['matches'] for x in coverage.values()),'source line mapping mismatch'
save(OUT/'review/source-coverage-final.json',dict(nodeCount=len(expected),allPlannedTextExact=True,nodes=coverage,actualSpeechVerified=False))
tasks=[]
for p in (OUT/'tasks').glob('*.json'):
    if '.' in p.stem:continue
    t=read(p)
    if not t.get('task_id'):continue
    assert t['status'] in ('succeeded','failed'),p.name
    tasks.append(dict(id=p.stem,task_id=t['task_id'],status=t['status'],recoveredBy=p.stem+'-R2' if t['status']=='failed' else None))
counts=dict(collections.Counter(x['status'] for x in tasks));assert len(tasks)==29 and counts=={'succeeded':26,'failed':3},counts
gate=read(OUT/'dispatch-gate.json');skip=gate['skipRequests'];assert len(skip)==7
adopted=read(OUT/'review/visual-adopted.json')
reviews={
'V38-04':'修版已在浏览器从头播放至末帧，苟安留在伤帐、未切空床；既有中央心声已混入，未听审',
'V40-05':'修版已动态播放，并逐时抽帧检查；前景可识别脸已去除，同一军吏回案动作保留',
'V41L-01':'裁后动态回看无前景可识别面部；新版全段已播放至末帧',
'V41L-03':'4fps边缘检查及全段播放：前景仅手和甲衣腰部，无玩家脸',
}
for k,v in reviews.items():adopted[k]['visualReview']=v
save(OUT/'review/visual-adopted.json',adopted)
for f in delivery['films']:
    p=Path(f['path']);t=tracks[f['id']];assert p==Path(t['path']) and t['fullVideoTrack']
    sha=hashlib.sha256(p.read_bytes()).hexdigest();assert sha==f['sha256']
    f['duration']=t['containerDuration'];f['videoTrack']=t
    f['scriptNodes']=next(c['scriptNodes'] for c in assignment['clips'] if c['id']==f['id'])
    f['adopted']=[adopted.get(k,x) for k,x in zip(f['subclips'],f['adopted'])]
    f['visualReview']='已完成浏览器从头到结束播放、重点逐时抽帧及解码全轨检查；画面候选，待用户审核'
    f['audioReview']='待统一声音；未逐字听审'
    f['audioIssues']=list(dict.fromkeys(s for a in f['adopted'] for s in a.get('audioIssues',[]))) or ['原临时音轨未逐字听审，待统一声音']
    f['userApproved']=False
delivery.update(status='production-complete-picture-candidates-audio-pending',updatedUTC=datetime.now(timezone.utc).isoformat(),sourceCoverage='23/23节点原句在冻结分镜中精确覆盖；非成片声音转录',allGenerationTerminal=True,taskHistory=tasks,taskCounts=dict(submitted=29,succeeded=26,failedRecovered=3,skippedUnsubmitted=7,pending=0,unknown=0),skippedRequests=skip,sourceCoverageEvidence=str(OUT/'review/source-coverage-final.json'),playbackEvidence=str(OUT/'review/final-six-playback.png'),newTTSRequests=0,unresolved=['音色、原句、说话人与口型仍待统一及逐字听审；不得把ASR或静音播放当作声音审核','全部为画面候选，未获用户通过，未接入游戏'],retiredVersions=[dict(path=str(OUT/'assembled/V41L-晚支撑不足版：认下来的罪-R2.mp4'),reason='仅193帧/8.04秒画面但容器39.157秒，已由R3替代；旧文件保留，不可使用')])
save(OUT/'delivery.json',delivery)
gate.update(newPostEnabled=False,completionReason='全部已授权生成终态，本地修版及6段全轨核验完成；无后续生成必要');save(OUT/'dispatch-gate.json',gate)
status=read(OUT/'status.json');status.update(phase='production-complete-picture-candidates-audio-pending',pendingTasks=0,finalDelivery=str(OUT/'delivery.json'),userReview='待review');save(OUT/'status.json',status)
# Keep the frozen storyboard intact; distinguish current adoption from its original generation plan.
p=OUT/'分镜脚本.md';text=p.read_text(encoding='utf-8-sig')
notice='> 制作结果更新（2026-10-25）：以下保留原始22条分段设计，当前采用画面及裁切以 delivery.json 和《制作自查与交付》为准。结局已按授权允许第三人称、背面及反打，仍不得出现可识别的玩家面部。未统一全部声音；仅E2末镜配入既有中央心声，无新增TTS。原句覆盖核验不代表成片声音通过。\n\n'
if notice not in text:text=text.replace('\n\n','\n\n'+notice,1)
p.write_text(text,encoding='utf-8')
rows=['# G6 制作自查与交付','', '六段独立画面候选已完成。互斥分支各自播放；不越过确认按钮、不提前触发结局。全部待用户审核，声音待统一，未完成逐字听审，未接入游戏。','', '## 当前采用影片','', '| 槽位 | 影片 | 时长 | 实际视频帧 | 最后画面PTS |','|---|---|---:|---:|---:|']
for f in delivery['films']:
    t=f['videoTrack'];rows.append(f"| {f['id']} | {link(f['name'],f['path'])} | {f['duration']:.3f}秒 | {t['videoFrames']} | {t['lastPTS']:.6f}秒 |")
rows+=['','## 画面与分支检查','', '- E2：材料核收后苟安留营受查，末镜为同一苟安在伤帐中的存活反应；没有挪用E3空床作为E2结尾。既有 CH2-E2-003.wav 已配入该末镜。','- V39：仅共同收件动作，独立保留。是否进入E3或晚E4仍取决于既定Q判断，不把收件当作结案。','- E3：伤帐问话、正式查办消息、死亡后空铺及裸木底板空车按顺序连接；移除错误满粮车、额外搬粮动作和前景可识别玩家侧脸。V42由G5负责，本组不跨接。','- 早E4与晚E4分开，前者不虚构已知串通线索，后者保留知道线索但支撑不足的含义；只复用中性案头或同人反应画面，不导入其他分支声音和知识。','- E5：先实际放行，再显示之后军中散谣的后果，不在放行前触发结局。','- 六段已在浏览器从头播放到结束，重点处另做逐时抽帧；这是制作自查，不能代替用户审阅。','', '## 技术核验','', '六段均为1280×720、24fps、48kHz音轨。逐帧解码检查视频帧数、最后PTS、最大帧间隔及音轨覆盖，六段均有完整画面轨，无时间戳倒退，最大帧间隔为1/24秒。容器末尾0.02–0.12秒音频尾差单独保留在记录中，未把音轨时长当作视频帧覆盖。','', '晚E4旧R2仅有约8秒真实画面而容器约39秒，已经停用。当前独立R3按输入先归零时间戳、统一帧率及尺寸后滤镜拼接；实际938帧，视频覆盖至39.083333秒，容器39.146秒。旧文件保留在原处，不列为当前采用。','',f"核验原始记录：{link('完整视频轨核验',OUT/'review/tracks-final.json')}；{link('播放结束截图',OUT/'review/final-six-playback.png')}；{link('当前交付清单及SHA256',OUT/'delivery.json')}。",'', '## 生成与声音状态','', '29条唯一视频任务均已终态：26条成功并下载，3条历史参考图下载失败均有独立R2恢复结果；7条未提交的返修方案已跳过。没有运行中或结果不明任务。最终两项局部修复只用已有视频和音频，没有新增视频API或TTS请求。','', '保留现有临时音轨供后续统一处理。错词、说话人、音色、音乐及口型问题仍在 delivery.json 的 audioIssues 中明确记录；不得宣称完整原句在成片中已听审通过。ASR仅用于定位。','', '## 原句、参考图与独立Prompt','', f"{link('分镜脚本',OUT/'分镜脚本.md')}；{link('23节点原句覆盖核验',OUT/'review/source-coverage-final.json')}；{link('参考图职责与真实路径',OUT/'reference-bindings.json')}；{link('自补参考图清单',OUT/'references/manifest.json')}。",'', '下列保留最初22条独立生成文档。最终返修、任务编号和实际采用路径以交付JSON为准，跳过的方案不计为已生成。','']
for c in plan['requests']:
    rows.append('- '+link(c['id'],OUT/'prompts'/f"{c['id']}.md"))
rows+=['','每条文档内保留具体参考图路径、图号职责和连续分镜。原始规划总时长与生成/裁切后时长分别记录，不将规划数字冒充实际影片长度。','']
(OUT/'制作自查与交付.md').write_text('\n'.join(rows),encoding='utf-8')
# Review crop at 1fps including both boundaries, retaining the original audio unchanged.
sheet=Image.new('RGB',(1600,1040),'#171717');draw=ImageDraw.Draw(sheet)
for i,t in enumerate([.2,1.2,2.2,3.2,4.2,5.2,6.2,7.2,8.2,9.2]):
    b=subprocess.run([FF,'-v','error','-ss',str(t),'-i',str(OUT/'edited/V40-05-face-safe-R2.mp4'),'-frames:v','1','-vf','scale=400:225','-f','image2pipe','-vcodec','png','pipe:1'],capture_output=True,check=True).stdout
    im=Image.open(io.BytesIO(b));x=(i%4)*400;y=(i//4)*260;sheet.paste(im,(x,y));draw.text((x+5,y+228),f'V40-05 face-safe {t:.1f}s',fill='white')
sheet.save(OUT/'review/V40-05-face-safe-grid.jpg')
print(json.dumps(dict(films=[dict(id=f['id'],path=f['path'],duration=f['duration'],sha256=f['sha256']) for f in delivery['films']],tasks=counts,sourceNodes=len(expected)),ensure_ascii=False))
