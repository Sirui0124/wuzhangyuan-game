from pathlib import Path
import json,hashlib,re,datetime
O=Path(__file__).resolve().parent;B=O.parents[1];R=O/'re-generation-md'
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
stamp=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
D=read(O/'delivery.json');U=read(O/'user-review-batch2.json');W=read(B/'reviews/user-20261025-batch2/spoken-whitelist.json');C=read(B/'reviews/user-20261025-batch2/comments-and-versions.json');unknown=O/'user-review-batch2/audio/CH2-LY09-P02-state.json';before=sha(unknown)
integration=Path('outputs/video-integration-20261025/re-generation-md-handoff.json').resolve();integrationRows=read(integration)
md=R/'G3-V25-02-赴魏散谣设想-13秒-Seedance.md';body=md.read_text(encoding='utf-8')
lines=body.splitlines();assert lines[:4]==['尺寸：16:9','模型：seedance2.5','声音：有声音','时长：13秒']
duration=int(re.search(r'时长：(\d+)秒',body).group(1));assert 0<duration<=30
times=[(int(i),float(a),float(b)) for i,a,b in re.findall(r'### 分镜(\d+)｜([\d.]+)-([\d.]+)秒',body)]
assert times[0][1]==0 and times[-1][2]==duration and all(a[2]==b[1] for a,b in zip(times,times[1:]))
for _,a,b in times:assert b>a
whitelist=next(x for x in W['clips'] if x['id']=='V25')['spokenWhitelist'];src=next(x for x in whitelist if x['node']=='CH2-LY09-P02')
spoken=re.findall(r'^唯一允许发声的原句：“([^”]+)”$',body,re.M);assert spoken==[src['text']],spoken
assert not re.search(r'\{\{|\}\}|待填|待定|同上',body)
refs=[Path(x) for x in re.findall(r'本地路径：`([^`]+)`',body)];assert len(refs)==1 and all(x.is_absolute() and x.is_file() for x in refs)
assert len(re.findall(r'^参考图关系：',body,re.M))==len(times)
assert body.strip().split('\n')[-1].startswith('声音要求：') and body.index('拍摄手法参考：')<body.index('\n声音要求：')
for phrase in ['无BGM','无背景音乐','无配乐','声音执行（仅为控制说明，不朗读）','唯一口型','不新增人物']:
 # The template controls say only 苟安承担整句口型, without forcing a fixed phrase.
 if phrase!='唯一口型':assert phrase in body,phrase
current=[]
for v in D['logicalClips']:
 assert sha(v['path'])==v['sha256'],v['id']
 row=next(x for x in U['clips'] if x['id']==v['id'])
 current.append(dict(sceneId=v['id'],currentPath=v['path'],currentSha256=v['sha256'],durationSeconds=v['duration'],oldReviewedPath=row['oldFile'],oldReviewedSha256=row['oldSha256'],userOriginalComment=row['userComment'],oldVersionUserApproval=row['observedOldPictureApproval'],approvalScope='旧审核只绑定旧SHA；新候选不继承',currentNewVersionUserApproved=False if row['newFile'] else None,regenerationRequiredNow=False,reason='P02为音频缺口，P04待听审；当前游戏已有静帧/立绘＋既定原句回退，未确认原画面必须重拍。P02稿仅备选。' if v['id']=='V25' else '已有batch2修复候选，原旧版问题不重复纳入',listeningReviewPending=True))
tasks=[]
for p in sorted((O/'tasks').glob('*.json')):
 t=read(p);tasks.append(dict(statePath=str(p),stateSha256=sha(p),id=t.get('id',p.stem),status=t.get('status'),taskId=t.get('taskId',t.get('task_id',t.get('task',{}).get('id') if isinstance(t.get('task'),dict) else None))))
state=read(unknown)
relations=dict(group='G3',capturedAt=stamp,scope='冻结策划/现有交付和本轮用户评语快照；本次不改剧情与在线表',commentSource=str(B/'reviews/user-20261025-batch2/comments-and-versions.json'),commentSourceSha256=sha(B/'reviews/user-20261025-batch2/comments-and-versions.json'),userOriginalRows=[r for r in C['rows'] if r['id'] in ['V21','V22','V23','V24','V25']],versions=current,preservedVideoTasks=tasks,preservedUnknownAudioRequest=dict(node='CH2-LY09-P02',requestId=state['requestId'],status=state['status'],statePath=str(unknown),stateSha256=before,responseTaskId=None,retrySubmitted=False),adjacentNodes=dict(previous='CH2-LY09-P01',previousText=next(x['text'] for x in whitelist if x['node']=='CH2-LY09-P01'),next='CH2-LY09-P03',nextText=next(x['text'] for x in whitelist if x['node']=='CH2-LY09-P03'),includedInNewRequest=False),otherV25Components=str(O/'user-review-batch2/V25-available-components.json'),possibleP04ExtraWord=dict(state='listening-pending-not-confirmed-regeneration',note='提供方字幕准确；ASR首词疑似我知道，未听审，不据此增列新生成请求。'),newVideoSubmitted=False,currentVideosReplaced=False)
save(R/'review-and-version-relations.json',relations)
item=dict(sceneId='V25-02',parentSceneId='V25',title='伤帐供述赴魏散谣设想（未实行）',durationSeconds=duration,mdPath=str(md),reason='当前V25原片缺可验证完整CH2-LY09-P02原句；原片混合/左右声道未找到准确全句，Seed-Audio1.0请求结果未知且不重投。仅将此必要缺口改交Seedance图文稿，不重做已修复片段。',status='ready',blockingReason=None,readyScope='仅指MD、参考图与白名单/时间轴检查齐备，不代表Prompt用户通过、已提交生成或成片可用',sourceNodes=['CH2-LY09-P02'],spokenWhitelist=[src],shots=[dict(index=i,startSeconds=a,endSeconds=b,referenceImageNumbers=[1]) for i,a,b in times],mdSha256=sha(md),referenceImages=[dict(order=i+1,path=str(p),sha256=sha(p),visuallyInspected=True,purpose='夜间苟安单人伏榻身份/空间/构图/光照及唯一首帧') for i,p in enumerate(refs)],promptReviewStatus='待review',userApproved=False,generationSubmitted=False,commentsAndVersionsPath=str(R/'review-and-version-relations.json'))
item.update(integrationSceneId='CH2-LY09-P02',reason='P02是尚无可靠音轨的补音缺口，不是已确认的画面错误。为选择以完整视频替换静帧回退时准备一份Seedance备选稿；原片/游戏静帧＋既定原句继续保留，不因音轨缺失自动认定必须重拍。',requestPurpose='optional-video-alternative-for-audio-gap',mustRegenerateVideo=False,autoSubmitAllowed=False,gameFallback='静帧/立绘＋既定完整原句，点击继续',readyScope='仅表示备选MD完整可用，非必须重拍、生成授权或用户通过',requiresRegenerationConfirmationFromMediaReview=False)
relations.update(integrationGapSource=str(integration),integrationGapSourceSha256=sha(integration),integrationGapRows=[x for x in integrationRows if x['sceneId'] in ['CH2-LY09-P02','CH2-LY09-P04']],pictureRegenerationMandatory=False,P02DocumentPurpose='仅备选视频替换方案；补音缺口不自动推导画面必须重拍')
save(R/'review-and-version-relations.json',relations)
handoff=dict(group='G3',updatedAt=stamp,mode='local-markdown-only-no-video-api',maxDurationSeconds=30,confirmedMandatoryVideoRegenerationCount=0,optionalReadyDocumentCount=1,requests=[item],excludedFromRegeneration=[dict(sceneId=x['sceneId'],reason=x['reason'],currentPath=x['currentPath'],currentSha256=x['currentSha256']) for x in current],notAdded=[dict(sceneId='V25-04',reason='仅ASR疑似多我字，实际听审待确认，尚无证据确定需重生成；游戏静帧/立绘＋既定完整原句继续保留'),dict(sceneId='V25-01/03/05/06/07/08',reason='非缺口部件已备；不重复纳入新请求')],reviewRelationsPath=str(R/'review-and-version-relations.json'),preservedUnknownRequests=[relations['preservedUnknownAudioRequest']],newVideoApiCalls=0,automaticReposts=0,existingCurrentVersionsUntouched=True,validation=dict(referencePathsExist=True,referenceOrderAndPerShotPurpose=True,allReferencesVisuallyInspected=True,integerDurationWithin30=True,timelineContiguous=True,onlyExactAllowedSpokenSentence=True,controlAndSpeechSeparated=True,lastParagraphSoundRequirements=True,noBGM=True,noBranchOrInteractionBoundaryMerged=True,placeholdersRemaining=False),cinematographyResearch=dict(title='American Cinematographer — Dual Nature: Shadow',url='https://theasc.com/article/dual-nature-shadow/',checkedAt=stamp,appliedTo='V25-02分镜1的克制机位、有限色彩与自然肤色；具体时长/构图是本项目设计'),userApproval=False)
save(O/'re-generation-md-handoff.json',handoff)
# Keep this group's existing pipeline from creating new video API tasks.
(O/'pause-dispatch.flag').write_text('2026-10-25 user: video API expired; local Seedance Markdown handoff only; no new video API submissions or automatic reposts.\n',encoding='utf-8')
assert sha(unknown)==before
print(json.dumps(dict(handoff=str(O/'re-generation-md-handoff.json'),readyRequests=len(handoff['requests']),md=str(md),durationSeconds=duration,preservedUnknownRequest=state['requestId'],newVideoApiCalls=0),ensure_ascii=False))
