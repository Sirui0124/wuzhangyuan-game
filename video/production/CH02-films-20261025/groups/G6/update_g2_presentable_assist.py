from pathlib import Path
import json,hashlib,uuid
from datetime import datetime,timezone
OUT=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    t=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
p=OUT/'review/G2-document-cleanup-assist.json';report=read(p)
save(OUT/'review/G2-document-cleanup-assist-before-presentable.json',report)
before=read(OUT/'review/G2-presentable-before.json');frames={x['id']:x for x in read(OUT/'review/G2-presentable-frame-evidence.json')}
replacements=[]
for row in before:
    k=row['id'];source=Path(row['file']);after=hashlib.sha256(source.read_bytes()).hexdigest();meta=read(source.with_suffix('.json'))
    stable=after==row['sha256']==meta['sha256'];f=frames[k]
    assert stable and f['stable'],'Source changed: stop this clip'
    dynamic=OUT/'review'/f'G2-{k}-presentable-dynamic-end.png';assert dynamic.is_file()
    text=meta['sourceLines'][0]['text'];node=meta['sourceLines'][0]['node']
    findings=[dict(timeRange=[0,2],category='action',observation='对方把一叠账页递到案前，我的双手伸入并接住/持页，对方松手后纸页开始翻起；接取动作在文字卡之前真实可见' if k=='V15-04' else '对方从案边取起竹卷，我先左手再右手握住，对方松手；约1.6秒切回案头并开始翻查纸页，接取动作真实可见'),dict(timeRange=[0,2],category='mask',observation='纸面/竹卷上的原生字局部柔化仍可察觉，但手指、页边、持握位置保留；没有旧版横贯大部分前景、连手一起糊掉的长时大块假面。未见可辨读的原生伪证据句子'),dict(timeRange=[2,10],category='accurate-document',observation='2.000秒明确切为全幅准确正文，底层生成纸页不再露边；正文逐字与本节点sourceLines相符，未混入其他账页内容'),dict(timeRange=[1.6,2] if k=='V18-04' else [1.5,2],category='cut-and-continuity',observation='约1.6秒由近持竹卷跳切回桌面，属于核对插镜；2秒切正文干净、可理解为阅读插入，不是完整无剪辑展开动作' if k=='V18-04' else '页角刚翻起时在2秒切正文，可理解为阅读插入；没有展示整页翻到尽头再放平，不应额外声称完整翻页全程已拍到')]
    conditions=['仅把前2秒作为真实接取/开始翻查，后8秒作为本节点材料的准确阅读插页；不把文字卡计作取得/签认/整页展开动作','正文只对应'+node+'：'+text,'材料来源与可读时机仍由G2对应父片和章节状态保证；该子片不授予其他节点信息，也不提前认定归责、供述或结局','将2秒正文切点保留为清楚阅读插入；若以后要求无剪辑完整展开或逐页翻完，不能用本版冒充，须另作本地节奏/源段调整']
    if k=='V18-04':conditions.append('保留约1.6秒案头跳切的插镜性质，前后接同一核对场景，不宣称是无剪辑连续持卷运动')
    c=dict(id=k,file=str(source),sha256=after,sha256Before=row['sha256'],sha256After=after,metadataSha256=meta['sha256'],unchangedDuringReview=True,reviewState='reviewed',pictureUsability='usable-with-integration-condition',userApproved=False,excludedFromCurrentVerdict=False,conclusion='PRESENTABLE当前画面可用，局部软化不破坏接取与翻查起始；准确正文只解释本节点，文字卡未代替已明确看到的接取动作',dynamicChecks=[dict(method='IAB原生视频1倍静音，8894根下当前PRESENTABLE文件，0.00播放至10.00 ended；V15另从头复看切点。仅记实际播放观察，不称连续人工逐帧',actualReviewedRanges=[[0,10]],evidence=str(dynamic))],auxiliaryEvidence=dict(method=f['sampling'],orderedFrameTimes=f['times'],sheets=f['sheets'],fileSha256=f['sha256']),findings=findings,integrationConditions=conditions,documentContentCheck=dict(node=node,observedCardText=text,sourceLineText=text,exactMatch=True,otherNodeFactsObserved=False,stateGateVerified=False,stateGateOwner='G2'),openVisualDefects=[],requiresNewVideoRequest=False,audioIssues=['静音画面协审，未逐字听审；未新增API/TTS，不为纯音频问题要求重拍'])
    replacements.append(c)
old=[c for c in report['clips'] if c['id'] in ['V15-04','V18-04']]
report.setdefault('retiredDrafts',[]).extend(old)
report['clips']=[next((r for r in replacements if r['id']==c['id']),c) for c in report['clips']]
report.update(status='four-requested-current-files-reviewed-with-conditions',updatedUTC=datetime.now(timezone.utc).isoformat(),scope='当前V13/V20沿用此前SHA绑定结论；本轮仅协审两条PRESENTABLE新V15/V18。旧大范围虚化草稿归档，不用于当前结论。未修改G2媒体或delivery，无API/TTS',counts=dict(currentReviewed=4,currentConditionalUsable=4,retiredDraftExcluded=len(report['retiredDrafts']),pending=0,sourceChanged=0),newAPIRequests=0,newTTSRequests=0)
save(p,report)
print(json.dumps(dict(report=str(p),counts=report['counts'],newClips=[dict(id=c['id'],sha256=c['sha256'],pictureUsability=c['pictureUsability']) for c in replacements]),ensure_ascii=False))
