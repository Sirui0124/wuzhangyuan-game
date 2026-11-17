from pathlib import Path
import json, subprocess, hashlib, concurrent.futures
from PIL import Image,ImageOps,ImageDraw,ImageFont
R=Path(__file__).resolve().parent;OLD=R.parent/'PV-H3-20261115-v1'
FF=Path(r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe')
FP=Path(r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe')
def run(args,**kw):return subprocess.run([str(x) for x in args],capture_output=True,check=True,**kw)
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')
S=json.loads((R/'storyboard.json').read_text('utf-8'))['shots']
W=R/'work';W.mkdir(exist_ok=True)
def sound(src,start,duration,out):
 if out.exists():return
 args=[FF,'-v','error','-y']
 if src:args+=['-ss',start,'-i',src]
 else:args+=['-f','lavfi','-i','anullsrc=r=48000:cl=stereo']
 # Native mixed track retained; small anti-click ramps, no speech/music isolation claim.
 args+=['-t',duration,'-vn','-af',f'apad,atrim=duration={duration},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st={max(0,duration-.012)}:d=0.012','-ar','48000','-ac','2','-c:a','pcm_s16le',out]
 run(args,timeout=90)
def audio_concat(files,out):
 listing=out.with_suffix('.concat.txt');listing.write_text('\n'.join("file '"+str(p.as_posix()).replace("'","'\\''")+"'" for p in files),'utf-8')
 run([FF,'-v','error','-y','-f','concat','-safe','0','-i',listing,'-c:a','pcm_s16le',out],timeout=90)
def restore():
 edl=json.loads((OLD/'edit-timeline.json').read_text('utf-8'));files=[];manifest=[]
 for e in edl:
  if e['unit']=='TITLE':
   p=W/'old-TITLE.wav';sound(None,0,4,p);files.append(p);continue
  for j,s in enumerate(e['source_segments']):
   assert s.get('speed',1)==1
   dur=s['out']-s['in'];p=W/f'old-{e["unit"]}-{j}.wav'
   sound(s['source'],s['in'],dur,p);files.append(p)
   manifest.append({'unit':e['unit'],'native_audio':s['source'],'source_in':s['in'],'source_out':s['out'],'video_timeline_in':e['timeline_in'],'note':'same source time as selected picture; no voice replacement'})
 raw=R/'v1-原生音轨对齐.wav';audio_concat(files,raw)
 final=R/'原版108秒-恢复原生声音对照.mp4'
 run([FF,'-v','error','-y','-i',OLD/'开篇PV-H3-v1-108秒-无声动态审阅.mp4','-i',raw,'-map','0:v:0','-map','1:a:0','-c:v','copy','-af','alimiter=limit=0.794:level=false:latency=true','-c:a','aac','-b:a','192k','-t','108','-movflags','+faststart',final],timeout=120)
 save(R/'v1-audio-match.json',{'version':'comparison-only','purpose':'恢复原生混合音轨供对照，不是画面优化成片','segments':manifest,'audio_processing':'48k stereo; 12ms anti-click each edge; limiter -2dBFS, no automatic boost; no added BGM/voice; title4s silence','human_audio_review':'未完成逐字听审','original_preserved':True})
 run([FF,'-v','error','-y','-i',raw,'-ar','16000','-ac','1',R/'asr-input.wav'],timeout=60)
 return final
def segment(s):
 dst=W/(s['id']+'.mp4');dur=s['duration'];wav=W/(s['id']+'.wav')
 sound(s['audio_source'],s['audio_source_in'],dur,wav)
 if dst.exists():return dst
 args=[FF,'-v','error','-y']
 if s['kind']=='video':args+=['-ss',s['source_in'],'-i',s['source']]
 elif s['kind']=='still':args+=['-loop','1','-framerate','24','-i',s['source']]
 else:args+=['-f','lavfi','-i',f'color=c=black:s=1280x720:r=24:d={dur}']
 args+=['-i',wav]
 vf='scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24'
 if s.get('crop'):vf=f'crop={s["crop"]},scale=1280:720,setsar=1,fps=24'
 if s['kind']=='title':
  (R/'title.txt').write_text('逆转五丈原','utf-8')
  vf+=" ,drawtext=fontfile='C\\:/Windows/Fonts/msyh.ttc':textfile='title.txt':fontcolor=0xDDD8C9:fontsize=72:x=(w-tw)/2:y=(h-th)/2"
 args+=['-t',dur,'-map','0:v:0','-map','1:a:0','-vf',vf,'-c:v','libx264','-crf','19','-preset','fast','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',dst]
 run(args,cwd=R,timeout=240);return dst
def build():
 restore();print('Native audio restored',flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:files=list(pool.map(segment,S))
 video_files=[]
 for p,s in zip(files,S):
  v=W/('picture-'+s['id']+'.mp4')
  if not v.exists():run([FF,'-v','error','-y','-i',p,'-map','0:v:0','-c:v','copy','-an',v],timeout=45)
  video_files.append(v)
 listing=W/'previs.concat.txt';listing.write_text('\n'.join("file '"+p.as_posix()+"'\nduration "+str(s['duration']) for p,s in zip(video_files,S)),'utf-8')
 picture=W/'v2-picture-only.mp4'
 run([FF,'-v','error','-y','-f','concat','-safe','0','-i',listing,'-map','0:v:0','-c:v','copy','-an','-t','92',picture],timeout=120)
 native=R/'v2-原生声音按新剪点对齐.wav';audio_concat([W/(s['id']+'.wav') for s in S],native)
 final=R/'开篇PV-v2-92秒-分镜预演含18秒静态占位.mp4'
 run([FF,'-v','error','-y','-i',picture,'-i',native,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-af','alimiter=limit=0.794:level=false:latency=true','-t','92','-movflags','+faststart',final],timeout=120)
 report=[]
 for p in [R/'原版108秒-恢复原生声音对照.mp4',final]:
  run([FF,'-v','error','-i',p,'-f','null','-'],timeout=180)
  m=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',p]).stdout)
  m['file']=str(p);m['sha256']=hashlib.sha256(p.read_bytes()).hexdigest();m['full_decode']='pass';m['user_review']='待review';report.append(m)
 save(R/'technical-review.json',report)
 print(json.dumps([{'file':x['file'],'duration':x['format']['duration']} for x in report],ensure_ascii=False),flush=True)
if __name__=='__main__':build()
