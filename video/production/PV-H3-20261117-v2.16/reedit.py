from pathlib import Path
import json,subprocess,hashlib
R=Path(__file__).resolve().parent;OLD=R.parent/'PV-H3-20261117-v2.15';ROOT=R.parents[2];E=R/'edit';E.mkdir(exist_ok=True)
FF=ROOT/'.local-tools/pv-h3/ffmpeg.exe';FP=ROOT/'.local-tools/pv-h3/ffprobe.exe'
def run(a):
 p=subprocess.run(list(map(str,a)),capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-2400:])
 return p.stdout
base='scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24'
run([FF,'-v','error','-y','-i',R/'G01/source.mp4','-an','-vf',base,'-frames:v',64,'-c:v','libx264','-preset','fast','-crf',18,'-pix_fmt','yuv420p',E/'silk.mp4'])
terrain=R/'references/第四章前线军令-实际地图.png'
run([FF,'-v','error','-y','-loop',1,'-i',terrain,'-vf',base,'-frames:v',48,'-an','-c:v','libx264','-preset','fast','-crf',18,'-pix_fmt','yuv420p',E/'game-map.mp4'])
run([FF,'-v','error','-y','-i',E/'silk.mp4','-i',E/'game-map.mp4','-filter_complex','[0:v]settb=AVTB[a];[1:v]settb=AVTB[b];[a][b]xfade=transition=fade:duration=0.5:offset=2.166666667,format=yuv420p[v]','-map','[v]','-an','-frames:v',100,'-r',24,'-c:v','libx264','-preset','fast','-crf',18,E/'tail.mp4'])
parts=[OLD/'edit'/f'{n}.mp4' for n in ['PV','L01','L02S','L03','L04R']]+[E/'tail.mp4']
for p in parts:assert p.exists()
cf=E/'concat.txt';cf.write_text('\n'.join("file '"+p.as_posix()+"'" for p in parts),'utf-8')
run([FF,'-v','error','-y','-f','concat','-safe','0','-i',cf,'-c','copy',E/'picture.mp4'])
original=OLD/'夷陵撤离与认印托付-PV-v2.15.mp4';out=R/'夷陵撤离与认印托付-PV-v2.16-第四章地图.mp4'
run([FF,'-v','error','-y','-i',E/'picture.mp4','-i',original,'-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart',out])
run([FF,'-v','error','-i',out,'-f','null','-'])
meta=json.loads(run([FP,'-v','error','-show_streams','-show_format','-of','json',out]));v=next(s for s in meta['streams'] if s['codec_type']=='video');assert int(v['nb_frames'])==1820
def streamhash(path,kind,frames=None):
 args=[FF,'-v','error','-i',path,'-map',f'0:{kind}:0']
 if frames:args+=['-frames:v',frames]
 return run(args+['-f','hash','-hash','sha256','-']).decode().strip()
audio=[streamhash(p,'a') for p in [original,out]];assert audio[0]==audio[1]
prefix=[streamhash(p,'v',1720) for p in [original,out]];assert prefix[0]==prefix[1]
run([FF,'-v','error','-y','-ss',1720/24,'-i',out,'-vf','fps=4,scale=320:180,tile=4x5','-frames:v',1,R/'ending-contact.jpg'])
run([FF,'-v','error','-y','-sseof','-0.1','-i',out,'-frames:v',1,R/'ending.png'])
info=dict(file=str(out),duration=float(v['duration']),frames=int(v['nb_frames']),width=v['width'],height=v['height'],sha256=hashlib.sha256(out.read_bytes()).hexdigest(),full_decode='pass',audio_hash_equal=True,prefix_1720_frames_hash_equal=True,changed_range=[1720/24,1820/24],audio_hash=audio[0],prefix_hash=prefix[0],user_review='待review',metadata=meta)
(R/'final-technical.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),'utf-8')
plan=json.loads((R/'production-plan.json').read_text('utf-8'));plan.update(current_film=str(out),film_sha256=info['sha256'],film_status='待review',edit=dict(prefix_parts=[str(p) for p in parts[:-1]],changed_range=info['changed_range'],native_silk_selection=[0,64/24],map_source=str(terrain),map_sha256=hashlib.sha256(terrain.read_bytes()).hexdigest(),map_display='和游戏CSS相同的居中cover裁切，16:9；无新增兵力/任务状态',crossfade=.5,audio_source=str(original),audio_bitstream_copy=True))
plan['units'][0].update(video_status='待review',current_video=str(R/'G01/source.mp4'))
(R/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps({k:info[k] for k in ['file','duration','frames','audio_hash_equal','prefix_1720_frames_hash_equal']},ensure_ascii=False))
