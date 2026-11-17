"""G5 batch2: preserve dialogue whitelist, remove metadata speech and its excess pictures."""
from pathlib import Path
import sys,json,hashlib,subprocess,datetime,re,os
import numpy as np
OUT=Path(__file__).resolve().parent
WORK=OUT/'user-review-batch2';WORK.mkdir(exist_ok=True)
sys.path.insert(0,str(OUT))
from run_pipeline import FF,read,metadata
POLICY='20261025-batch2-clean-speech-and-duration'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,v):
 p=Path(p);t=p.with_name(p.name+'.pending');t.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n','utf-8');os.replace(t,p)
def init():
 for name in ['delivery.json','review/picture-usability.json','user-review-repair.json']:
  f=OUT/name;dst=WORK/('baseline-'+Path(name).name)
  if not dst.exists():dst.write_bytes(f.read_bytes())
def asr():
 from faster_whisper import WhisperModel
 init();model=None
 for c in read(WORK/'baseline-delivery.json')['assembled']:
  dst=WORK/'asr'/(c['id']+'-'+c['sha256'][:10]+'.json');dst.parent.mkdir(exist_ok=True)
  if dst.exists():continue
  assert sha(c['file'])==c['sha256']
  if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
  pcm=subprocess.run([str(FF),'-v','error','-i',c['file'],'-f','f32le','-ar','16000','-ac','1','pipe:1'],capture_output=True,check=True).stdout
  segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=True)
  rows=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,text=w.word) for w in s.words or []],avg_logprob=s.avg_logprob,no_speech_prob=s.no_speech_prob) for s in segs]
  value=dict(id=c['id'],file=c['file'],sha256=c['sha256'],duration=c['metadata']['duration'],segments=rows,text=''.join(x['text'] for x in rows),limitation='ASR only locates suspected speech; no actual listening, speaker/timbre/BGM approval.')
  save(dst,value);print(c['id'],value['text'],flush=True)

def recipes():
 base={s['id']:s for s in read(WORK/'baseline-delivery.json')['assembled']}
 voice=OUT.parent.parent/'voice'
 def part(id,start,end,why,audio=None,audioRange=None,delay=0,mute=False):
  return dict(source=base[id]['file'],sourceSHA=base[id]['sha256'],range=[round(start*24)/24,round(end*24)/24],reason=why,audio=str(audio) if audio else None,audioRange=audioRange,delay=delay,mute=mute)
 value={
 'V32A':[
  part('V32A',.5,6.625,'保留第一句完整玩家画外对白，独立既有WAV排除底片误读串音',audio=voice/'CH2-LY11-001.wav',delay=.15),
  part('V32A',8.25,9.75,'只保留“那就把纸铺开”，删前后角色/拍摄说明'),
  part('V32A',13.5,18.125,'保留“你救不了…保得住我”完整原句，删此前误读'),
  part('V32A',20.083333,24.791667,'完整保留玩家提问，既有独立WAV，闭口听者不代说',audio=voice/'CH2-LY11-018.wav',delay=.2),
  part('V32A',28.625,32.291667,'保留愿意留下/不赴魏不散谣，删前后导演说明误读'),
  part('V32A',33.625,43.708333,'保留必要连续书写、横划、下方署写、提笔；空台词白名单')],
 'V33':[part('V33',.75,9.125,'完整递件接触→我松手→信收入袋；只保留传信人的唯一原话，不因话前有真动作而删掉交接',audioRange=[3.5,6.65],delay=2.75)],
 'V34':[
  part('V34',0,1.5,'保留李严先读完来信的真实必要动作；此时底音误读编号，清除该人声后即切入质疑原句',mute=True),
  part('V34',4.458333,10.125,'仅李严“我只怕…靠什么撑住”原句，删除编号/角色/口型/导演说明'),
  part('V34',18.041667,26.166667,'保留蜀魏休兵判断和撤回投魏计划两句；移除话前无效等待'),
  part('V34',30.208333,31.541667,'同一李严原声保留“粮情如实报”'),
  part('V34',34.791667,36.083333,'同一李严原声保留“我愿受责”，中间错误复述/乱码连同画面删去'),
  part('V34',36.166667,44,'无台词写、提笔、取件、交出与接触；原底音误念演出说明，清除人声而保留实际动作',mute=True)],
 'V35':[
  part('V35',.833333,6.125,'台词白名单为空；清除误借V33的全部人声，缩短取件前和松手后退远，完整取件/接触/松手保留',mute=True),
  part('V35',8.208333,16.208333,'连续展开回信、两附件落桌并逐一松手；不朗读纸面内容')],
 'V36':[
  part('V36',0,6,'玩家完整原句用既有独立WAV，实际收件/松手动作保留',audio=voice/'CH2-LY12B-010.wav',delay=.1),
  part('V36',12,19.75,'军吏实际收齐材料/核实责任的完整对白；删“先收齐才谈核实”动作说明误读及因此拖长画面'),
  part('V36',24.541667,29.791667,'保留李严处分原句，删其前裁处导演说明误读'),
  part('V36',30.625,37.75,'保留苟安免队长/责任/做粮兵原句'),
  part('V36',42.833333,50.333333,'保留考虑停手补救但仍担责完整原句，删话前冗余反应'),
  part('V36',50.5,54.166667,'回令接触与接过完整动作，空台词白名单，清除演出说明误读',mute=True)],
 'V37':[], 'V42':[]}
 save(WORK/'edit-recipes.json',dict(policy=POLICY,slots=value,newVideoRequests=0,newAudioRequests=0,newTTS=0,sourceWhitelists=str((OUT/'plan.json').resolve()),listening='pending; no listening claim'))
 print('Recipes saved, no dispatch')

def render():
 init();base={s['id']:s for s in read(WORK/'baseline-delivery.json')['assembled']}
 rec=read(WORK/'edit-recipes.json')['slots'];folder=WORK/'assembled';folder.mkdir(exist_ok=True);result=[]
 for id,parts in rec.items():
  old=base[id]
  if not parts:
   result.append(dict(id=id,file=old['file'],sha256=old['sha256'],metadata=old['metadata'],unchanged=True,parts=[],userApproved=False));continue
  version=hashlib.sha256(json.dumps(parts,sort_keys=True).encode()).hexdigest()[:10];dest=folder/f'{id}-clean-speech-{version}.mp4'
  inputs=['-i',old['file']];filters=[];vs=[];ags=[];cursor=0;timeline=[]
  for n,p in enumerate(parts):
   assert sha(p['source'])==p['sourceSHA']
   a,b=p['range'];duration=b-a
   filters.append(f'[0:v]trim=start_frame={round(a*24)}:end_frame={round(b*24)},setpts=PTS-STARTPTS,setsar=1[v{n}]');vs.append(f'[v{n}]')
   if p['mute']:filters.append(f'anullsrc=r=48000:cl=stereo,atrim=duration={duration}[a{n}]')
   else:
    if p['audio']:
     idx=len(inputs)//2;inputs+=['-i',p['audio']];audio=f'[{idx}:a]asetpts=PTS-STARTPTS'
    else:
     aa,bb=p['audioRange'] or [a,b];audio=f'[0:a]atrim=start={aa}:end={bb},asetpts=PTS-STARTPTS'
    filters.append(audio+f',afade=t=in:st=0:d=0.008,adelay={round(p["delay"]*1000)}:all=1,apad,atrim=duration={duration},afade=t=out:st={max(0,duration-.008)}:d=0.008,aformat=sample_rates=48000:channel_layouts=stereo[a{n}]')
   ags.append(f'[a{n}]');timeline.append(dict(**p,timelineRange=[cursor,cursor+duration]));cursor+=duration
  filters.append(''.join(vs)+f'concat=n={len(vs)}:v=1:a=0[v]')
  filters.append(''.join(ags)+f'concat=n={len(ags)}:v=0:a=1[a]')
  if not dest.exists():
   pending=dest.with_name(dest.stem+'.pending.mp4')
   subprocess.run([str(FF),'-v','error','-y']+inputs+['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-r','24','-fps_mode','cfr','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',str(pending)],check=True)
   subprocess.run([str(FF),'-v','error','-i',str(pending),'-f','null','NUL'],check=True);os.replace(pending,dest)
  row=dict(id=id,file=str(dest.resolve()),sha256=sha(dest),metadata=metadata(dest),parts=timeline,reviewState='pending',userApproved=False,audioApproved=False)
  result.append(row);print(id,row['metadata']['duration'],row['sha256'],flush=True)
 save(WORK/'candidates.json',dict(policy=POLICY,clips=result,newAudioRequests=0,newVideoRequests=0,newTTS=0))

def finalasr():
 from faster_whisper import WhisperModel
 model=None
 for c in read(WORK/'candidates.json')['clips']:
  dst=WORK/'final-asr'/(c['id']+'-'+c['sha256'][:10]+'.json');dst.parent.mkdir(exist_ok=True)
  if dst.exists():continue
  if c.get('unchanged'):
   prior=read(WORK/'asr'/(c['id']+'-'+c['sha256'][:10]+'.json'));save(dst,prior);continue
  if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
  pcm=subprocess.run([str(FF),'-v','error','-i',c['file'],'-f','f32le','-ar','16000','-ac','1','pipe:1'],capture_output=True,check=True).stdout
  segs,_=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=True)
  rows=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,text=w.word) for w in s.words or []]) for s in segs]
  r=dict(id=c['id'],file=c['file'],sha256=c['sha256'],segments=rows,text=''.join(s['text'] for s in rows),limitation='ASR auxiliary only; speaker/timbre/no-BGM/listening remain pending')
  save(dst,r);print(c['id'],r['text'],flush=True)

def audit():
 import user_review_repairs as prior
 prior.WORK=WORK;prior.POLICY=POLICY;prior.audit()
 rows=[]
 previous={x['id']:x for x in read(OUT/'user-review-20261025/technical-checks.json')['clips']}
 cached={x['id']:x for x in read(WORK/'technical-checks.json')['clips']} if (WORK/'technical-checks.json').exists() else {}
 for c in read(WORK/'candidates.json')['clips']:
  assert sha(c['file'])==c['sha256']
  if c['id'] in cached and cached[c['id']]['sha256']==c['sha256']:
   row=cached[c['id']]
  elif c.get('unchanged'):
   assert previous[c['id']]['sha256']==c['sha256']
   row={**previous[c['id']],'unchangedSameSHAExistingTechnicalCheck':True}
  else:
   r=subprocess.run([str(FF),'-v','info','-i',c['file'],'-vf','blackdetect=d=0.08:pix_th=0.08','-f','null','NUL'],capture_output=True,text=True,check=True)
   row=dict(id=c['id'],file=c['file'],sha256=c['sha256'],decode='passed',blackDetection=[x for x in r.stderr.splitlines() if 'black_start:' in x],size=c['metadata']['size'],duration=c['metadata']['duration'],CFR24=True,audio48kStereo=True)
  rows.append(row)
 save(WORK/'technical-checks.json',dict(policy=POLICY,clips=rows,limitation='No technical check establishes actual listening, correct timbre, lip sync or no music.'))
 h=(OUT/'user-review-20261025/review.html').read_text('utf-8')
 data=[dict(id=c['id'],src=os.path.relpath(c['file'],WORK).replace('\\','/'),sha256=c['sha256']) for c in read(WORK/'candidates.json')['clips']]
 h=re.sub(r'const clips=\[.*?\];let idx',lambda _: 'const clips='+json.dumps(data,ensure_ascii=False)+';let idx',h,flags=re.S)
 h=h.replace('G5 无文字卡／无方框补丁版','G5 第二批：删误读与冗余音画').replace('原音保留，声音未逐字听审。','仅允许白名单原句；声音未逐字听审。')
 (WORK/'review.html').write_text(h,'utf-8')
 print('Current-SHA audit sheets, technical checks and batch2 review page ready.')

if __name__=='__main__':globals()[sys.argv[1]]()
