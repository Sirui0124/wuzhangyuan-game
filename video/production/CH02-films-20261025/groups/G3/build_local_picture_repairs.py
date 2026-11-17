from pathlib import Path
import json,subprocess,hashlib
O=Path(__file__).resolve().parent;E=O/'edited/picture-usability-v2';E.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
P=read(O/'plan.json');V=read(O.parents[1]/'voice/manifest.json').get('rows',{});d=read(O/'delivery.json')
by={c['id']:c for c in P['clips']};old={c['id']:c['file'] for c in d['subclips']}
normal=[0,6,1344,756];hands=[400,436,576,324]
# Each source interval runs forward once. No frozen mouth, freeze-frame, or repeated short loops.
specs={
'V21-01': [('V21-04',0,2.6,normal,1),('V21-09',2.6,6.8,hands,1)],
'V21-04': [('V21-04',0,2.6,normal,1),('V21-09',0,4.2,hands,1)],
'V21-07': [('V21-09',0,2.1,normal,.8)],
'V21-09': [('V21-09',0,2.1,normal,1),('V21-09',2.1,6.0,hands,1)],
'V21-11': [('V21-04',0,3.0,[0,0,1152,648],.7)],
'V22-01': [('V22-01',0,2.1,normal,1),('V21-09',5.2,9.2,hands,1)],
'V22-04': [('V21-04',0,2.6,normal,1)],
'V23-03': [('V23-03',0,2.5,normal,1)],
'V25-06': [('V25-06',0,.7,normal,1),('V25-06',.7,7.0,hands,1)],
'V25-07': [('V25-07',0,2.7,normal,1),('V25-07',2.7,8.5,[0,320,576,324],1)],
}
overrides={}
for id,segments in specs.items():
 parts=[];sources=[];duration=sum((b-a)/rate for _,a,b,_,rate in segments)
 for n,(source,a,b,crop,rate) in enumerate(segments):
  src=O/'generated'/f'{source}-raw.mp4';part=E/f'{id}-part{n+1}.mp4';x,y,w,h=crop
  if not part.exists():subprocess.run([FF,'-v','error','-y','-ss',str(a),'-i',str(src),'-t',str(b-a),'-vf',f'crop={w}:{h}:{x}:{y},scale=1280:720,setsar=1,setpts=(PTS-STARTPTS)/{rate},fps=24','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p',str(part)],check=True)
  parts.append(part);sources.append(dict(file=str(src),sha256=hashlib.sha256(src.read_bytes()).hexdigest(),sourceTime=[a,b],crop=crop,playbackRate=rate))
 lst=E/f'{id}.concat.txt';lst.write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),encoding='utf-8')
 video=E/f'{id}-picture.mp4'
 if not video.exists():subprocess.run([FF,'-v','error','-y','-f','concat','-safe','0','-i',str(lst),'-c','copy',str(video)],check=True)
 dest=E/f'{id}-repaired.mp4';voice=None
 spoken=[l for l in by[id]['sourceLines'] if l.get('spoken')]
 if by[id].get('postVoiceOnly') and len(spoken)==1:
  voice=V.get(spoken[0]['node']);assert voice and voice.get('ready'),id
  assert voice['text']==spoken[0]['text'];vp=Path(voice['path']);assert hashlib.sha256(vp.read_bytes()).hexdigest()==voice['sha256']
  assert voice['duration']+.4<=duration,(id,'full central voice must fit',voice['duration'],duration)
 if not dest.exists():
  if voice:
   subprocess.run([FF,'-v','error','-y','-i',str(video),'-i',voice['path'],'-filter_complex','[1:a]adelay=400|400,apad[a]','-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-ar','48000','-b:a','192k','-t',str(duration),'-movflags','+faststart',str(dest)],check=True)
  else:
   subprocess.run([FF,'-v','error','-y','-i',str(video),'-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-t',str(duration),'-movflags','+faststart',str(dest)],check=True)
 subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','NUL'],check=True,capture_output=True)
 receipt=dict(id=id,file=str(dest),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),estimatedDuration=duration,sourceSegments=sources,fullSourceLinesPreserved=True,noLoop=True,noFrozenMouth=True,existingCentralVoice=voice,audioIssues=['复用既有中央玩家音轨，无新增TTS；音色、逐字听审及环境混音仍待统一阶段' if voice else '该返回镜头无源对白；当前静音等待环境声整理，不声明混音完成'],reviewState='pending-final-dynamic-review',previousAdoptPath=old[id])
 dest.with_suffix('.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8');overrides[id]=receipt
 print(id,round(duration,3),flush=True)
 q=E/f'{id}-review.jpg'
 if not q.exists():subprocess.run([FF,'-v','error','-y','-i',str(dest),'-vf','fps=3,scale=320:-1,tile=5x5','-frames:v','1',str(q)],check=True)
(O/'review/picture-repair/candidate-overrides.json').write_text(json.dumps(overrides,ensure_ascii=False,indent=2),encoding='utf-8')
print('Local candidates prepared; original delivery unchanged.')
