from pathlib import Path
import json,subprocess,hashlib
O=Path(__file__).resolve().parent;R=O/'review/picture-repair';E=O/'edited/picture-usability-v3'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
source=O/'generated/V24-03-R3-raw.mp4';expected='efbb719c093c50eb7c4af149cfd0341e9a18383d6775c4ac71548f9a180e8c07';assert hashlib.sha256(source.read_bytes()).hexdigest()==expected
old={c['id']:c['file'] for c in read(O/'delivery.json')['subclips']};over=read(R/'candidate-overrides.json')
specs={'V24-03':[(source,3.5,9.5,[592,40,752,423]),(O/'generated/V24-03-R2-raw.mp4',6,13.666667,[420,440,576,324])],'V24-06':[(source,3.5,9.5,[592,40,752,423]),(O/'generated/V24-06-raw.mp4',0,2,[0,320,576,324])]}
for id,segments in specs.items():
 parts=[];sources=[];duration=sum(b-a for _,a,b,_ in segments)
 for n,(src,a,b,crop) in enumerate(segments):
  x,y,w,h=crop;dst=E/f'{id}-memory-part{n+1}-exact444.mp4'
  if not dst.exists():subprocess.run([FF,'-v','error','-y','-ss',str(a),'-i',str(src),'-t',str(b-a),'-vf',f'format=yuv444p,crop={w}:{h}:{x}:{y},scale=1280:720,setsar=1,fps=24,format=yuv420p','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p',str(dst)],check=True)
  parts.append(dst);sources.append(dict(file=str(src),sha256=hashlib.sha256(src.read_bytes()).hexdigest(),sourceTime=[a,b],crop=crop,playbackRate=1,role='李严闭口反应' if n==0 else '同一回忆书房桌案/灯火观察，画面不出现错误角色嘴部'))
 lst=E/f'{id}-memory-exact444.concat.txt';lst.write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),encoding='utf-8');vid=E/f'{id}-memory-picture-exact444.mp4'
 if not vid.exists():subprocess.run([FF,'-v','error','-y','-f','concat','-safe','0','-i',str(lst),'-c','copy',str(vid)],check=True)
 dest=E/f'{id}-memory-repaired-exact444.mp4'
 if not dest.exists():subprocess.run([FF,'-v','error','-y','-i',str(vid),'-i',old[id],'-map','0:v','-map','1:a:0','-c:v','copy','-c:a','aac','-ar','48000','-t',str(duration),'-movflags','+faststart',str(dest)],check=True)
 subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','NUL'],check=True,capture_output=True)
 record=dict(id=id,file=str(dest),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),estimatedDuration=duration,sourceSegments=sources,reviewState='pending-final-dynamic-review',fullSourceLinesPreserved=True,noLoop=True,noFrozenMouth=True,noAdditionalSlowdown=True,sourceAssistReport=str(O.parent/'G4/review/G3-Liyan-listener-assist.json'),integrationConditions=['仅作苟安口述回忆的借位视角，不当作玩家亲见或已独立核实的事实。','这些句子由苟安在回忆画外发声；李严本片不得代说；保留那夜引入与回到伤帐的首尾。'],audioIssues=['原临时音轨不承担正式回忆台词；正式苟安声线、逐字听审与声口核对待统一，无新TTS。'],previousAdoptPath=old[id])
 dest.with_suffix('.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8');over[id]=record
 subprocess.run([FF,'-v','error','-y','-i',str(dest),'-vf','fps=3,scale=320:-1,tile=5x9','-frames:v','1',str(E/f'{id}-review.jpg')],check=True)
 print(id,duration,flush=True)
(R/'candidate-overrides.json').write_text(json.dumps(over,ensure_ascii=False,indent=2),encoding='utf-8');print('Memory candidates staged; no new API request.')
