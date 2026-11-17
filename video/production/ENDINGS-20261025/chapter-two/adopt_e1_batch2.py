"""Publish the reviewed local E1 trim without modifying other endings or approvals."""
from pathlib import Path
import copy, hashlib, json, re, shutil, subprocess, time
R=Path(__file__).resolve().parent;D=R/'review/batch2-audio'
def read(p):return json.loads(p.read_text('utf-8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
c=read(D/'E1-repair-candidate.json');assert sha(c['path'])==c['sha256']
before=read(R/'delivery.json');old=next(x for x in before['films'] if x['id']=='E1')
assert old['sha256']==c['oldSha256'],'Current E1 changed; compare before adopting'
for name in ['delivery.json','审片.html','第二章结局交付.md']:
 p=D/('before-E1-'+name)
 if not p.exists():shutil.copy2(R/name,p)
ff='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
black=subprocess.run([ff,'-hide_banner','-i',c['path'],'-vf','blackdetect=d=0.08:pix_th=0.10','-an','-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
blacklines=[line for line in black.stderr.splitlines() if 'black_start:' in line]
assert not blacklines,blacklines
new=copy.deepcopy(old)
new.update(title='一起回头',path=c['path'],sha256=c['sha256'],duration=round(c['duration'],3),videoCoverage=dict(videoSeconds=c['duration'],decodedFrames=c['decodedFrames'],expectedSeconds=c['duration'],passed=True),previousRevision=old,overview=str(D/'E1-V3-review.jpg'),audioReview='已按原组确认清除导演说明误读；合法对白/心声保留；未逐字听审',visualReview='已查看新开头、退军令动作、快乐招呼与末尾的有序抽帧；非连续全片观看',visualReviewEvidence=str(D/'E1-repair-candidate.json'))
new['editDecisionList']=[dict(id='E1-batch2-trim',path=c['oldPath'],sourceSha256=c['oldSha256'],start=5.75,end=1435/24,frames=1297,duration=c['duration'],timelineStart=0,timelineEnd=c['duration'],reason='删除开头导演说明及冗余反应；保留快乐结局、合法对白与心声',essentialActionAudioCleanup=c['essentialActionAudioCleanup'])]
new['postProcessing']=dict(type='confirmed-director-speech-cleanup',record=str(D/'E1-repair-candidate.json'),newGeneration=False,newTTS=False)
new['pictureUsability']='新版待用户审阅；旧审批不继承'
new['visualAssessment']='有序抽帧：军吏收件、裁处、递交退军令及苟安笑着招呼/转身/推车均保留；待连续听审'
save(R/'revision-v2/E1-delivery.json',new)
after=copy.deepcopy(before);after['films']=[new if x['id']=='E1' else x for x in after['films']];after['updatedEpoch']=time.time();save(R/'delivery.json',after)
p=R/'审片.html';text=p.read_text('utf-8');text=text.replace(Path(old['path']).name,Path(c['path']).name).replace('「一起回头」60秒修订版','「一起回头」约54秒修订版').replace('<h2>一起回头-60秒</h2>','<h2>一起回头</h2>').replace('60.0 秒 · 待审阅','54.0 秒 · 待审阅');p.write_text(text,'utf-8')
p=R/'第二章结局交付.md';text=p.read_text('utf-8').replace('一起回头压为60秒','一起回头先压为60秒，本轮去除导演说明误读及冗余反应后为54.04秒').replace('一起回头-60秒 | 60.00秒','一起回头 | 54.04秒').replace(Path(old['path']).name,Path(c['path']).name);text+='\nE1 V3：删去开头误读“先收齐才谈核实”及多余反应；保留退军令递交动作并清除该无台词镜头的人声。苟安快乐招呼、推车及合法末心声保留。新长度54.04秒，独立尾声仍15秒；本轮无新增生成。\n';p.write_text(text,'utf-8')
p=R/'review/pace-v2/technical-audit.json';a=read(p)
for r in a['records']:
 if r['id']=='E1':r.update(sha256=c['sha256'],duration=new['duration'],fullDecode=new['videoCoverage'],blackIntervals=[],repairEvidence=str(D/'E1-repair-candidate.json'))
save(p,a)
unchanged=[]
for a,b in zip(before['films']+before['epilogues'],after['films']+after['epilogues']):
 assert sha(b['path'])==b['sha256']
 if a['id']!='E1':assert a==b;unchanged.append(a['id'])
save(D/'E1-adoption.json',dict(oldSha256=c['oldSha256'],newSha256=c['sha256'],oldDuration=60,newDuration=c['duration'],otherRecordsAndFilesUnchanged=unchanged,blackIntervals=blacklines,userApproved=False,gameIntegrated=False,audioListening=False,newGeneration=False))
print(json.dumps(dict(path=c['path'],sha256=c['sha256'],duration=c['duration'],unchanged=unchanged),ensure_ascii=False))
