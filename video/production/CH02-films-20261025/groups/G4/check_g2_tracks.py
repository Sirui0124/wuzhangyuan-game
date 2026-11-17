"""Read-only G2 media-track audit; writes only its G4 report. No generation."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from datetime import datetime,timezone,timedelta
import av,json,hashlib,time,traceback,sys
O=Path(__file__).resolve().parent
G2=O.parent/'G2'
REPORT=O/'review/G2-track-assist.json'
TZ=timezone(timedelta(hours=8))
def now():return datetime.now(TZ).isoformat(timespec='seconds')
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def stamp(p):
 s=p.stat();return dict(bytes=s.st_size,mtimeNs=s.st_mtime_ns,modifiedAt=datetime.fromtimestamp(s.st_mtime,TZ).isoformat(timespec='seconds'))
def sec(n,tb):return float(n*tb) if n is not None else None

manifest=G2/'review/picture-repair-candidates.json'
livepath=G2/'review/picture-live-index.json'
md=read(manifest);mh=sha(manifest)
live=read(livepath);lh=sha(livepath)
selected=[];missing=[]
for c in md.get('clips',[]):
 p=Path(c['file']);selected.append(dict(id=c['id'],file=str(p),kind='current-indexed-assembled-candidate',expectedSha256=c.get('sha256'),selectedBy=str(manifest),metadataFileSha256=mh,declaredDuration=c.get('duration'),children=[dict(id=x['id'],file=x['file'],sha256=x.get('sha256')) for x in c.get('childrenFiles',[])]))
for j in sorted((G2/'edited/picture-review-presentable').glob('*.json')):
 d=read(j);p=Path(d['file'])
 if p.stem!=j.stem:raise RuntimeError('Same-name JSON mismatch: '+str(j))
 selected.append(dict(id=d['id'],file=str(p),kind='current-same-name-presentable-subclip',expectedSha256=d.get('sha256'),selectedBy=str(j),metadataFileSha256=sha(j),declaredDuration=d.get('duration')))
inventory=dict(assembledBaseDraftsExcluded=[str(p) for p in (G2/'assembled/picture-review-final').glob('V*.mp4') if '-' not in p.stem],parentManifest=str(manifest),parentManifestSha256=mh,liveIndex=str(livepath),liveIndexSha256=lh)
started=now()

def audit(item):
 r=dict(item);p=Path(item['file']);r['startedAt']=now()
 if not p.exists():r.update(result='missing-file',completedAt=now());return r
 before=stamp(p);actual=sha(p);r.update(before=before,sha256=actual,metadataShaMatches=actual==item['expectedSha256'])
 if not r['metadataShaMatches']:r.update(result='identity-mismatch-not-current-candidate',completedAt=now());return r
 try:
  with av.open(str(p)) as c:
   r['container']=dict(duration=sec(c.duration,1/av.time_base),startTime=sec(c.start_time,1/av.time_base),format=c.format.name)
   v=c.streams.video[0]
   r['videoMetadata']=dict(timeBase=str(v.time_base),duration=sec(v.duration,v.time_base),startTime=sec(v.start_time,v.time_base),declaredFrames=v.frames,averageRate=str(v.average_rate),baseRate=str(v.base_rate),resolution=[v.codec_context.width,v.codec_context.height])
   v.thread_type='AUTO'
   count=0;first=None;last=None;lastDur=None;prev=None;deltas=[];nonMono=0;missingPts=0;durationSet=set()
   for f in c.decode(v):
    count+=1
    if f.pts is None:missingPts+=1;continue
    t=sec(f.pts,f.time_base);dur=sec(f.duration,f.time_base) if getattr(f,'duration',0) else None
    if dur:durationSet.add(round(dur,9))
    if first is None:first=t
    if prev is not None:
     delta=t-prev;deltas.append(delta)
     if delta<=0:nonMono+=1
    prev=t;last=t;lastDur=dur
   inferredDur=lastDur or (float(1/v.average_rate) if v.average_rate else None)
   end=last+inferredDur if last is not None and inferredDur else None
   r['videoDecoded']=dict(actualFrameCount=count,firstPtsSeconds=first,lastPtsSeconds=last,lastFrameDurationSeconds=lastDur,lastFrameDurationInferred=lastDur is None,endSeconds=end,spanSeconds=end-first if end is not None else None,frameDurationValuesSeconds=sorted(durationSet),minPtsStep=min(deltas) if deltas else None,maxPtsStep=max(deltas) if deltas else None,nonMonotonicPtsCount=nonMono,missingPtsCount=missingPts,allPtsSteps24fps=bool(deltas) and all(abs(x-1/24)<1e-6 for x in deltas),actualRateFromPts=(count-1)/(last-first) if count>1 and last>first else None)
  with av.open(str(p)) as c:
   audio=[]
   for a in c.streams.audio:
    info=dict(index=a.index,timeBase=str(a.time_base),duration=sec(a.duration,a.time_base),startTime=sec(a.start_time,a.time_base),sampleRate=a.codec_context.sample_rate,channels=a.codec_context.channels)
    info['metadataEndSeconds']=(info['startTime'] or 0)+(info['duration'] or 0);audio.append(info)
  if audio:
   with av.open(str(p)) as c:
    a=c.streams.audio[0];afirst=None;alast=None;aend=None;acount=0;asamples=0
    for f in c.decode(a):
     acount+=1;asamples+=f.samples
     if f.pts is not None:
      t=sec(f.pts,f.time_base)
      if afirst is None:afirst=t
      alast=t;aend=t+f.samples/f.sample_rate
    audio[0]['decoded']=dict(frameCount=acount,samples=asamples,firstPtsSeconds=afirst,lastPtsSeconds=alast,endSeconds=aend,paddingNote='AAC decode can include trailing codec padding; compare metadata end separately, no listening conclusion.')
  r['audioStreams']=audio
  vEnd=r['videoDecoded']['endSeconds'];cEnd=(r['container']['startTime'] or 0)+(r['container']['duration'] or 0)
  aEnd=max((a['metadataEndSeconds'] for a in audio),default=0)
  cg=cEnd-vEnd;ag=aEnd-vEnd
  r['coverage']=dict(videoEndSeconds=vEnd,containerEndSeconds=cEnd,audioMetadataEndSeconds=aEnd,containerTailWithoutVideoSeconds=max(0,cg),audioTailWithoutVideoSeconds=max(0,ag),containerTailIn24fpsFrames=max(0,cg)*24,audioTailIn24fpsFrames=max(0,ag)*24,toleranceSeconds=1/24,interpretation='Only actual decoded-frame temporal coverage is checked. An uncovered tail is not a claim of visible black frames; players may hold the last frame. Audio content/listening and picture semantics are out of scope.')
  concerns=[]
  if cg>1/24+1e-6:concerns.append('video-ends-before-container-by-more-than-one-frame')
  if ag>1/24+1e-6:concerns.append('video-ends-before-audio-metadata-by-more-than-one-frame')
  if not r['videoDecoded']['allPtsSteps24fps']:concerns.append('decoded-pts-not-uniform-24fps')
  if nonMono or missingPts:concerns.append('nonmonotonic-or-missing-video-pts')
  r.update(concerns=concerns,result='actual-track-gap-or-timing-concern' if concerns else 'track-coverage-ok-within-one-video-frame')
 except Exception as e:r.update(result='inspection-error',error=str(e))
 r['after']=stamp(p);r['sha256After']=sha(p);r['fileStableDuringCheck']=r['before']==r['after'] and r['sha256']==r['sha256After']
 r['metadataStableDuringCheck']=sha(Path(item['selectedBy']))==item['metadataFileSha256']
 if not r['fileStableDuringCheck']:r['result']='changed-during-check-needs-new-snapshot'
 r['completedAt']=now();return r

rows=[]
if '--incremental' in sys.argv and REPORT.exists():
 prior=read(REPORT)
 cached={(x['kind'],x['file'],x.get('sha256')):x for x in prior['files'] if x.get('fileStableDuringCheck') and x.get('result')!='inspection-error'}
 remaining=[]
 for item in selected:
  key=(item['kind'],item['file'],item['expectedSha256']);old=cached.get(key);p=Path(item['file'])
  if old and stamp(p)==old['after'] and sha(p)==item['expectedSha256']:
   row=dict(old);row.update(item);row.update(metadataStableDuringCheck=sha(Path(item['selectedBy']))==item['metadataFileSha256'],identityRecheckedAt=now(),fullDecodeEvidenceReusedFrom=old['completedAt']);rows.append(row)
  else:remaining.append(item)
 selected=remaining
with ThreadPoolExecutor(max_workers=2) as pool:
 futures=[pool.submit(audit,x) for x in selected]
 for future in as_completed(futures):
  row=future.result();rows.append(row)
  v=row.get('videoDecoded',{});g=row.get('coverage',{})
  print(json.dumps(dict(kind=row['kind'],id=row['id'],result=row['result'],frames=v.get('actualFrameCount'),lastPts=v.get('lastPtsSeconds'),videoEnd=v.get('endSeconds'),containerTail=g.get('containerTailWithoutVideoSeconds')),ensure_ascii=False),flush=True)
rows.sort(key=lambda x:(x['kind'],x['id']))
current=read(manifest);currentIds={x['id']:(x['file'],x.get('sha256')) for x in current.get('clips',[])}
for row in rows:
 if row['kind']=='current-indexed-assembled-candidate':row['stillCurrentIndexAtCompletion']=currentIds.get(row['id'])==(row['file'],row['sha256'])
 else:
  d=read(Path(row['selectedBy']));row['stillCurrentIndexAtCompletion']=(d.get('file'),d.get('sha256'))==(row['file'],row['sha256'])
summary=dict(total=len(rows),assembled=sum(x['kind']=='current-indexed-assembled-candidate' for x in rows),presentableSubclips=sum(x['kind']=='current-same-name-presentable-subclip' for x in rows),actualConcerns=[dict(id=x['id'],file=x['file'],sha256=x['sha256'],kind=x['kind'],coverage=x.get('coverage'),result=x['result']) for x in rows if x['result']!='track-coverage-ok-within-one-video-frame'],supersededDuringAudit=[dict(id=x['id'],file=x['file'],sha256=x.get('sha256')) for x in rows if not x.get('stillCurrentIndexAtCompletion')])
report=dict(scope='G4 read-only independent G2 video-track audit. No semantic visual or audio approval; no generation; does not alter G2 files/manifests/delivery.',startedAt=started,completedAt=now(),timezone='Asia/Shanghai',method='PyAV libavformat metadata plus independent full sequential video decode counting every presented frame and PTS/duration; separate complete audio decode for codec-padding distinction. No OpenCV metadata frame-count shortcut. Incremental checks may reuse full-decode evidence only for identical SHA and file metadata, with a new identity check.',selection=inventory,parentManifestChangedDuringCheck=sha(manifest)!=mh,liveIndexChangedDuringCheck=sha(livepath)!=lh,summary=summary,files=rows,userApproved=False,newAPIRequests=0,newTTSRequests=0,writesToG2=False)
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(report=str(REPORT),summary=summary),ensure_ascii=False),flush=True)
