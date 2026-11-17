from pathlib import Path
import subprocess,json,hashlib,re
import imageio_ffmpeg as io
R=Path(__file__).resolve().parent;P=R.parent/'PV-regrets-20261117-v2';V3=R.parent/'PV-regrets-20261117-v3/三国遗憾-PV-v3-去篝火重复版.mp4';FF=io.get_ffmpeg_exe()
OUT=R/'三国遗憾-PV-v5-写实谷地与马谡叩首.mp4'
def run(args):
 p=subprocess.run([FF,'-y','-hide_banner','-v','error',*map(str,args)],capture_output=True,timeout=600)
 if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-4000:])
 return p
norm='scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24,settb=AVTB,setpts=PTS-STARTPTS'
g=f'''[0:v]trim=duration=1.5,settb=AVTB,setpts=PTS-STARTPTS[h];
[1:v]trim=start=2.5:end=8,{norm},split[sharp][soft];[soft]gblur=sigma=8:steps=2:enable='lt(t,0.25)'[blur];[sharp][blur]blend=all_expr='A*min(1,max(0,T/0.25))+B*(1-min(1,max(0,T/0.25)))':enable='lt(t,0.25)'[valley];
[h][valley]xfade=transition=custom:duration=0.25:offset=1.25:expr='if(gte(P,0.5),A,B)'[head];
[2:v]trim=start=9.25:end=26,settb=AVTB,setpts=PTS-STARTPTS[mid];
[3:v]trim=duration=7,{norm}[bow];
[4:v]trim=duration=8,settb=AVTB,setpts=PTS-STARTPTS[fan];
[head][mid][bow][fan]concat=n=4:v=1:a=0,settb=AVTB[body];
[5:v]trim=duration=7.75,settb=AVTB,setpts=PTS-STARTPTS[night];
[body][night]xfade=transition=fadeblack:duration=0.25:offset=38.25[n];
[2:v]trim=start=44.5:end=61.25,settb=AVTB,setpts=PTS-STARTPTS[tail];
[n][tail]concat=n=2:v=1:a=0,format=yuv420p[v];
[2:a]atrim=start=0:end=26,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=out:st=25.99:d=0.01[a0];
[6:a]atrim=duration=7,asetpts=PTS-STARTPTS,highpass=f=140,lowpass=f=1700,volume=0.09,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=0.03,afade=t=out:st=6.97:d=0.03[wind];
[2:a]atrim=start=27.5:end=35.5,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=0.01,afade=t=out:st=7.99:d=0.01[a1];
[2:a]atrim=start=37:end=61.25,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=0.01[a2];
[a0][wind][a1][a2]concat=n=4:v=0:a=1[longaudio];[longaudio]asplit[ahead][arest];[ahead]atrim=end=1.25,asetpts=PTS-STARTPTS[ah];[arest]atrim=start=3.75,asetpts=PTS-STARTPTS[at];[ah][at]concat=n=2:v=0:a=1[a]'''.replace('\n','')
(R/'filtergraph.txt').write_text(g,'utf-8')
run(['-i',P/'edit/H01.mp4','-i',R/'A01R/source.mp4','-i',V3,'-i',R/'C01K2/source.mp4','-i',P/'edit/C02.mp4','-i',P/'edit/D01.mp4','-f','lavfi','-i','anoisesrc=color=pink:sample_rate=48000:seed=1711:duration=7','-filter_complex_threads','1','-filter_complex',g,'-map','[v]','-map','[a]','-t','62.75','-r','24','-frames:v','1506','-c:v','libx264','-threads','4','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',OUT])
decoded=run(['-i',OUT,'-progress','pipe:1','-f','null','-'])
assert int(re.findall(r'frame=(\d+)',decoded.stdout.decode())[-1])==1506
reader=io.read_frames(str(OUT));meta=next(reader);reader.close()
assert abs(meta['duration']-62.75)<0.06
(R/'technical.json').write_text(json.dumps(dict(file=str(OUT),sha256=hashlib.sha256(OUT.read_bytes()).hexdigest(),metadata=meta,full_decode='pass',progress=decoded.stdout.decode(),planned_frames=1506,user_review='待review',audio='沿用v3已选音轨；新叩首使用本地非音调滤波噪声风声，不使用两条未经听审的H3新原声，无新增BGM或对白。'),ensure_ascii=False,indent=2),'utf-8')
for name,start,dur,fps,layout in [('opening',0,12,2,'4x6'),('bow-fan',22.5,10,2,'4x5'),('fan-night',37.5,2,8,'4x4'),('full',0,62.75,.25,'4x5')]:
 run(['-ss',start,'-i',OUT,'-t',dur,'-vf',f'fps={fps},scale=320:180,tile={layout}','-frames:v','1','-update','1',R/(name+'.jpg')])
print(json.dumps(dict(output=str(OUT),metadata=meta),ensure_ascii=False))
