"""Record inspected frame sequences and adopt only the verified E3 frame fix."""
from pathlib import Path
import json, hashlib, time, copy
R=Path(__file__).resolve().parents[2]; O=Path(__file__).resolve().parent
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
save=lambda p,d:p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
repair=read(O/'E3-tail-repair.json'); assert sha(repair['path'])==repair['sha256']
index=read(O/'index.json'); audit=read(O/'G6-source-audit.json'); assert audit['allMatch']
files=[R/'delivery.json',R/'revision-v2/E3-delivery.json',R/'审片.html',R/'第二章结局交付.md',R/'review/pace-v2/technical-audit.json']
snap={p:p.read_bytes() for p in files}; backup=O/'before-adoption';backup.mkdir(exist_ok=True)
for p,b in snap.items():
    name=('E3-' if p.parent.name=='revision-v2' else '')+p.name
    q=backup/name
    if not q.exists():q.write_bytes(b)
d=read(R/'delivery.json'); previous=copy.deepcopy(d)
observations={
 'E1':['苟安约46.3秒开始笑开，持续笑着示意同行，约51.8秒转身扶车；已查看44.833–55秒每4帧序列。','约53.75秒从近背影切原双人推车，景别和身体位置有跳变但动作方向一致；未见需要重拍的明显穿插。','军吏同轴景别变化较明显；删卡后保留人物反应与收卷。画面不能独立证明所有对白完整，仍需声音统一与听审。'],
 'EPILOGUE':['0–7秒双手扶卷渐放平；约10.5秒右手开始抬近侧纸角，12–14.5秒翻折落定。6fps全时段序列未见明显手穿纸/悬空抓取。','画面是旧卷纸背，没有可读统计表，不应被当作新增人口或损耗证据；含义由已有心声和前文承担。'],
 'E3':['在旧V2末帧1797 / 74.875秒发现已拆出V42的桌面残帧，属于真实单帧跳画。','V3仅用前一帧空铺替代该末帧，保留1798帧及原音频包；新增末12帧全部查看。','其余收件、病榻、空铺切点按index所列帧查看；空铺能表现缺席，死亡事实仍须既有分支剧情明确。'],
 'E4-early':['10.125秒案头卷束切病榻，切点两侧逐帧检查未见闪帧；尾段睁眼到低头的反应保留。','仅适用于早停查分支；不能把未问清的李严责任解释为已经查实。'],
 'E4-late':['实际19.5秒由共同收件案头转入军吏胸像；与名义19.625秒存在3帧差异，已查看两侧序列，无黑帧。','结尾双手归拢卷束的动作连续；仅适用于晚交案支撑不足，不替代早停查版本，也不表示材料全被核实。']}
records=[]
for id,notes in observations.items():
    row=next(x for x in d['films']+d['epilogues'] if x['id']==id)
    seq=[x for x in index if x['id']==id]
    assert all(x['sha256']==row['sha256'] for x in seq)
    rec=dict(id=id,path=row['path'],sha256=row['sha256'],pictureUsability='usable-with-integration-condition',
      observations=notes,inspectedSequenceIndex=str(O/'index.json'),inspectedSheets=[x['sheet'] for x in seq],
      inspectedTimestamps=sorted(set(t for x in seq for t in x['times'])),
      method='有序静态抽帧；动作6fps，指定切点附近逐帧；不是连续视频输入',
      actualPlaybackObservations=[],continuousHumanReview=False,audioListening=False,userApproved=False,gameIntegrated=False)
    if id=='E3':
        rec.update(path=repair['path'],sha256=repair['sha256'],priorVersionInspected=row['sha256'],repair=repair,
          inspectedCurrentVersionTimes=[i/24 for i in range(1786,1798)],
          scope='旧V2关键切点序列，加V3末12帧；未把旧版序列写成V3全片重新观看')
    records.append(rec)
report=dict(createdEpoch=time.time(),records=records,sourceAudit=str(O/'G6-source-audit.json'),
  limitations='本次没有新增实播观察；不是完整连续人工审片，没有逐字听审，用户未通过。全片解码/旧全时段抽帧另有记录。',
  noNewGeneration=True,noNewTTS=True)
save(O/'assessment.json',report)
e3=read(R/'revision-v2/E3-delivery.json'); assert e3['sha256']==repair['sourceSha256']
e3['previousRevision']=dict(path=e3['path'],sha256=e3['sha256'])
e3.update(path=repair['path'],sha256=repair['sha256'],videoCoverage=repair['videoCoverage'],
  postProcessing=[dict(operation='replace-last-frame-with-previous',source=repair['source'],sourceSha256=repair['sourceSha256'],frameIndex=1797,heldFrameIndex=1796,audioPacketsUnchanged=True)],
  visualReview='有序抽帧复核及末帧修复完成；非完整连续人工观看，待用户review',visualReviewEvidence=str(O/'assessment.json'))
for row in d['films']+d['epilogues']:
    if row['id']=='E3':row.update(e3)
    if row['id'] in observations:
        row['visualReviewEvidence']=str(O/'assessment.json')
        row['visualReview']='关键动作/切点有序抽帧复核完成；非完整连续人工观看，待用户review'
        row['pictureUsability']='usable-with-integration-condition'
        row['userApproved']=False
d['updatedEpoch']=time.time()
tech=read(R/'review/pace-v2/technical-audit.json')
for x in tech['records']:
    if x['id']=='E3':
        x.update(sha256=repair['sha256'],fullDecode=repair['videoCoverage'],repairEvidence=str(O/'E3-tail-repair.json'),
          blackDetectionBasis='原V2全片检测无黑场；唯一替换帧为已检查的前一帧空铺，V3全片解码通过。')
oldname=Path(repair['source']).name;newname=Path(repair['path']).name
page=(R/'审片.html').read_text(encoding='utf-8');notes=(R/'第二章结局交付.md').read_text(encoding='utf-8')
assert page.count(oldname)==1 and notes.count(oldname)==1
assert all(p.read_bytes()==b for p,b in snap.items()),'Concurrent change: stop before write'
save(R/'revision-v2/E3-delivery.json',e3);save(R/'delivery.json',d);save(R/'review/pace-v2/technical-audit.json',tech)
(R/'审片.html').write_text(page.replace(oldname,newname),encoding='utf-8')
(R/'第二章结局交付.md').write_text(notes.replace(oldname,newname)+'\n补充画面检查：E3 V3 修正片尾一帧误入的旧尾声桌面，原音频包与时长保留。关键动作和切点有序抽帧记录见 review/motion-followup/assessment.json；未完成连续人工全片观看或逐字听审。\n',encoding='utf-8')
for before in previous['films']+previous['epilogues']:
    after=next(x for x in d['films']+d['epilogues'] if x['id']==before['id'])
    assert sha(after['path'])==after['sha256']
    if before['id']!='E3':assert (after['path'],after['sha256'])==(before['path'],before['sha256'])
assert (R/'审片.html').read_text(encoding='utf-8').count('<video ')==7
save(O/'adoption-audit.json',{'allCurrentHashesVerified':True,'onlyChangedMedia':'E3','otherSixMediaUnchanged':True,'sourceAuditAllMatch':True,'userApproved':False,'gameIntegrated':False})
print('Assessment saved; only E3 media reference advanced to V3; all seven hashes verified.')
