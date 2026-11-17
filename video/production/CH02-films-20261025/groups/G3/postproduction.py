from pathlib import Path
import json,subprocess,hashlib,wave,re
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1]
if (OUT/'delivery.json').exists() and json.loads((OUT/'delivery.json').read_text(encoding='utf-8-sig')).get('pictureAcceptanceVersion'):
 raise SystemExit('当前已发布独立画面修复版本；旧后期入口停止，避免覆盖或回指旧画面。请使用当前修复版本流程。')
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
def duration(path):
 s=subprocess.run([FF,'-hide_banner','-i',str(path)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
 m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',s);return int(m[1])*3600+int(m[2])*60+float(m[3])
def dissolve(a,b,out):
 hashes=[hashlib.sha256(Path(x).read_bytes()).hexdigest() for x in [a,b]];receipt=out.with_suffix('.json')
 if out.exists() and receipt.exists() and read(receipt).get('hashes')==hashes:return str(out)
 offset=round(duration(a)-.4,4)
 filt=f'[0:v]fps=24,settb=AVTB[v0];[1:v]fps=24,settb=AVTB[v1];[v0][v1]xfade=transition=fade:duration=0.4:offset={offset}[v];[0:a][1:a]acrossfade=d=0.4[a]'
 subprocess.run([FF,'-v','error','-y','-i',str(a),'-i',str(b),'-filter_complex_threads','1','-filter_complex',filt,'-map','[v]','-map','[a]','-r','24','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart',str(out)],check=True)
 write(receipt,dict(sources=[str(a),str(b)],hashes=hashes,duration=.4,offset=offset,reason='明确口述回忆首尾；原声仍待统一配音'))
 return str(out)
P=read(OUT/'plan.json'); voices=read(BASE/'voice/manifest.json').get('rows',{})
decisions=read(OUT/'review/decisions.json') if (OUT/'review/decisions.json').exists() else {}
files={};details=[]
for c in P['clips']:
 id=c['id'];tech=OUT/'generated'/f'{id}-technical.json'
 for rev in reversed(P.get('revisions',[])):
  if rev.get('revisionOf')==id and (OUT/'generated'/f"{rev['id']}-technical.json").exists():tech=OUT/'generated'/f"{rev['id']}-technical.json";break
 if not tech.exists():continue
 t=read(tech);src=Path(decisions.get(id,{}).get('adoptPath',t['file']))
 dest=src
 asrp=OUT/'review'/f'{id}-asr.json';asr=read(asrp) if asrp.exists() else {}
 audio_issues=list(decisions.get(id,{}).get('audioIssues',[]))
 if c.get('audioMode')=='guide_only_for_later_dubbing':audio_issues.append('本片原声不承担正式台词，需统一配音；口型仅待后续核对，不声称已对齐')
 if asr.get('unexpectedSpeech'):audio_issues.append('原片含未指定人声；保留画面，统一配音阶段处理')
 if c.get('postVoiceOnly') and not asrp.exists():audio_issues.append('原片未核人声，暂不叠加中央玩家音轨，留统一配音')
 if c.get('postVoiceOnly') and asrp.exists() and not decisions.get(id,{}).get('skipCentralVoice') and not asr.get('unexpectedSpeech'):
  ls=[l for l in c['sourceLines'] if l['spoken']]
  if not all(voices.get(l['node'],{}).get('ready') for l in ls):
   files[id]=str(src);details.append(dict(id=id,logicalId=c['logicalId'],file=str(src),technical=t,review=decisions.get(id,{}),audioIssues=['待统一配音，当前不等待缺失音轨']));continue
  assert len(ls)==1
  v=voices[ls[0]['node']];assert v['text']==ls[0]['text'];vp=Path(v['path'])
  assert hashlib.sha256(vp.read_bytes()).hexdigest()==v['sha256']
  assert v['duration']+.8<=t['duration'],(id,'voice too long')
  dest=OUT/'edited'/f'{id}-voiced.mp4'
  if not dest.exists():
   subprocess.run([FF,'-v','error','-y','-i',str(src),'-i',str(vp),'-filter_complex','[0:a]volume=0.55[amb];[1:a]adelay=400|400,apad[voice];[amb][voice]amix=inputs=2:duration=first:normalize=0:dropout_transition=0[a]','-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t',str(t['duration']),'-movflags','+faststart',str(dest)],check=True)
  write(OUT/'edited'/f'{id}-voice.json',dict(source=str(src),voice=v,delaySeconds=.4,ambientVolume=.55,trim=None,output=str(dest)))
 if id=='V21-03':
  panel=OUT/'edited/second-letter-summary-fullframe.png'
  if not panel.exists():
   im=Image.new('RGB',(1280,720),'#d8ccb3');d=ImageDraw.Draw(im);font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',46);title=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc',35)
   d.text((120,175),'第二封信 · 摘要',font=title,fill='#514633');d.line((120,235,1160,235),fill='#ab9875',width=2)
   d.text((120,300),'李丰担忧父亲的安危，',font=font,fill='#302b24');d.text((120,390),'劝父亲与苟安停止原先的计划。',font=font,fill='#302b24');im.save(panel)
  dest=OUT/'edited'/f'{id}-document-v2.mp4'
  if not dest.exists():subprocess.run([FF,'-v','error','-y','-i',str(src),'-i',str(panel),'-filter_complex',"[0:v][1:v]overlay=0:0:enable='gte(t,3.5)'[v]",'-map','[v]','-map','0:a?','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(dest)],check=True)
  write(OUT/'edited/second-letter-summary.json',dict(sourceNode='CH2-LY07-006',text='李丰担忧父亲的安危，劝父亲与苟安停止原先的计划。',start=3.5,end=t['duration'],kind='接到信后切准确文书摘要插镜；替换模型乱字近景，不是假造原信逐字转录，不朗读',output=str(dest)))
 files[id]=str(dest)
 details.append(dict(id=id,logicalId=c['logicalId'],file=str(dest),technical=t,intendedAudioLines=[dict(node=l['node'],speaker=l['actor'],text=l['text'],centralVoice=voices.get(l['node'])) for l in c['sourceLines'] if l.get('spoken')],visualReview=decisions.get(id,{}).get('visual','pending'),audioIssues=audio_issues or ['未逐字听审；当前阶段不因纯音频问题重拍'],actualDynamicReview=decisions.get(id,{}).get('actualDynamicReview',False),review=decisions.get(id,{'visual':'pending','audio':'未逐字听审'})))
assembled=[]
for v in P['logicalClips']:
 ids=v['subclips'];missing=[id for id in ids if id not in files]
 if missing:assembled.append(dict(id=v['id'],status='incomplete',missing=missing));continue
 dest=OUT/'assembled'/f"{v['id']}-{v['name']}.mp4";lst=OUT/'assembled'/f"{v['id']}.concat.txt"
 assembly_files=[files[id] for id in ids]
 if v['id']=='V24' and 'V23-03' in files:
  entry=dissolve(files['V24-01'],files['V24-02'],OUT/'edited/V24-entry-dissolve.mp4')
  reaction=OUT/'edited/V24-return-reaction.mp4'
  if not reaction.exists():subprocess.run([FF,'-v','error','-y','-i',files['V23-03'],'-t','2','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-r','24','-c:a','aac','-ar','48000','-movflags','+faststart',str(reaction)],check=True)
  exit=dissolve(files['V24-06'],str(reaction),OUT/'edited/V24-exit-dissolve.mp4')
  assembly_files=[entry,files['V24-03'],files['V24-04'],files['V24-05'],exit]
  write(OUT/'edited/V24-memory-boundaries.json',dict(entry=dict(fromIds=['V24-01','V24-02'],dissolveSeconds=.4),exit=dict(fromId='V24-06',reactionSourceId='V23-03',reactionTime=[0,2],dissolveSeconds=.4),constraint='李严段落仅为苟安所述回忆，不算我亲见；不跨交互边界、不新增台词'))
 lst.write_text('\n'.join("file '"+p.replace('\\','/').replace("'","'\\''")+"'" for p in assembly_files),encoding='utf-8')
 fingerprints=[hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in assembly_files]
 receipt=dest.with_suffix('.json');previous=read(receipt) if receipt.exists() else {}
 if previous.get('sourceHashes')!=fingerprints or not dest.exists():
  subprocess.run([FF,'-v','error','-y','-f','concat','-safe','0','-i',str(lst),'-vf','fps=24,setsar=1','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(dest)],check=True)
  dec=subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True);assert dec.returncode==0
  write(receipt,dict(id=v['id'],sourceIds=ids,sourceFiles=assembly_files,sourceHashes=fingerprints,decode='passed',size=[1280,720],fps=24,audioSampleRate=48000,noCrossingBranches=True,review='制作候选，待用户review',audioReview='NPC未逐字听审；音频问题留统一配音，不因纯音频问题重拍'))
 assembled.append(dict(id=v['id'],name=v['name'],status='candidate',path=str(dest),receipt=str(receipt),subclips=ids,sourceNodes=[l['node'] for c in P['clips'] if c['logicalId']==v['id'] for l in c['sourceLines']],review='待用户review'))
assignment=read(OUT/'assignment.json');coverage=[]
for a in assignment['clips']:
 planned=[l for c in P['clips'] if c['logicalId']==a['id'] for l in c['sourceLines']]
 coverage.append(dict(id=a['id'],expectedNodes=[l['node'] for l in a['lines']],scriptMappingExact=[(l['node'],l['text']) for l in planned]==[(l['node'],l['text']) for l in a['lines']],readySubclips=[c['id'] for c in P['clips'] if c['logicalId']==a['id'] and c['id'] in files],missingSubclips=[c['id'] for c in P['clips'] if c['logicalId']==a['id'] and c['id'] not in files],actualDialogueVerification='未逐字听审；此覆盖仅指冻结台词到镜头/后期的精确映射，不代表原声说对'))
task_states=[]
for c in P['clips']+P.get('revisions',[]):
 tp=OUT/'tasks'/f"{c['id']}.json";ts=read(tp) if tp.exists() else {}
 task_states.append(dict(id=c['id'],revisionOf=c.get('revisionOf'),status=ts.get('status','not_submitted'),task_id=ts.get('task_id'),statePath=str(tp) if tp.exists() else None,requestPath=str(OUT/'requests'/f"{c['id']}.local.json")))
write(OUT/'delivery.json',dict(group='G3',title=P['title'],status='candidate' if all(v['status']=='candidate' for v in assembled) else 'in_progress',newPostGate='closed-by-controller' if (OUT/'pause-dispatch.flag').exists() else 'open',sourceCoverage=coverage,tasks=task_states,logicalClips=assembled,subclips=details,visualReview='各子片独立记录，实际播放结合3fps序列与动作点截图；不是24fps逐帧，不等于用户通过',audioIssues=['按总控最新要求：音频错乱仅标记，不触发付费视频重拍；不新增TTS','本片原声不承担正式台词，需统一配音或核用原声；口型仅待后续核对，不声称已对齐','NPC原声未完成逐字听审；ASR仅辅助','已知导演词、错词、音色、BGM等见各子片audioIssues，留统一配音处理'],unresolved=['画面审核详见review/decisions.json；待review不等于用户通过']))
print(json.dumps(dict(readySubclips=len(files),logical=[dict(id=v['id'],status=v['status']) for v in assembled]),ensure_ascii=False))
