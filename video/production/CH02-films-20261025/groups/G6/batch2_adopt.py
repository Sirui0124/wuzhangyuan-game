"""Adopt only checked independent candidates, preserving baseline and approvals."""
from pathlib import Path
import json,hashlib,uuid,datetime,html
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'user-review-batch2';BASE=ROOT.parents[1]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):
    tmp=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');tmp.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(p)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
baseline=read(OUT/'baseline-delivery.json');current=read(ROOT/'delivery.json');white=read(OUT/'speech-whitelist.json')
comments=read(BASE/'reviews/user-20261025-batch2/comments-and-versions.json')
policy=read(BASE/'reviews/user-20261025-batch2/repair-policy.json')
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
semantics={
'V38':['停手署名和材料提交实际发生后接入；只得到留营受查、李严一节待核的阶段结论','苟安末段仍在伤帐，没有换成死亡或空铺','我的画外对白/心声由玩家WAV承担；军吏只承担核收及阶段结论原句'],
'V39':['实际收下材料后才按锁定Q分流，Q真去V40，Q假去V41L','共同收件不提前判定李严责任或凭空补齐缺失证据','我的递交说明与军吏核收原句均保留，删掉元说明音画'],
'V40':['仅在V39实际收件且Q真后进入查办；苟安担责及我要求查李严均保留','正式裁处及军法处死原句先于空铺和空粮车；不把提交材料直接当处死','三句合法末心声完整保留；不将G5的V42重复附在本片','死讯起音保留完整，孤立入座闪镜已用前镜连续尾部3帧替换'],
'V41E':['仅早停查确认后播放；不知道后段合谋，不追加死亡结果','保留军吏接办/退军旁白、苟安询问及完整早停查反思','反思使用我的画外声，苟安只做闭口反应'],
'V41L':['仅V39实际收件且Q假后播放；明确有李严线索但支撑不足','军吏两句结论与完整晚支撑不足心声保留，不能变成早停查或最终定罪','第二句实际上传同军吏冻结参考至Seed-Audio1.0，使用连续案头近景承载续答，避免给旧口型硬配新声'],
'V43':['实际放行的回身与离开动作先发生，之后才旁白后来赴魏及谣言传回','没有新增谣言内容或正式查办结果','纯放行动作保留5.667秒并去掉污染原声；有实际动作推进，不静止填满旧9.42秒']}
suspects={
'V38':[(0.4,8.96,'原段未识别出白名单玩家递交原句，含不连贯控制/乱码；替换授权玩家WAV'),(10.46,13.94,'核收前元说明/乱码'),(17.62,18.94,'核收中间额外元说明/乱码')],
'V39':[(0,9.54,'递交段不连贯控制/乱码；替换完整玩家原句'),(10.14,11.86,'核收前控制/乱码'),(17.76,19.6,'核收后控制/乱码')],
'V40':[(12.04,19.34,'原监听反应段额外控制/乱码，换玩家原句'),(20.54,24.9,'纯演出节点误读/乱码，删并缩短转场'),(32.1,37.25,'死讯前控制文字，含苟安死讯标签型读出'),(40.9,47.28,'空铺段控制/乱码；换三句合法心声并缩短必要画面')],
'V41E':[(5.53,10.61,'收件演出控制/乱码，换合法退军旁白'),(16.52,23.18,'问题后的控制/反应说明，换完整合法反思')],
'V41L':[(19.9,25.45,'句末核字边界不稳；ASR不能证明读错，不再盲截，以同角色参考仅补该句'),(27.66,35.18,'心声画面原声不连贯控制/乱码，换完整已授权心声')],
'V43':[(.82,9.44,'纯放行演出原声不连贯控制/乱码，去掉原声并压缩步行'),(13.34,13.98,'后果段非白名单短声，整段原声去除，换后来原句')]}
report=dict(group='G6',policy=policy['id'],status='repaired-ready-for-user-review-hearing-pending',updatedUTC=now,commentsSource=str(BASE/'reviews/user-20261025-batch2/comments-and-versions.json'),policySource=str(BASE/'reviews/user-20261025-batch2/repair-policy.json'),userApproved=False,originalFilesPreserved=True,newVideoRequests=0,newAudioRequests=1,reusedExistingPlayerLines=11,reusedOriginalNPCLines=7,referenceGeneratedNPCLines=1,speechWhitelistCount=19,pureActionNodes=4,scope='G6 production only; no game/ENDINGS/online edits',audioListening='pending actual listening; cannot establish word-perfect hearing, timbre, BGM absence, or subjective lip sync using ASR',films=[])
newfilms=[];picture=[];edls=[]
for old in baseline['films']:
    fid=old['id'];live=next(f for f in current['films'] if f['id']==fid)
    assert live['sha256']==old['sha256'] and sha(old['path'])==old['sha256'],'Concurrent delivery/source change'
    r=read(OUT/(fid+'-candidate.json'));p=Path(r['path']);assert sha(p)==r['sha256']
    assert r['videoTrack']['fullVideoTrack'] and r['videoTrack']['videoFrames']==round(r['duration']*24)
    expected=sorted(w['node'] for w in white if w['clip']==fid and w['spoken']);assert r['whitelistCoverage']==expected
    asr=OUT/(p.stem+'-asr.json');a=read(asr);assert a['sha256']==r['sha256']
    pe=read(OUT/(fid+'-picture-evidence.json'));assert pe['sha256']==r['sha256']
    playback=OUT/(fid+'-playback-end.png');assert playback.exists(),'Native final playback missing '+fid
    for sh in pe['sheets']:assert Path(sh).exists()
    row=next(x for x in comments['rows'] if x['id']==fid);assert not row['approved']
    for bl in r['edl']:
        if '手部近景' in bl['reason']:bl['reason']=bl['reason'].replace('案头手部近景','案头近景')
    remaining=['实际逐字听审、跨片音色一致性、原声片段BGM与细口型审核未完成；ASR/技术检查不代替用户通过']
    item=dict(id=fid,oldFile=old['path'],oldSha256=old['sha256'],oldDuration=old['duration'],newFile=str(p),newSha256=r['sha256'],newDuration=r['duration'],removedSeconds=r['removedSeconds'],reviewedSnapshot=row,userApproved=False,whitelist=[w for w in white if w['clip']==fid],speakers=sorted(set(w['role'] for w in white if w['clip']==fid and w['spoken'])),suspectedMisreadIntervals=[dict(start=a,end=b,reason=t,evidence='ASR locator plus frozen original speech/source structure; not an actual listening claim') for a,b,t in suspects[fid]],actualEdits=r['edl'],audioTracks=r['audioTracks'],keyActionAndBranchContinuity=semantics[fid],verification=dict(videoTrack=r['videoTrack'],fullCandidateASR=str(asr),orderedPictureEvidence=str(OUT/(fid+'-picture-evidence.json')),nativePlayback=dict(method='IAB native video at 1x muted started at 0 and visibly reached ended; separate from actual hearing',path=str(p),sha256=r['sha256'],duration=r['duration'],endScreenshot=str(playback)),audioSourcesOnlyWhitelist=True),newVideoRequests=0,newAudioRequests=r['newAudioRequests'],unresolved=remaining,status='ready-for-user-review-hearing-pending')
    if fid=='V40':
        item['seamEvidence']=str(OUT/'V40-R2-seam-evidence.json')
        seam=read(OUT/'V40-R2-seam-evidence.json');seam['operation']=seam['operation'].replace('all 12 whitelist','all 7 whitelist');save(OUT/'V40-R2-seam-evidence.json',seam)
    if fid=='V41L':item['newVoiceState']=r['newVoiceState'];item['newVoiceASR']=str(OUT/'CH2-E4-LATE-002-R1-seed-audio1-reference-asr.json')
    report['films'].append(item)
    f=dict(old);f.update(path=str(p),sha256=r['sha256'],duration=r['duration'],videoTrack=r['videoTrack'],decode='passed',audioReview='19句白名单对应音源已重建、ASR辅助定位完成；实际听审/音色/BGM/细口型待用户审核',audioIssues=remaining,userReview='新版本待review；不继承旧通过',userApproved=False,visualReview='当前SHA顺序采样、关键接缝和原生从0到ended核对完成；非用户通过',reviewState='reviewed',reviewPolicy=policy['id'],newStandardReview=str(ROOT/'user-review-batch2.json'),batch2Report=str(ROOT/'user-review-batch2.json'),integrationConditions=semantics[fid],adopted=[dict(path=str(p),sha256=r['sha256'],duration=r['duration'],operation='frame-index EDL and explicit whitelist-only audio rebuild',originalBaseline=str(OUT/'baseline-delivery.json'),edl=str(OUT/(fid+'-candidate.json')),audioTracks=r['audioTracks'])],supersedes=dict(path=old['path'],sha256=old['sha256'],reason='batch2 speech metadata cleanup and excess duration'))
    newfilms.append(f)
    picture.append(dict(id=fid,name=f['name'],file=str(p),sha256=r['sha256'],duration=r['duration'],pictureUsability='usable-with-integration-condition',reviewState='reviewed',userApproved=False,reviewPolicy=policy['id'],videoTrack=r['videoTrack'],integrationConditions=semantics[fid],dynamicChecks=[item['verification']['nativePlayback'],dict(method=pe['sampling'],indexFile=str(OUT/(fid+'-picture-evidence.json')),sheets=pe['sheets'])],audioReview=f['audioReview'],unresolved=remaining))
    edls.append(r)
report['totals']=dict(oldSeconds=sum(x['oldDuration'] for x in report['films']),newSeconds=sum(x['newDuration'] for x in report['films']),removedSeconds=sum(x['removedSeconds'] for x in report['films']))
for name in ['picture-usability.json','visual-adopted.json']:
    dest=OUT/('baseline-'+name)
    if not dest.exists():(dest).write_bytes((ROOT/'review'/name).read_bytes())
save(OUT/'final-edl-and-sources.json',edls)
save(ROOT/'user-review-batch2.json',report)
save(ROOT/'review/picture-usability.json',dict(group='G6',status='batch2-current-sha-reviewed-with-integration-conditions-hearing-pending',updatedUTC=now,clips=picture,reviewPolicy=policy['id'],batch2Report=str(ROOT/'user-review-batch2.json')))
current.update(films=newfilms,status='batch2-repaired-ready-for-user-review-hearing-pending',updatedUTC=now,reviewPolicy=policy['id'],userReviewBatch2=str(ROOT/'user-review-batch2.json'),newTTSRequests=1,userApproval=False,unresolved=['六片新版待用户review；实际逐字听审、跨片音色、BGM与细口型待审核','仅G6制作文件已更新；ENDINGS由总控/结局负责人按新源重组，未改游戏'])
save(ROOT/'delivery.json',current)
assert {f['id']:f['sha256'] for f in read(ROOT/'delivery.json')['films']}=={f['id']:f['sha256'] for f in newfilms}
table='\n'.join(f"| {f['id']} | {f['oldDuration']:.3f} | {f['newDuration']:.3f} | {f['removedSeconds']:.3f} |" for f in report['films'])
doc='# G6 第二批声音与时长返修\n\n六片均已处理并更新当前交付索引；新版本待用户 review。保留19句真实对白/心声、4个必要演出节点，删除误读占用的音画和多余停顿。旧文件与旧审核记录保留。\n\n| 片段 | 原时长（秒） | 新时长（秒） | 减少（秒） |\n| --- | ---: | ---: | ---: |\n'+table+'\n\n共减少 '+f"{report['totals']['removedSeconds']:.3f}"+' 秒。11句玩家沿用已授权中央音轨，7句NPC保留原声，仅V41L第二句用Seed-Audio1.0实际上传同军吏冻结参考补齐。没有新增视频请求。\n\nV40死讯在空铺/空粮车之前，三句末心声完整；E2保留苟安活着留营；早/晚E4信息分支保持独立；E5先实际放行再有后来。V40极短入座闪镜已移除，完整死讯音轨未动。\n\n六片实际帧数、PTS、完整轨道、当前SHA、19句音源及原生从0到ended已核对。ASR仅辅助定位，实际逐字听审、跨片音色、BGM及细口型仍待用户审核。没有把自动检查当用户通过。未改游戏、ENDINGS或在线文档。\n\n当前播放： [修版核对页](http://127.0.0.1:8894/groups/G6/user-review-batch2/candidate-player.html)。\n\n逐条白名单、误读区间、实际EDL与SHA：[返修记录]('+str(ROOT/'user-review-batch2.json')+')。\n'
(ROOT/'制作自查与交付.md').write_text(doc,encoding='utf-8')
page='<!doctype html><meta charset="utf-8"><title>G6 当前修版</title><style>body{background:#181818;color:#eee;font:18px sans-serif;max-width:1100px;margin:auto}video{width:100%}a{color:#9cf}</style><h1>G6 第二批修版 · 待review</h1><p>保留真实对白和必要动作，声音实际听审待完成。</p>'
for f in newfilms:
    rel=Path(f['path']).relative_to(ROOT).as_posix();page+='<h2>'+html.escape(f['id']+' '+f['name'])+'</h2><video controls preload="metadata" src="'+html.escape(rel)+'"></video><p>'+html.escape(f"{f['duration']:.3f}秒 | SHA {f['sha256']}")+'</p>'
(ROOT/'播放审阅.html').write_text(page,encoding='utf-8')
print(json.dumps(dict(status=report['status'],films=6,whiteList=19,newAudioRequests=1,newVideoRequests=0,totals=report['totals'],currentSHAs={f['id']:f['sha256'] for f in newfilms}),ensure_ascii=False,indent=2))
