"""G4 batch2 audio/text/duration audit; ASR is not listening approval."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import json,hashlib,subprocess,sys,os
import numpy as np
O=Path(__file__).resolve().parent;B=O.parents[1];W=O/'user-review-batch2';W.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,d):
 p.parent.mkdir(parents=True,exist_ok=True);t=p.with_name(p.name+'.tmp');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(t,p)
def now():return datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds')
def init():
 for rel in ['delivery.json','review/picture-usability.json','user-review-repair.json']:
  p=O/rel;d=W/('baseline-'+Path(rel).name)
  if not d.exists():d.write_bytes(p.read_bytes())
 comments=read(B/'reviews/user-20261025-batch2/comments-and-versions.json');cm={x['id']:x for x in comments['rows']};plan=read(O/'plan.json')
 if not (O/'user-review-batch2.json').exists():
  rows=[]
  for c in read(W/'baseline-delivery.json')['clips']:
   assert sha(c['file'])==c['technical']['sha256']
   cs=[x for x in plan['clips'] if x['slot']==c['id']]
   rows.append(dict(id=c['id'],oldFile=c['file'],oldSha256=c['technical']['sha256'],oldDuration=c['technical']['duration'],userComment=cm[c['id']]['note'],userReviewed=bool(cm[c['id']]['note']) or cm[c['id']]['approved'],observedUserApproved=cm[c['id']]['approved'],sourceWhitelist=[dict(id=x['id'],lines=x['lines'],silent=x['silent'],existingPlayerVoice=x['audioOverlay']) for x in cs],status='audio-text-duration-audit-pending',listeningReview='pending; execution tools cannot provide actual audio listening',userApproved=False))
  save(O/'user-review-batch2.json',dict(group='G4',policy=read(B/'reviews/user-20261025-batch2/repair-policy.json'),createdAt=now(),clips=rows,status='in-progress-not-complete',userApproved=False))
def asr(use_candidates=False):
 from faster_whisper import WhisperModel
 init();model=None
 for c in read(W/('candidates.json' if use_candidates else 'baseline-delivery.json'))['clips']:
  dst=W/('asr-new' if use_candidates else 'asr')/(c['id']+'-'+c['technical']['sha256'][:10]+'.json')
  if dst.exists():continue
  assert sha(c['file'])==c['technical']['sha256']
  if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=2,local_files_only=True)
  pcm=subprocess.run([FF,'-v','error','-i',c['file'],'-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],capture_output=True,check=True).stdout
  segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
  rows=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,text=w.word,probability=w.probability) for w in s.words or []],avgLogprob=s.avg_logprob,noSpeechProb=s.no_speech_prob) for s in segs]
  save(dst,dict(id=c['id'],file=c['file'],sha256=c['technical']['sha256'],segments=rows,text=''.join(s['text'] for s in rows),scope='ASR locator, not listening or timbre/BGM/ownership approval',createdAt=now()))
  print(json.dumps(dict(id=c['id'],segments=[dict(start=x['start'],end=x['end'],text=x['text']) for x in rows]),ensure_ascii=False),flush=True)
def asr_new():asr(True)
if __name__=='__main__':globals()[sys.argv[1]]()
