from pathlib import Path
import json,hashlib,uuid
from datetime import datetime,timezone
OUT=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    t=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
reportPath=OUT/'review/picture-usability.json';registered=read(reportPath)
save(OUT/'review/picture-usability-registration.json',registered)
delivery=read(OUT/'delivery.json');tracks={t['id']:t for t in read(OUT/'review/tracks-final.json')}
def e(*names):
    ps=[str(OUT/'review'/n) for n in names]
    assert all(Path(p).is_file() for p in ps),ps
    return ps
details={
'V38':dict(ranges=[[26,34.197]],evidence=e('usability-V38-alive.png','usability-V38-end.png','V38-01-contact.jpg'),findings=['26秒后同一苟安仍卧伤帐，先睁眼看向帐口再低头闭眼，保留存活反应；无空床和处死动作','收件时只见我的手/衣袖，军吏是被摄NPC，无可识别玩家脸；没有让苟安听到心声的回话动作'],conditions=['仅在停手署名已发生、个人材料提交被确认后接入；结论是留营候查，李严一节尚须核查','保留末镜睁眼到低头的连续反应，不仅截取闭眼末帧；不得套用E3死亡说明','我的CH2-E2-001现有4.183秒画外对白放在前段闭口听者/材料动作内，后段军吏发声画面只承载军吏回复；末镜心声不可由NPC口型承接'],issues=[dict(id='E2-EMPTY-BED',originalTime=[26,33.22],repair='R2末镜替换为同人存活反应，已重看当前SHA',status='closed')]),
'V39':dict(ranges=[[0,19.616],[2.4,7.92]],evidence=e('usability-V39-handover.png','usability-V39-profile-closed.png','final-six-playback.png'),findings=['共同收件材料交接成立，2.4–5.1秒裁幅保留军吏，前景无玩家鼻嘴胡子','5.1秒后采用同场闭卷案头；未见可读的伪造案情字句，纸面仅非可读纹理；无额外搬粮袋动作'],conditions=['只做V39共同收件，之后按已锁定Q进入V40或V41L，不把收件视为结案','我的原句由画外声承载，军吏回复另接；案头纸面不可作为可读证据进行放大解读'],issues=[dict(id='COMMON-RECEIPT-PROFILE-TEXT',originalTime=[2.4,10.13],repair='定点裁去前景侧脸并用无可读案情的同场案头替换后段，当前SHA复看',status='closed')]),
'V40':dict(ranges=[[31.5,55.296],[37,42.07]],evidence=e('usability-V40-no-player-face.png','usability-V40-face-safe.png','usability-V40-empty-cart-end.png','V40-05-face-safe-grid.jpg','final-six-playback.png'),findings=['31.5秒后军吏回案及发话画面不含玩家可识别侧脸；原6.2秒疑点已裁除','约41秒转入空铺，之后裸木底板空车从帐外经过并离开，没有满粮车或搬粮士兵','死亡用正式处置消息后接空铺表现，不在问话结束时提前死亡；V40-02闭口听者反应没有代说我的话'],conditions=['仅V39实际收件且Q真时进入；正式查办裁处消息须先于空铺','军吏两句裁处原文（李严革职、苟安已按军法处死）必须明确保留，空铺本身不能代替处死信息','我在伤帐的对白与末段三句心声使用既有正确画外声；空车段不混入其他分支声音','V42属于G5，须经原确认/继续边界再接，不在本片自动越过'],issues=[dict(id='E3-PLAYER-PROFILE',originalTime=[37.7,39.2],repair='V40-05前3秒同军吏正面替换、后段裁幅，当前R2复看无前景脸',status='closed'),dict(id='E3-LOADED-CART',originalTime=[47.25,55.3],repair='只保留裸木底板空车R2，当前55.296秒版本末段动态重看',status='closed')]),
'V41E':dict(ranges=[[0,26.91]],evidence=e('usability-V41E-narration-mouth-before.png','usability-V41E-R2-question.png','usability-V41E-R2-end.png','V41E-04-silent-reaction-R2-2fps.jpg'),findings=['新版先军吏接手材料、再苟安问退军、后闭口低头反应；未虚构玩家已查出串通细节','旧23–27秒明显说话口型已删，末镜只留原5.1–9.42秒反应；人物名烧字裁除','完整8.990秒既有旁白能放入16.8秒后约10秒闭口反应段'],conditions=['仅早停查提交确认后播放；旁白必须保留“他和李严究竟商量过什么，我始终没问出来”','BAD3完整既有旁白从约17.1秒开始，到26.1秒前结束；不得回用旧说话口型前段','只在苟安问“大军退了吗？”时保留他的发声/口型；两段旁白不能由他代说'],issues=[dict(id='EARLY-E4-NAME-CAPTION',originalTime=[16.8,26.1],repair='沿用裁后E03且新版完整播放未见人物名字幕',status='closed'),dict(id='E4-NARRATION-MOUTH',originalTime=[23,27],repair='新V41E-R2裁掉E04前5.1秒，完整新版动态及2fps复核',status='closed')]),
'V41L':dict(ranges=[[0,35.264]],evidence=e('usability-V41L-R4-foreground.png','usability-V41L-R4-close-scroll.png','V41L-03-face-edge-grid.jpg','V41L-04-silent-reaction-R4-2fps.jpg'),findings=['0–8秒沿用独立面部安全构图，中性闭卷桥接原前景过脸；17.4秒后前景只有甲衣腰部和手，未露玩家脸','军吏告知线索不能直接认定、先录苟安责任，画面没有呈现李严已定罪','末镜删去旧结尾接话口型，收在闭卷案头，未出现NPC听见心声后回应的动作','当前R4实际845帧、视频至35.208秒，末尾不是仅有音轨的黑尾；PTS合格仅作技术辅助，另已整段播放'],conditions=['必须接V39实际收件后的Q假分支；本片不能当早停查版本，须保留已知李严线索但细节对不上的两句军吏原文','CH2-E4-LATE-003既有7.409秒心声可从约25.8秒放入至33.2秒；只作画外心声，不给军吏配这句口型','末镜是归拢现有卷束，不能被UI解释成已经核实全部材料/李严定罪'],issues=[dict(id='LATE-E4-PLAYER-PROFILE',originalTime=[2.1,3.15],repair='沿用面部安全E01，当前R4整段复看关闭；非仅引用旧R3',status='closed'),dict(id='LATE-E4-TRUNCATED-VIDEO-TRACK',originalTime=[8.04,39.157],repair='停用旧R2；当前R4逐输入PTS归零后滤镜拼接，实际帧845及整段动态末帧均核验',status='closed'),dict(id='E4-NARRATION-MOUTH',originalTime=[35.5,39.083],repair='V41L-04仅采用0–9.8秒闭卷过程，删除末尾明显接话镜头；当前R4复看',status='closed')]),
'V43':dict(ranges=[[0,21.024]],evidence=e('usability-V43-release.png','final-six-playback.png','V43-01-contact.jpg','V43-02-contact.jpg'),findings=['苟安先从营路离开，后切军营中无名士兵不安反应；顺序是实际放行在前、之后的散谣后果在后','没有玩家脸，没有增加可读谣言内容；后段人物不被指认为玩家或李严','画面只承担放行和营中反应，赴魏与时间推进需要既定旁白明确连接'],conditions=['必须在UI-RELEASE确认后先完整显示苟安离路，之后才显示散谣后果','9.42秒切后段时保留“后来”的时间推进；使用既有CH2-E5-002旁白明确赴魏及谣言传回，不让匿名士兵代说旁白','不能从兵士反应自行派生新的谣言内容或提前呈现正式查办结果'],issues=[])
}
clips=[]
for f in delivery['films']:
    k=f['id'];x=details[k];p=Path(f['path']);sha=hashlib.sha256(p.read_bytes()).hexdigest();assert sha==f['sha256'];t=tracks[k];assert t['path']==f['path'] and t['fullVideoTrack']
    original=next(c for c in registered['clips'] if c['id']==k)
    prior=[]
    if k in ['V38','V39','V40','V43']:
        prior=[dict(sha256=sha,reviewedRange=[0,t['containerDuration']],method='此前当前SHA浏览器从头播放至结束；六宫格末态保留。此次单片重看关键疑点',evidence=str(OUT/'review/final-six-playback.png'))]
    clip=dict(id=k,name=f['name'],file=f['path'],sha256=sha,pictureUsability='usable-with-integration-condition',reviewState='reviewed',userApproved=False,dynamicChecks=[dict(method='IAB原生视频1倍播放，Range本地服务；直接播放当前文件。关键段复看，2fps/4fps抽帧仅辅助',actualReviewedRanges=x['ranges'],findings=x['findings'],evidence=x['evidence'])],priorSameShaDynamicEvidence=prior,issues=x['issues'],integrationConditions=x['conditions'],audioIssues=f['audioIssues'],technicalEvidence=t,preRepairRegisteredFile=original['file'],preRepairRegisteredSha256=original['sha256'])
    assert all(i['status']=='closed' for i in clip['issues']);clips.append(clip)
    f.update(pictureUsability=clip['pictureUsability'],reviewState='reviewed',integrationConditions=x['conditions'],pictureUsabilityReport=str(reportPath),userApproved=False,visualReview='当前SHA画面复核完成；有明确接入条件，非用户审核通过')
report=dict(group='G6',status='picture-review-complete-with-integration-conditions',updatedUTC=datetime.now(timezone.utc).isoformat(),clips=clips,counts={'usable':0,'usable-with-integration-condition':6,'needs-repair':0,'pending':0},newVideoRequestsThisReview=0,newTTSRequests=0,audioReview='未逐字听审；不以纯音频问题要求重拍',scope='G6源片；不修改ENDINGS目录或游戏。规划原句覆盖与实际声音审核分开。')
save(reportPath,report)
retired=[('V41E-早停查版：认下来的罪.mp4','旧旁白段含明显苟安说话口型，现用独立R2'),('V41L-晚支撑不足版：认下来的罪-R3.mp4','完整视频轨已修，但心声结尾有军吏接话口型，现用独立R4')]
for name,reason in retired:
    p=OUT/'assembled'/name
    if not any(r['path']==str(p) for r in delivery['retiredVersions']):delivery['retiredVersions'].append(dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),reason=reason))
delivery.update(status='picture-usable-with-integration-conditions-audio-pending',pictureUsabilityReport=str(reportPath),pictureUsabilityCounts=report['counts'],playbackEvidence=str(reportPath),unresolved=['六段接入条件见picture-usability.json；声音仍待统一与逐字听审','未获用户通过，未接入游戏'],updatedUTC=report['updatedUTC']);save(OUT/'delivery.json',delivery)
status=read(OUT/'status.json');status.update(phase=delivery['status'],pictureUsabilityCounts=report['counts'],newTTSRequests=0);save(OUT/'status.json',status)
md=OUT/'制作自查与交付.md';text=md.read_text(encoding='utf-8')
old='晚E4旧R2仅有约8秒真实画面而容器约39秒，已经停用。当前独立R3按输入先归零时间戳、统一帧率及尺寸后滤镜拼接；实际938帧，视频覆盖至39.083333秒，容器39.146秒。旧文件保留在原处，不列为当前采用。'
new='晚E4旧R2的视频轨缺失已修复；R3仍有心声结尾接话口型，本轮进一步裁为独立R4，收在闭卷动作。当前R4实际845帧，视频覆盖至35.208333秒，容器35.264秒。早E4也独立改为R2，删除旁白下的明显发声口型，当前26.910秒、644帧。旧片保留且停用。'
text=text.replace(old,new)
text+='\n## 当前SHA画面可用性验收\n\n六段均为 `usable-with-integration-condition`，0条待审、0条未关闭画面返修；这不是用户通过。完整字段与逐项证据见 [画面可用性报告](<'+reportPath.as_posix()+'>)。\n\n'
for c in clips:
    text+='- '+c['id']+'：'+ '；'.join(c['integrationConditions'])+'。\n'
md.write_text(text,encoding='utf-8')
print(json.dumps(dict(counts=report['counts'],changed=[dict(id=f['id'],file=f['path'],sha256=f['sha256'],duration=f['duration']) for f in delivery['films'] if f['id'] in ['V41E','V41L']]),ensure_ascii=False))
