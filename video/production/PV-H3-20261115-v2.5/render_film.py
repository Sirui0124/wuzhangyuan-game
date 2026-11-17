from pathlib import Path
import subprocess,json,hashlib,concurrent.futures,sys
R=Path(__file__).resolve().parent;E=R/'edit';E.mkdir(exist_ok=True)
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
FP=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe'
def run(a,**kw):
 p=subprocess.run(list(map(str,a)),capture_output=True,**kw)
 if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-4000:])
 return p
def meta(p):return json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',p]).stdout)
def concat(ps,out):
 f=out.with_suffix('.concat.txt');f.write_text('\n'.join("file '"+p.as_posix()+"'" for p in ps),'utf-8')
 run([FF,'-v','error','-y','-f','concat','-safe','0','-i',f,'-c','copy',out],timeout=120)
def part(s):
 vp=E/(s['id']+'-picture.mp4');ap=E/(s['id']+'-sound.wav');dur=s['duration'];src=Path(s['source']) if s.get('source') else None;start=s.get('in',0);sd=s.get('source_duration',dur)
 if '--reuse-unchanged' in sys.argv and s.get('reuse_unchanged') and vp.exists() and ap.exists():return vp,ap
 vf=s.get('pre_crop','')+'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,'+f'setpts=(PTS-STARTPTS)*{dur/sd},fps=24'
 if s.get('title'):
  (E/'title.txt').write_text('逆 转 五 丈 原','utf-8');vf="drawtext=fontfile='C\\:/Windows/Fonts/simsun.ttc':textfile='title.txt':fontcolor=0xDDD8D0:fontsize=84:x=(w-tw)/2:y=(h-th)/2:alpha='if(lt(t,0.3),0,if(lt(t,0.9),(t-0.3)/0.6,if(lt(t,3.4),1,max(0,(4-t)/0.6))))'"
 if s.get('picture_fade_out'):
  n=s['picture_fade_out'];vf+=f',fade=t=out:st={dur-n}:d={n}'
 reuse=next((x.split('=',1)[1].split(',') for x in sys.argv if x.startswith('--only-picture=')),None)
 if (('--audio-only' not in sys.argv) and (reuse is None or s['id'] in reuse)) or not vp.exists():
  a=[FF,'-v','error','-y']+(['-ss',start,'-i',src] if src else ['-f','lavfi','-i',f'color=black:s=1280x720:r=24:d={dur}'])
  a+=['-an','-vf',vf,'-t',dur,'-frames:v',round(dur*24),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',vp]
  run(a,cwd=E,timeout=180)
 asrc=Path(s['audio_source']) if s.get('audio_source') else src;ain=s.get('audio_in',start if src else 0);ads=s.get('audio_source_duration',sd);speed=s.get('audio_speed',ads/dur)
 a=[FF,'-v','error','-y']+(['-ss',ain,'-i',asrc] if asrc else ['-f','lavfi','-i','anullsrc=r=48000:cl=stereo'])
 af=f'atrim=duration={ads},asetpts=PTS-STARTPTS,atempo={speed},apad,atrim=duration={dur},highpass=f=55,volume={s.get("gain_db",0)}dB,afade=t=in:d=0.01,afade=t=out:st={max(0,dur-.02)}:d=0.02'
 if s.get('fade_at') is not None:af+=f',afade=t=out:st={s["fade_at"]}:d={s.get("fade_length",.3)}'
 a+=['-vn','-af',af,'-ar','48000','-ac','2','-c:a','pcm_s24le',ap];run(a,timeout=90)
 return vp,ap
def main():
 c=json.loads((R/'final-edit.json').read_text('utf-8'));shots=c['shots'];t=0
 for s in shots:
  assert abs(s['duration']*24-round(s['duration']*24))<1e-6
  s['timeline_in']=t;t+=s['duration'];s['timeline_out']=t
  if s.get('source'):assert Path(s['source']).exists(),s['source']
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as p:parts=list(p.map(part,shots))
 concat([x[0] for x in parts],E/'picture.mp4');concat([x[1] for x in parts],E/'mix.wav')
 out=R/'逆转五丈原-PV-v2.5-完整成片.mp4'
 run([FF,'-v','error','-y','-i',E/'picture.mp4','-i',E/'mix.wav','-map','0:v:0','-map','1:a:0','-c:v','copy','-af','alimiter=limit=0.794:level=false:latency=true','-c:a','aac','-b:a','192k','-t',t,'-movflags','+faststart',out],timeout=120)
 run([FF,'-v','error','-i',out,'-f','null','-'],timeout=180);m=meta(out);v=next(x for x in m['streams'] if x['codec_type']=='video');a=next(x for x in m['streams'] if x['codec_type']=='audio')
 assert int(v['nb_frames'])==round(t*24);assert abs(float(a['duration'])-t)<.04;assert abs(float(v['duration'])-t)<.04
 (R/'edit-timeline.json').write_text(json.dumps({'version':'v2.5','duration':t,'shots':shots},ensure_ascii=False,indent=2),'utf-8')
 q={'file':str(out),'duration':t,'frames':int(v['nb_frames']),'full_decode':'pass','metadata':m,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'user_review':'待review'}
 (R/'final-technical.json').write_text(json.dumps(q,ensure_ascii=False,indent=2),'utf-8');print(json.dumps({k:q[k] for k in ['file','duration','frames']},ensure_ascii=False))
if __name__=='__main__':main()



