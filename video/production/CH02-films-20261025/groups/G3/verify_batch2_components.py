from pathlib import Path
import json,hashlib,subprocess
O=Path(__file__).resolve().parent;R=O/'user-review-batch2'
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def expand(rec):
 c=dict(rec)
 for a,b in [('videoSource','videoSha256'),('audioSource','audioSha256')]:
  if c.get(a):assert sha(c[a])==c[b],c[a]
 if c.get('sources'):
  c['expandedSources']=[]
  for s,h in zip(c['sources'],c['sourceHashes']):
   assert sha(s)==h
   c['expandedSources'].append(expand(read(Path(s).with_suffix('.json'))['recipe']))
 return c
U=read(O/'user-review-batch2.json');D=read(O/'delivery.json');Q=read(O/'review/picture-usability.json')
for row in U['clips']:
 id=row['id']
 if row['newFile']:
  c=read(R/(id+'-candidate.json'));expanded=[expand(x) for x in c.get('sourceRecipes',[])]
  row['expandedSourceRecipes']=expanded
  if id=='V23':
   rest=c['audioRestoration'];assert sha(rest['file'])==rest['sha256'];row['pictureContinuity']='原视频流复制；原首帧PTS约0.041秒，417帧至17.416秒，无新增停帧。'
 else:
  c=read(R/'V25-available-components.json');results=[]
  for x in c['components']:
   assert sha(x['file'])==x['sha256'];expand(x)
   run=subprocess.run([FF,'-v','error','-i',x['file'],'-map','0:v:0','-an','-fps_mode','passthrough','-progress','pipe:1','-nostats','-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',check=True)
   pr=dict(y.split('=',1) for y in run.stdout.splitlines() if '=' in y);assert int(pr['frame'])==x['frames']
   results.append(dict(id=x['id'],sha256=x['sha256'],frames=int(pr['frame']),decode='passed',notWholeFilm=True))
  save(R/'V25-components-technical.json',dict(status='components-only-incomplete-do-not-adopt',components=results,wholeV25Adopted=False,missingNode='CH2-LY09-P02'))
  row['componentsTechnical']=str(R/'V25-components-technical.json')
for c in D['sourceCoverage']:
 c['actualDialogueVerification']='当前新版ASR辅助核对白名单完整原句；未实际逐字听审，角色音色/杂音/BGM/精确声口待审' if c['id']!='V25' else '旧片音轨存在缺句/误读；P02合成结果未知，未采用不完整新片。脚本覆盖不等于声音完整。'
for collection in (D['logicalClips'],Q['clips']):
 v=next(x for x in collection if x['id']=='V22');v['integrationConditions']=[v['integrationConditions'][0],'两个玩家问句从画外发出，当前窗口为5.000秒及2.208秒，保留自然听者画面。']
states=[]
for p in sorted((R/'audio').glob('*-state.json')):
 s=read(p);states.append({k:s.get(k) for k in ['id','node','text','status','model','requestId','referenceFile','referenceSha256','referenceUploadField','referenceUploaded','referenceBytes','file','sha256','httpStatus','listeningReview']})
assert len(states)==5
D['batch2AudioSynthesisRequests']=states
U['audioRequestStates']=states
save(O/'user-review-batch2.json',U);save(O/'delivery.json',D);save(O/'review/picture-usability.json',Q)
print('Recursive source hashes verified; seven V25 parts decode to exact planned frames; no incomplete V25 adopted.')
