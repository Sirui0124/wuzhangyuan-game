from pathlib import Path
import json, hashlib, shutil, subprocess, sys
import av

R=Path(__file__).resolve().parents[2]
D=Path(__file__).resolve().parent
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,x): p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def audio_hash(p):
    h=hashlib.sha256(); count=0
    with av.open(str(p)) as c:
        for packet in c.demux(audio=0):
            if packet.size: h.update(bytes(packet));count+=1
    return dict(sha256=h.hexdigest(),packets=count)

candidate=D/'C1END-TENT-action-insert-preview.mp4'
assert sha(candidate)=='d1a63105c7afdd7d35f97340c325ec80f685ebccd69321c4951e50c4fddd4a61'
source=R/'films/C1END-TENT-帐后有刀.mp4'
assert sha(source)=='8a32bb2697bc9ffb1efc95116d795aebb3915e124b2516a3e03126bc210db141'
take='C1END-TENT-R1-CUT3'
target=R/'films'/f'{take}-帐后有刀.mp4'
c2=R/'chapter-two'
protected=[c2/'delivery.json',c2/'审片.html',*list((c2/'films').glob('*.mp4'))]
before={str(p):sha(p) for p in protected}
tech=read(R/'technical-review.json')
others=[x for x in tech if x['id']!='C1END-TENT']
audio_source=audio_hash(source);audio_candidate=audio_hash(candidate)
assert audio_source==audio_candidate
with av.open(str(candidate)) as c:
    s=c.streams.video[0];frames=list(c.decode(s))
    assert len(frames)==293 and s.width==1280 and s.height==720
    duration=round(len(frames)/24,6)
with av.open(str(candidate)) as c:
    audio_frames=sum(1 for f in c.decode(audio=0));assert audio_frames>0
backup=D/'before-adoption';backup.mkdir(exist_ok=True)
for name in ['adoption.json','technical-review.json','visual-review.json','revision-log.json','delivery.json','审片.html','实际交付与审片记录.md']:
    p=R/name
    if p.exists() and not (backup/name).exists():shutil.copy2(p,backup/name)
if target.exists(): assert sha(target)==sha(candidate)
else: shutil.copy2(candidate,target)
review=dict(
    method='原生离线播放器真实1x播放到末帧；分段复看并观察播放中截图，另核对全长3fps与两切点24fps连续帧。不是逐帧全片人工审查或声音听审。',
    decision='candidate-with-integration-condition',
    observations=[
        '0–5.5秒军士靠近并停在玩家面前；5.5–8.625秒同一动作时间的腰身、手部近景，转身时未见可辨玩家面孔。',
        '8.625秒回全景，玩家背向向右离开，两军士依次同向跟进，形成看守带离；未表现抓握、捆绑或行刑。',
        '全景到动作近景再回全景，保持原动作时间和方向；近景较软，属于原1280×720素材的局部放大。',
        '帐布不透明，不新增帐内信息；末尾保留原画面渐暗。'],
    audio='原始R1压缩音频包哈希一致；未听审，没有生成新TTS。',
    pictureUsability='usable-with-integration-condition',
    integrationConditions=['接在游戏已确认擅闯与处罚判定之后；死亡结论由已有结局承担，视频本身只呈现拦下与带离。'],
    userApproved=False)
row=next(x for x in tech if x['id']=='C1END-TENT')
row.update(path=str(target),source=str(source),take=take,task=read(R/'tasks/C1END-TENT.json')['task_id'],duration='00:00:12.26',videoSeconds=duration,decodedFrames=293,sha256=sha(target),motionSamples=str(D/'verify-whole.jpg'),visualReview=review,pictureUsability=review['pictureUsability'],localRevision=True,originTake='C1END-TENT',newApiRequest=False,audioPacketIdentity=audio_candidate,audioReview='not-listened',userApproved=False,gameIntegrated=False)
assert others==[x for x in tech if x['id']!='C1END-TENT']
write(R/'technical-review.json',tech)
adopt=read(R/'adoption.json');adopt['C1END-TENT']=take;write(R/'adoption.json',adopt)
visual=read(R/'visual-review.json')
visual['C1END-TENT-R2'].update(decision='not-adopted-needs-action-repair',pictureUsability='needs-repair',observations=['更正此前三人沿路远离的判断：R2中军士前行，玩家仍近镜头，随后镜头上仰，未清楚表现带离。'],replacement=take)
visual['C1END-TENT']['replacement']=take
visual[take]=review;write(R/'visual-review.json',visual)
ed=read(D/'edit.json');ed.update(status='adopted-review-candidate',adopted=True,adoptedFile=str(target),adoptedTake=take,visualCheck=review, userApproved=False);write(D/'edit.json',ed)
log=read(R/'revision-log.json')
log.append(dict(id='C1END-TENT',rejectedTake='C1END-TENT-R2',replacement=take,sourceTake='C1END-TENT',reason='R2带离动作未成立；采用R1同时间动作近景修剪，避开玩家侧脸。',newApiRequest=False,userApproved=False))
write(R/'revision-log.json',log)
subprocess.run([sys.executable,str(R/'publish.py')],check=True)
delivery=read(R/'delivery.json');new=next(x for x in delivery['films'] if x['id']=='C1END-TENT')
assert new['film']['sha256']==sha(target) and new['film']['take']==take and not new['userApproved']
assert target.relative_to(R).as_posix() in (R/'审片.html').read_text(encoding='utf-8')
assert before=={str(p):sha(p) for p in protected}
audit=dict(take=take,path=str(target),sha256=sha(target),fullVideoDecode=True,videoFrames=293,videoSeconds=duration,audioDecodeFrames=audio_frames,audioPacketsIdenticalToR1=True,chapterTwoProtectedFilesUnchanged=True,otherFourTechnicalRowsUnchanged=True,pictureUsability=review['pictureUsability'],review=review,userApproved=False,gameIntegrated=False)
write(D/'adoption-audit.json',audit)
p=R/'实际交付与审片记录.md'
note='# 帐后有刀修剪更新（当前采用版本）\n\n'+f'采用 `{take}`，文件 `{target}`。SHA256 `{sha(target)}`。\n\n'+ '原R2未清楚呈现带离，撤销此前三人远离的表述。新版本沿用R1，5.5–8.625秒切同时间动作近景，避开玩家侧脸，再回全景呈现军士看守下离开。未显示抓握、捆绑或行刑。画面有条件可用：只接在既有处罚判定后。\n\n原生离线播放器已实际播放，结合播放中截图、全长3fps及切点24fps连续帧检查；不等同逐帧全片审核。视频293帧、约12.208秒，容器约12.26秒；全解码通过，原R1音频压缩包哈希一致，未听审。仍待用户审阅，未接入游戏。第二章交付和其余四条影片未修改。\n\n---\n\n以下为历史交付记录；有关TENT旧采用版本与旧动作判断以上方记录为准。\n\n'
p.write_text(note+p.read_text(encoding='utf-8'),encoding='utf-8')
print(json.dumps(audit,ensure_ascii=False))
