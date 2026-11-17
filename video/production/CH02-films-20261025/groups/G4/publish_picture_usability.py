"""Publish only after the independent v2 playback/visual review has finished."""
from pathlib import Path
import json,hashlib,os,time,subprocess,re
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def atomic(p,d):
 t=p.with_name(p.name+'.tmp');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(t,p)
now=time.strftime('%Y-%m-%d %H:%M:%S')
assert (OUT/'review/usability/picture-v2-complete.png').exists(),'No new playback end-state evidence'
assert (OUT/'review/usability/unchanged-complete.png').exists()
original=read(OUT/'review/usability-v1-snapshot.json')
delivery=read(OUT/'delivery.json')
assert [(x['id'],x['file'],x['technical']['sha256']) for x in delivery['clips']]==[(x['id'],x['file'],x['technical']['sha256']) for x in original['clips']], 'Current delivery changed concurrently'
new=read(OUT/'review/picture-v2-candidates.json');newmap={x['id']:x for x in new['clips']}
plan=read(OUT/'plan.json');oldmap={x['id']:x for x in original['clips']}
oldsub={x['id']:x for x in original['subclips']};newsub={x['id']:x for x in new['subclips']}
audit=read(OUT/'review/picture-usability.json');amap={x['id']:x for x in audit['clips']}

observations={
'V26':'玩家句用同场闭口/无口部案头；核收的是闭合卷束，未展开、落印或提前正式交案。转运简报为冻结原句的准确透视字层，纸页无其他可读伪证据；其余军吏句保持军吏发言。',
'V27':'已删除两段玩家句期间的额外说话表演，全部玩家句采用足长闭口段；开头只是掀帐帘，未拍玩家背脸。苟安自己的两句仍在独立说话段，无新增递纸或离帐动作。',
'V28A':'玩家句完整落在严格闭口听者段，苟安到自己的答句才开口；无新增接受补救或证物交接。',
'V28B':'玩家句完整落在严格闭口听者段，苟安到自己的答句才开口。背景营中人员经过不承担剧情，不新增押解/逃跑。',
'V28C':'玩家保密承诺的画面已换为闭口倾听；苟安自己的答句完整保留，没有由他代说玩家承诺，也未新增接受最终方案的动作。',
'V29':'玩家咨询改为无字案头，不露军吏口部或空椅全貌，不伪造递件、落印或交案。军吏四句风险说明完整保留，末段心声只看案头和无动作躯干，NPC没有对心声作反应。',
'V30':'只有苟安提出第二次定制交谈的问题，没有代说玩家回答；结束仍在伤帐，未抢先进入选择结果。',
'L02':'0至末帧始终闭口倾听，没有固定玩家台词、点头接受或提前结果表演。镜头缓慢推进，首尾构图不相同，属于单次底片，非无缝循环。',
'V31T':'苟安自己的短回应；无新证物、离床、押解或逃跑，后续选择边界保留。',
'V31D':'苟安自己的短回应；没有把玩家护人意图拍成实际压案或补救已经完成。',
'V31R':'苟安自己的质疑回应；没有凭空生成凭据或接收材料。',
'V31A':'苟安自己的回应，画面未署名/收件/实施补救；不冒作最终补救已接受。',
'V31N':'苟安自己的中性回应；没有新增承诺、立场或行动结果。',
'V32R':'苟安自己的拒绝回应；未新增逃跑、押解或死亡，后续回到补选的边界独立。'}
condition=[
 '仅在玩家确认本次原话后，以CH2-O2-INPUT.confirmedText为动态声音来源，在已确认原话的播放及等待判定阶段单播；输入界面不播回应。',
 '播放结束后保持真实末帧，或切到随交付提供的L02-last-frame.png；不得跳黑、自动循环、倒放、从头反复重播，也不得按本片时长自动推进流程。',
 '已确认原话播放结束且取得判定/回应后，才进入相应V31；等待期间保持末帧。这是一项接入条件，本轮未改游戏程序或声称完成游戏内验证。'
]
auditclips=[];published=[]
for old in original['clips']:
 cid=old['id'];c=dict(newmap.get(cid,old));file=Path(c['file']);actual=sha(file)
 assert actual==c['technical']['sha256']
 s=subprocess.run([FF,'-hide_banner','-i',str(file)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
 fps=float(re.search(r'(\d+(?:\.\d+)?) fps',s)[1]);hz=int(re.search(r'Audio:.*?(\d{4,6}) Hz',s)[1]);assert fps==24 and hz==48000 and '1280x720' in s
 c['technical'].update(audioTrack=True,fps=fps,sampleRate=hz)
 a=amap[cid];a.update(file=str(file),sha256=actual,reviewState='complete',pictureUsability='usable-with-integration-condition' if cid=='L02' else 'usable',userApproved=False,observations=observations[cid],integrationConditions=condition if cid=='L02' else [],audioIssues=['声音留后续统一：未完成逐字原声听审、音色与BGM检查，不能宣称声音已通过。']+c.get('audioIssues',[]))
 proof='review/usability/picture-v2-complete.png' if cid in newmap else 'review/usability/unchanged-complete.png'
 a['dynamicChecks'].append(dict(method='独立历史的本地浏览器原速从头到尾播放；结合时间序列画面检查角色、动作、物权、文字及切点，非仅技术解码',file=str(file),sha256=actual,reviewedRanges=[[0,c['technical']['duration']]],evidence=proof,reviewPage='review-picture-v2.html' if cid in newmap else 'review-picture-unchanged.html'))
 if cid in newmap:
  a['dynamicChecks'].append(dict(method='新版每1秒时序帧及末帧人工视觉复核，关键玩家段确认闭口/无口部；不能用采样代替上一项动态证据',evidence=f'review/usability/picture-v2/{cid}-timeline.jpg',manifest='review/usability/picture-v2/manifest.json',sha256=actual))
  a['previousFile']=old['file'];a['previousSha256']=old['technical']['sha256']
  for issue in a['issues']:
   issue.update(status='repaired-and-rechecked',originalFile=old['file'],originalSha256=old['technical']['sha256'],repairFile=str(file),repairSha256=actual,recheckEvidence=proof)
  a['localRepairs']=[dict(subclip=x['id'],file=x['file'],sha256=x['technical']['sha256'],source=x['source'],sourceSha256=x['sourceSha256'],trim=x['trim'],speed=x['speed'],crop=x['crop'],voiceDuration=x['centralVoiceDuration'],voiceOffset=x['voiceOffset']) for x in new['subclips'] if x['slot']==cid]
  a['repairNotes']='同场有效段均匀调整速度，原文件保留，完整冻结原句复用已有中央音轨；未循环、倒放或新增生成/TTS。V27-02/V28A-01/V28B-01还预防性收紧旧听者段尾部轻微开口，不当作已确认连续代说。'
 else:
  a['previousEvidenceReused']=['review/assembled-playback-complete.png','review/visual-audio-review.json'];a['sameFileHashVerifiedAgainstOriginalDelivery']=True
 if cid=='V26':a['additionalEvidence']=['review/document-overlay-placement.json','review/V26-08-R2/decision.json']
 if cid=='L02':a['holdFrame']=str(OUT/'review/usability/L02-last-frame.png');a['holdFrameSha256']=sha(a['holdFrame']);a['gameIntegrationVerified']=False
 c.update(pictureUsability=a['pictureUsability'],integrationConditions=a['integrationConditions'],userApproved=False,visualReview=dict(status='画面制作自查完成；用户待review',report=str(OUT/'review/picture-usability.json'),sha256=actual),audioIssues=a['audioIssues'])
 auditclips.append(a);published.append(c)
audit.update(updated=now,stage='画面可用性制作复查完成：13可用，1需接入条件；声音待统一，用户未审核',clips=auditclips,summary=dict(total=14,usable=13,usableWithIntegrationCondition=1,needsRepair=0,pending=0,locallyRevisedSlots=5,locallyRevisedSubclips=7,newAPIRequests=0,newTTSRequests=0),userApproved=False)
atomic(OUT/'review/picture-usability.json',audit)
delivery.update(clips=published,slots=published,status='14槽画面制作复查完成：13可用，L02需接入条件；声音待统一，用户待review',pictureUsability=dict(report=str(OUT/'review/picture-usability.json'),usable=13,usableWithIntegrationCondition=1,needsRepair=0,pending=0),unresolved=['声音未完成逐字原声听审，留后续统一；画面制作自查不等于用户审核通过','L02仅在确认本次原话后的播放及等待判定阶段单播，结束保持真实末帧，取得判定/回应才进入相应V31；输入界面不播回应，不自动循环或推进，未验证游戏内接入'],updated=now,userApproved=False)
delivery['subclips']=[newsub.get(x['id'],x) for x in original['subclips']]
atomic(OUT/'delivery.json',delivery)
status=read(OUT/'status.json');status.update(stage=delivery['status'],pictureUsability=delivery['pictureUsability'],newTTSRequests=0,active=0,userApproved=False,updated=now);atomic(OUT/'status.json',status)
selection=read(OUT/'review/selection.json')
for x in new['subclips']:
 selection[x['id']]=dict(source=x['source'],start=x['trim']['start'],end=x['trim']['end'],speed=x['speed'],crop=x['crop'],review='picture-v2已动态复核，见picture-usability.json；原版保留。后续不得用旧postprocess脚本覆盖版本文件。',adoptedVersionFile=x['file'])
atomic(OUT/'review/selection.json',selection)
lines=['# G4 画面交付索引','',f'更新：{now}。14槽：13画面可用；L02满足下列接入条件后可用。声音待后续统一，userApproved=false。','', '本轮纯本地修复7个子段、更新5个完整槽位；新增API请求0，新增TTS请求0。旧成片均保留。','',f'[逐段画面可用性报告]({(OUT/"review/picture-usability.json").as_posix()})','', '| 槽位 | 画面结论 | 当前文件 | 时长 |','|---|---|---|---:|']
for c in published:lines.append(f'| {c["id"]} | {"有接入条件" if c["id"]=="L02" else "画面可用"} | [{Path(c["file"]).name}]({Path(c["file"]).as_posix()}) | {c["technical"]["duration"]:.2f}秒 |')
lines+=['','## L02接入条件','']+['- '+x for x in condition]+['',f'[L02真实末帧]({(OUT/"review/usability/L02-last-frame.png").as_posix()})','','本轮仅修改本组源片和交付记录；未修改游戏、结局合辑、其他组、在线文档或自动化。']
(OUT/'交付索引.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps(dict(published=14,revised=list(newmap),seconds=round(sum(c['technical']['duration'] for c in published),2),summary=audit['summary']),ensure_ascii=False))
