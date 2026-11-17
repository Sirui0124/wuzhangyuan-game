"""Build picture and PCM separately; exact frames, native audio with explicit edits."""
from pathlib import Path
import json,subprocess,concurrent.futures,hashlib,math,sys
R=Path(__file__).resolve().parent;W=R/'edit';W.mkdir(exist_ok=True)
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
FP=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe'
def run(args,**kw):return subprocess.run([str(a) for a in args],capture_output=True,check=True,**kw)
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')
def meta(p):return json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',p],timeout=45).stdout)
def video_part(src,start,end,duration,p,crop=None):
 vf=(f'crop={crop},' if crop else '')+'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,'
 vf+=f'setpts=(PTS-STARTPTS)*{duration/(end-start)},fps=24'
 run([FF,'-v','error','-y','-ss',start,'-i',src,'-t',duration,'-an','-vf',vf,'-frames:v',round(duration*24),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',p],timeout=180)
def concat(files,out,kind):
 listing=out.with_suffix('.concat.txt');listing.write_text('\n'.join("file '"+p.as_posix()+"'" for p in files),'utf-8')
 run([FF,'-v','error','-y','-f','concat','-safe','0','-i',listing,'-c',('copy' if kind=='video' else 'pcm_s24le'),out],timeout=180)
def part(s):
 name=s['id'];dur=s['duration'];source=R/s['unit']/'source.mp4' if s.get('unit') else None
 vp=W/(name+'-picture.mp4');ap=W/(name+'-sound.wav')
 if '--audio-only' in sys.argv and vp.exists():pass
 elif s.get('title'):
  (W/'title.txt').write_text('逆转五丈原','utf-8')
  vf="drawtext=fontfile='C\\:/Windows/Fonts/msyh.ttc':textfile='title.txt':fontcolor=0xDDD8C9:fontsize=76:x=(w-tw)/2:y=(h-th)/2"
  run([FF,'-v','error','-y','-f','lavfi','-i',f'color=black:s=1280x720:r=24:d={dur}','-vf',vf,'-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p',vp],cwd=W,timeout=90)
 elif s.get('black'):
  run([FF,'-v','error','-y','-f','lavfi','-i',f'color=black:s=1280x720:r=24:d={dur}','-an','-c:v','libx264','-pix_fmt','yuv420p',vp],timeout=60)
 elif s.get('picture_parts'):
  files=[]
  for j,v in enumerate(s['picture_parts']):
   p=W/(name+f'-sub{j}.mp4');src=R/v.get('unit',s['unit'])/'source.mp4'
   video_part(src,v['in'],v['out'],v['duration'],p,v.get('crop'));files.append(p)
  concat(files,vp,'video')
 else:video_part(source,s.get('in',0),s.get('in',0)+dur,dur,vp,s.get('crop'))
 if s.get('audio_source'):
  src=Path(s['audio_source']);ain=s.get('audio_in',0)
 elif source:src=source;ain=s.get('audio_in',s.get('in',0))
 else:src=None;ain=0
 args=[FF,'-v','error','-y']+(['-ss',ain,'-i',src] if src else ['-f','lavfi','-i','anullsrc=r=48000:cl=stereo'])
 af=f'apad,atrim=duration={dur},asetpts=PTS-STARTPTS,highpass=f=55,volume={s.get("gain_db",0)}dB,afade=t=in:d=0.012,afade=t=out:st={max(0,dur-.018)}:d=0.018'
 if s.get('sound_fade_at') is not None:af+=f',afade=t=out:st={s["sound_fade_at"]}:d={s.get("sound_fade_duration",.25)}'
 args+=['-vn','-af',af,'-ar','48000','-ac','2','-c:a','pcm_s24le',ap]
 run(args,timeout=90)
 return vp,ap
def main():
 config=json.loads((R/'final-edit.json').read_text('utf-8'));shots=config['shots'];t=0
 for s in shots:
  assert abs(s['duration']*24-round(s['duration']*24))<.0001
  s['timeline_in']=t;t+=s['duration'];s['timeline_out']=t
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:parts=list(pool.map(part,shots))
 concat([p[0] for p in parts],W/'picture.mp4','video');concat([p[1] for p in parts],W/'native-cut.wav','audio')
 # Short scene-bed bridges only where explicitly selected; dialogue and impacts are never overlapped blindly.
 mix=config.get('bridges',[]);raw=W/'native-cut.wav'
 if mix:
  args=[FF,'-v','error','-y','-i',raw];filters=['[0:a]anull[a0]'];labels=['[a0]']
  for j,b in enumerate(mix,1):
   args+=['-ss',b['source_in'],'-t',b['duration'],'-i',R/b['unit']/'source.mp4']
   d=b['duration'];delay=round(b['timeline_in']*1000)
   filters.append(f'[{j}:a]atrim=duration={d},asetpts=PTS-STARTPTS,volume={b.get("gain_db",-12)}dB,afade=t=in:d=0.12,afade=t=out:st={max(.12,d-.2)}:d=0.2,adelay={delay}|{delay}[b{j}]');labels.append(f'[b{j}]')
  filters.append(''.join(labels)+f'amix=inputs={len(labels)}:normalize=0,atrim=duration={t}[mix]')
  out=W/'mixed.wav';args+=['-filter_complex',';'.join(filters),'-map','[mix]','-ar','48000','-c:a','pcm_s24le',out]
  run(args,timeout=180);raw=out
 final=R/'逆转五丈原-PV-v2.1-完整成片.mp4'
 run([FF,'-v','error','-y','-i',W/'picture.mp4','-i',raw,'-map','0:v:0','-map','1:a:0','-c:v','copy','-af','alimiter=limit=0.794:level=false:latency=true','-c:a','aac','-b:a','192k','-ar','48000','-t',t,'-movflags','+faststart',final],timeout=180)
 run([FF,'-v','error','-i',final,'-f','null','-'],timeout=240);m=meta(final)
 v=next(x for x in m['streams'] if x['codec_type']=='video');a=next(x for x in m['streams'] if x['codec_type']=='audio')
 assert int(v['nb_frames'])==round(t*24),(v['nb_frames'],t)
 assert abs(float(v['duration'])-t)<.03 and abs(float(a['duration'])-t)<.03
 save(R/'edit-timeline.json',{'duration':t,'shots':shots,'bridges':mix,'no_added_music':True,'source_audio_policy':'native voices and ambience preserved; per-shot processing and findings recorded separately'})
 save(R/'final-technical.json',{'file':str(final),'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'full_decode':'pass','duration':t,'frames':v['nb_frames'],'metadata':m,'user_review':'pending','note':'Technical checks are not human approval or proof of no native BGM.'})
 print(json.dumps({'file':str(final),'seconds':t,'frames':v['nb_frames']},ensure_ascii=False))
if __name__=='__main__':main()
