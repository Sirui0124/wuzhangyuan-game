from pathlib import Path
import json,hashlib,uuid,shutil
from datetime import datetime,timezone
OUT=Path(__file__).resolve().parent;ROOT=OUT/'user-review-20261025';POLICY='20261025-no-meta-no-cards-no-boxes'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    t=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
report=read(OUT/'user-review-repair.json');delivery=read(OUT/'delivery.json');usability=read(OUT/'review/picture-usability.json');repair=read(ROOT/'V38-local-repair.json')
findings={
'V38':['原10.2/10.4和12.8–13.2秒两次纸面制作控制文字均被覆盖，完整9.416667–18.833333秒换为同军吏连续闭卷原镜头；未增加字卡、字幕、模糊或阴影层','材料交接仍在0–9.416667秒，26.166667秒之后苟安在伤帐中先睁眼后低头，保留存活留营；不挪用E3空铺','819帧和34.197秒容器时长保持，完整原AAC包哈希序列一致；声音只标记，不因画面修复改变原句或新合成'],
'V39':['0–5.1秒实际交接，2.5秒前景页角斜举掠过有原生运动失焦，无法辨读成句；不是工作文档卡、不是后期方框遮罩，不因此无故改片','5.1秒后为同场闭卷案头及军吏反应，纸面仅不可辨读纹理，未出现工作正文、字幕列表、制作编号或可见方框暗影','共同收件与之后Q分流边界保持，不把收件当作结案'],
'V40':['0–19.5秒伤帐问答/听者反应，19.5–41秒军吏处置消息及案头动作均未见字卡/字幕列表/方框糊块','约41秒之后才空铺，47.25秒后裸木底板空车经过；前段正式消息先于死亡后空铺的顺序保持','不改V42独立接入边界；未因本轮规则改动原来净片'],
'V41E':['前10.1秒军吏收卷，之后苟安问退军与低头反应；无烧入旁白正文、制作说明、人物名字幕或可见遮罩','前期裁幅去名仍为整幅构图裁切，画面没有可见方框模糊/暗影补丁；不能混称当前音轨已通过','保留早停查“不曾问出串通”的剧情映射，不改为已知李严线索的晚分支'],
'V41L':['0–8秒为军吏近景与中性闭卷桥接，8–25.4秒为军吏说明及前景甲衣手部；无制作卡、字幕列表或方框遮罩','25.4秒后军吏归拢闭卷，纸面未见可辨读制作控制文字；保留知道线索但细节不足，不伪造定罪/查全材料','现版本35.264秒播放完整，画面收在闭卷手部，不回用已停用旧R2/R3'],
'V43':['0–9.42秒实际离营，之后匿名士兵不安反应；全片无时间说明卡/散谣摘要卡/字幕列表/可见模糊暗影','军旗等场景纹样未被解释成可读案情证据或制作信息','实际放行在先，后果在后；赴魏与“后来”仍依既定画外叙事/游戏层，不新增画面文字'],
}
# Require saved current-run playback evidence for every final candidate before publishing policy marks.
for c in report['clips']:
    k=c['id'];is_new=k=='V38';final=Path(repair['newFile']) if is_new else Path(c['oldFile']);sha=hashlib.sha256(final.read_bytes()).hexdigest()
    assert sha==(repair['newSha256'] if is_new else c['oldSha256'])
    ended=ROOT/('V38-R3-playback-end.png' if is_new else k+'-playback-end.png');assert ended.is_file(),ended
    evidence=read(ROOT/('V38-R3-scan-evidence.json' if is_new else k+'-scan-evidence.json'))
    assert evidence['sha256']==sha
    for p in evidence['sheets']:assert Path(p).is_file()
    c.update(reviewPolicy=POLICY,reviewState='reviewed-new-standard',problemClassification='readable-meta-document-on-prop' if is_new else 'global-scan-no-hit',treatment='independent-local-continuous-source-recut' if is_new else 'no-hit-retain-user-review-file',newFile=str(final),newSha256=sha,mediaChanged=is_new,repairedRanges=[repair['replacedTimeRange']] if is_new else [],evidence=[dict(method='本轮IAB原生视频1倍静音从头播放至ended；不复用旧QA作新标准结论',file=str(final),sha256=sha,actualReviewedRanges=[[0,next(f['duration'] for f in delivery['films'] if f['id']==k)]],playbackEnd=str(ended)),dict(method=evidence.get('sampling','2fps ordered full-film auxiliary frames'),indexFile=str(ROOT/('V38-R3-scan-evidence.json' if is_new else k+'-scan-evidence.json')),sheets=evidence['sheets'])],findings=findings[k],visualUnresolved=[],unresolved=['声音仍未逐字听审；音色、错词、BGM及临时声口问题只保留标记，本轮不新增TTS'],userAudioOpinions=[],userComments=[],userApproved=False)
    for hit in c.get('hits',[]):hit.update(status='closed',newSha256=sha,repairRange=repair['replacedTimeRange'],evidence=str(ROOT/'V38-R3-scan-evidence.json'))
    if is_new:c['technicalEvidence']=repair
    f=next(f for f in delivery['films'] if f['id']==k)
    if is_new:
        f.update(path=str(final),sha256=sha,videoTrack=repair['videoTrack'],duration=repair['videoTrack']['containerDuration'],supersedes=dict(path=c['oldFile'],sha256=c['oldSha256'],reason='user-20261025-1549 two readable meta-paper flashes'),userReview='新版本待用户重审')
        f['adopted'][1]=dict(path=repair['newChild'],sha256=repair['newChildSha256'],pictureSource=repair['pictureSource'],sourceSha256=repair['sourceSha256'],sourceFrameRange=repair['sourceFrameRange'],duration=226/24,trim='continuous original picture; no static hold or loop',visualReview='当前父片新标准复核完成，两处纸面控制文字已去除',audioIssues=['原完整临时音轨保留；未听审，未新增TTS'])
    f.update(reviewPolicy=POLICY,newStandardReview=str(OUT/'user-review-repair.json'),userApproved=False)
    u=next(u for u in usability['clips'] if u['id']==k)
    if is_new:
        u['supersededReview']=dict(file=u['file'],sha256=u['sha256'],reason='new user rule found two readable meta-paper flashes')
        u.update(file=str(final),sha256=sha,technicalEvidence=repair['videoTrack'])
        u.setdefault('issues',[]).extend([dict(**h) for h in c['hits']])
    u.update(reviewPolicy=POLICY,reviewState='reviewed',newStandardReview=dict(report=str(OUT/'user-review-repair.json'),findings=findings[k],dynamicChecks=c['evidence']),userApproved=False)
oldr=next(c for c in report['clips'] if c['id']=='V38')
if not any(x['path']==oldr['oldFile'] for x in delivery.get('retiredVersions',[])):
    delivery.setdefault('retiredVersions',[]).append(dict(path=oldr['oldFile'],sha256=oldr['oldSha256'],reason='本轮两处可读制作说明纸面，已由去元文书R3替代；原片及用户评论保留'))
report.update(status='new-standard-visual-scan-complete-one-local-repair-five-unchanged',completedUTC=datetime.now(timezone.utc).isoformat(),reviewPolicy=POLICY,counts=dict(scanned=6,repaired=1,unchanged=5,openVisualIssues=0,pending=0),audioScope='G6无逐条声音评论，本轮只标记、不新增TTS、不做新音色或全组重配；未声称无BGM/无错词已听审通过',newVideoRequests=0,newTTSRequests=0,userApproved=False)
delivery.update(reviewPolicy=POLICY,userReviewRepair=str(OUT/'user-review-repair.json'),status='new-user-standard-picture-review-complete-audio-pending',userApproval=False)
usability.update(reviewPolicy=POLICY,status='current-sha-new-user-standard-reviewed-with-integration-conditions',updatedUTC=report['completedUTC'])
# Preserve prior records before atomically switching the current delivery pointer.
for p in [OUT/'delivery.json',OUT/'review/picture-usability.json']:
    dest=ROOT/('pre-user-standard-'+p.name)
    if not dest.exists():shutil.copy2(p,dest)
save(OUT/'user-review-repair.json',report);save(OUT/'review/picture-usability.json',usability)
ad=read(OUT/'review/visual-adopted.json');ad['V38-02']=next(f for f in delivery['films'] if f['id']=='V38')['adopted'][1];save(OUT/'review/visual-adopted.json',ad)
save(OUT/'delivery.json',delivery)
repair.update(reviewState='visual-and-technical-reviewed-adopted',reviewPolicy=POLICY);save(ROOT/'V38-local-repair.json',repair)
st=read(OUT/'status.json');st.update(phase=delivery['status'],reviewPolicy=POLICY,userReviewRepair=delivery['userReviewRepair']);save(OUT/'status.json',st)
gate=read(OUT/'dispatch-gate.json');gate.update(newPostEnabled=False,reviewPolicy=POLICY,reasonForNoNewGeneration='本轮仅一处本地连续原素材重剪，两次纸面闪现已同修，无新API/TTS');save(OUT/'dispatch-gate.json',gate)
p=OUT/'制作自查与交付.md';text=p.read_text(encoding='utf-8').replace(Path(oldr['oldFile']).as_posix(),Path(repair['newFile']).as_posix())
note='> 用户2026-10-25 15:49新标准优先：V38两次纸面制作说明已用独立去元文书R3修复；其他五片本轮重查无命中，保留SHA。无新增生成/TTS。所有影片仍待用户审核，声音未完成听审。\n\n'
text=text.replace('\n\n','\n\n'+note,1);p.write_text(text,encoding='utf-8')
html='<!doctype html><meta charset="utf-8"><title>G6用户新标准画面候选</title><style>body{font:18px system-ui;background:#161a1c;color:#eee;max-width:1100px;margin:auto}video{width:100%;max-height:650px}article{margin:35px 0}</style><h1>G6画面候选｜用户新标准复查后</h1><p>V38已修两处纸面制作说明，其他五片保留。声音未逐字听审，均待用户审核。</p>'
for f in delivery['films']:html+=f'<article><h2>{f["id"]} {f["name"]}</h2><video controls preload="metadata" src="{Path(f["path"]).relative_to(OUT).as_posix()}"></video></article>'
(OUT/'播放审阅.html').write_text(html,encoding='utf-8')
print(json.dumps(dict(counts=report['counts'],currentV38=repair['newFile'],sha256=repair['newSha256'],reviewPolicy=POLICY),ensure_ascii=False))
