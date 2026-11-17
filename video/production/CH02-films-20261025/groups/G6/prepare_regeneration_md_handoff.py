"""Read current adopted identities; do not restore retired clips or submit APIs."""
from pathlib import Path
import json,hashlib,datetime,uuid,collections
ROOT=Path(__file__).resolve().parent;BASE=ROOT.parents[1]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,v):
    tmp=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');tmp.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(p)
now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
delivery=read(ROOT/'delivery.json');repair=read(ROOT/'user-review-batch2.json')
latest=read(BASE/'deliveries/最新成片/manifest.json')
review=read(BASE/'reviews/saved/review-state.json')['records']
old_comments=read(BASE/'reviews/user-20261025-batch2/comments-and-versions.json')
template=BASE.parents[2]/'docs/video/SEEDANCE-PROMPT-TEMPLATE.md'
assert template.exists()
resolved={
'V38':'纸面制作文字已由去元文书R3处理，随后短版R1删除控制误读音画、重建三句白名单，保留苟安活着留营；不重复纳入旧纸面问题。',
'V39':'短版R1保留实际交材料与核收，删除控制误读音画、补回玩家原句；未出现新的已确认重生成缺口。',
'V40':'短版R2保留完整军法死讯和三句心声，删除标签型误读；R1孤立入座闪镜已在R2关闭，不能再列为待重生成。',
'V41E':'短版R1保留完整早停查旁白、苟安问句及反思，删除反应控制说明；不与晚E4互斥分支合并。',
'V41L':'短版R2仅一条句尾边界不稳对白以Seed-Audio1.0实际上传同军吏参考补齐，连续案头近景承载声音；心声完整保留。现为听审待核，不预设需要重生成视频。',
'V43':'短版R1删除放行动作误读，保留实际放行后再有后来旁白及后果；没有确认需新视频的缺口。'}
checked=[];versions=[]
for f in delivery['films']:
    fid=f['id'];r=next(x for x in repair['films'] if x['id']==fid);lib=next(x for x in latest['rows'] if x['id']==fid)
    actual=sha(f['path']);assert actual==f['sha256']==r['newSha256']==lib['sha256']
    librarySHA=sha(lib['libraryPath']);assert librarySHA==actual
    current=review.get(fid)
    # New G6 remarks require reassessment rather than a stale no-gap conclusion.
    if current and any(current.get(k) for k in ['note','comment','text']):raise RuntimeError('New G6 review remarks must be inspected: '+fid)
    checked.append(dict(sceneId=fid,title=f['name'],currentFile=f['path'],sha256=actual,currentDurationSeconds=f['duration'],libraryFile=lib['libraryPath'],librarySha256=librarySHA,requiresRegeneration=False,reason=resolved[fid],remaining='实际逐字听审、跨片音色、原声BGM与细口型待用户审核；不是已确认重生成需求',userApproved=f.get('userApproved',False)))
    versions.append(dict(sceneId=fid,currentFile=f['path'],currentSha256=actual,oldCommentAndVersion=next(x for x in old_comments['rows'] if x['id']==fid),latestSavedReviewRecord=current,supersedes=r['oldFile'],supersededSha256=r['oldSha256'],repairReport=str(ROOT/'user-review-batch2.json'),userApprovalNotInferred=True))
tasks=[];auxiliary=[]
for p in sorted((ROOT/'tasks').glob('*.json')):
    s=read(p)
    if 'status' not in s:
        auxiliary.append(dict(recordPath=str(p),recordSha256=sha(p),recordKind='auxiliary task metadata, not a separate generation task',preserved=True));continue
    tasks.append(dict(recordPath=str(p),recordSha256=sha(p),id=p.stem,taskId=s.get('task_id',s.get('taskId')),status=s.get('status'),preserved=True))
gate_path=ROOT/'dispatch-gate.json';gate=read(gate_path)
gate.setdefault('historicalHoldReasonBeforeApiExpiry',gate.get('holdReason'))
gate.update(newPostEnabled=False,holdReason='用户2026-10-25通知视频API过期；禁止新增视频POST及自动重投，后续必要重生成改交独立Seedance本地Markdown，单条不超过30秒',videoApiExpired=True,automaticResubmissionEnabled=False,maxFutureVideoRequestSeconds=30,futureGenerationDelivery='independent-local-seedance-markdown-only',policyUpdatedAt=now)
save(gate_path,gate)
snapshot=ROOT/'re-generation-review-and-versions.json'
save(snapshot,dict(group='G6',capturedAt=now,scope='user remarks and version relationship kept separate from generation Prompt',records=versions))
handoff=dict(group='G6',createdAt=now,status='no-confirmed-regeneration-gap',scope=['V38','V39','V40','V41E','V41L','V43'],summary='当前六片均已有实际修版且SHA与最新成片相符，未收到G6新返修意见；本轮没有需重生成的已确认条目，不为已修复旧问题重复写Prompt。',durationLimitSeconds=30,durationLimitIsMaximumNotTarget=True,videoAPISubmissionEnabled=False,automaticResubmissionEnabled=False,templatePath=str(template),templateSha256=sha(template),itemSchema=dict(sceneId='string',title='string',durationSeconds='positive integer <= 30',mdPath='absolute path to independent ready Prompt; null when blocked',reason='string',status='ready or blocked',blockingReason='null or concrete blocker'),items=[],counts=dict(ready=0,blocked=0,excludedAlreadyRepaired=6),excludedAlreadyRepaired=checked,pendingReviewDoesNotAuthorizeNewGeneration=True,reviewAndVersionSnapshot=str(snapshot),existingRepairExplanation=str(ROOT/'制作自查与交付.md'),existingRepairReport=str(ROOT/'user-review-batch2.json'),existingActualEDL=str(ROOT/'user-review-batch2/final-edl-and-sources.json'),taskRecordsPreserved=tasks,taskStatusCounts=dict(collections.Counter(t['status'] for t in tasks)),historicalTaskSummary=delivery.get('taskCounts'),noNewAPIRequestsThisTurn=True,noNewMarkdownPromptsBecauseNoConfirmedGap=True,userApproved=False)
handoff['auxiliaryTaskMetadataPreserved']=auxiliary
dest=ROOT/'re-generation-md-handoff.json';save(dest,handoff)
again=read(dest);assert not again['items'] and len(again['excludedAlreadyRepaired'])==6 and not read(gate_path)['newPostEnabled']
print(json.dumps(dict(handoff=str(dest),status=again['status'],counts=again['counts'],taskStatusCounts=again['taskStatusCounts'],currentAllSixSHAAndLibraryMatch=True,newAPIRequests=0),ensure_ascii=False,indent=2))
