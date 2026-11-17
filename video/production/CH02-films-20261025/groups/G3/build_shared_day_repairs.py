from pathlib import Path
import json,subprocess,hashlib
O=Path(__file__).resolve().parent;R=O/'review/picture-repair';E=O/'edited/picture-usability-v3';E.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sources={r['id']:r for r in read(R/'shared-listener-reuse.json')};assert all(r['reviewState']=='own-dynamic-review-passed' for r in sources.values())
P=read(O/'plan.json');D=read(O/'delivery.json');old={c['id']:c['file'] for c in D['subclips']};V=read(O.parents[1]/'voice/manifest.json')['rows'];by={c['id']:c for c in P['clips']}
specs={'V21-01':[(sources['G4-L02']['snapshot'],0,7.4)],'V21-04':[(sources['G1-L01']['snapshot'],0,6)],'V21-09':[(sources['G4-L02']['snapshot'],.8,6.8)],'V22-01':[(sources['G1-L01']['snapshot'],0,6)],'V21-02':[(old['V21-02'],0,7.4),(old['V21-06'],3,7.85)]}
over=read(R/'candidate-overrides.json')
for id,segments in specs.items():
 duration=sum(b-a for _,a,b in segments);parts=[];receipts=[]
 for n,(source,a,b) in enumerate(segments):
  src=Path(source);part=E/f'{id}-part{n+1}.mp4'
  if not part.exists():subprocess.run([FF,'-v','error','-y','-ss',str(a),'-i',str(src),'-t',str(b-a),'-vf','scale=1280:720,setsar=1,fps=24','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p',str(part)],check=True)
  parts.append(part);receipts.append(dict(file=str(src),sha256=hashlib.sha256(src.read_bytes()).hexdigest(),sourceTime=[a,b],playbackRate=1,reuseRole='仅复用同一人物视觉表演，不导入原节点剧情或声音'))
 lst=E/f'{id}.concat.txt';lst.write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),encoding='utf-8');vid=E/f'{id}-picture.mp4'
 if not vid.exists():subprocess.run([FF,'-v','error','-y','-f','concat','-safe','0','-i',str(lst),'-c','copy',str(vid)],check=True)
 dest=E/f'{id}-shared-repaired.mp4';voice=None
 if by[id].get('postVoiceOnly'):
  lines=[l for l in by[id]['sourceLines'] if l.get('spoken')];assert len(lines)==1;voice=V[lines[0]['node']];assert voice['text']==lines[0]['text'] and voice['ready'];assert voice['duration']+.4<=duration;assert hashlib.sha256(Path(voice['path']).read_bytes()).hexdigest()==voice['sha256']
 if not dest.exists():
  if voice:args=['-i',voice['path'],'-filter_complex','[1:a]adelay=400|400,apad[a]','-map','0:v','-map','[a]']
  else:args=['-i',old[id],'-filter_complex','[1:a]apad[a]','-map','0:v','-map','[a]']
  subprocess.run([FF,'-v','error','-y','-i',str(vid),*args,'-c:v','copy','-c:a','aac','-ar','48000','-b:a','192k','-t',str(duration),'-movflags','+faststart',str(dest)],check=True)
 subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','NUL'],capture_output=True,check=True)
 previous=over.get(id);record=dict(id=id,file=str(dest),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),estimatedDuration=duration,sourceSegments=receipts,fullSourceLinesPreserved=True,noLoop=True,noFrozenMouth=True,noAdditionalSlowdown=True,existingCentralVoice=voice,audioIssues=['复用既有中央玩家音轨，未新增TTS；逐字听审、音色与混音待统一。' if voice else '原槽音轨完整保留，复用同一苟安画内表演；精确声口同步与正式原声逐字听审待统一。'],reviewState='pending-final-dynamic-review',previousAdoptPath=old[id],previousCandidates=[dict(file=previous['file'],sha256=previous['sha256'],reviewState=previous['reviewState'])] if previous else [])
 dest.with_suffix('.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8');over[id]=record
 subprocess.run([FF,'-v','error','-y','-i',str(dest),'-vf','fps=3,scale=320:-1,tile=5x8','-frames:v','1',str(E/f'{id}-review.jpg')],check=True)
 print(id,duration,flush=True)
(R/'candidate-overrides.json').write_text(json.dumps(over,ensure_ascii=False,indent=2),encoding='utf-8');print('Day repairs staged from existing source; no generation request.')
