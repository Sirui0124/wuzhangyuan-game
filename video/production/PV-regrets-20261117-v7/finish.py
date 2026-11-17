from pathlib import Path
import subprocess,json,hashlib,re
import imageio_ffmpeg as io
R=Path(__file__).resolve().parent;FF=io.get_ffmpeg_exe()
SRC=R.parent/'PV-regrets-20261117-v6/三国遗憾-PV-v6-金墨书法片尾.mp4'
OUT=R/'逆转五丈原-PV-v7-完整纯文字结尾版.mp4'
LINE='若能重来，你想改写哪一段遗憾？'
(R/'closing-line.txt').write_text(LINE,'utf-8')
def run(args):
 p=subprocess.run([FF,'-y','-hide_banner','-v','error',*map(str,args)],cwd=R,capture_output=True,timeout=600)
 if p.returncode:raise RuntimeError(p.stderr.decode('utf-8','replace')[-3000:])
 return p
vf="drawtext=fontfile='C\\:/Windows/Fonts/simkai.ttf':textfile=closing-line.txt:fontsize=44:fontcolor=0xE8E1D3:x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t,0.5),0,if(lt(t,1.5),t-0.5,if(lt(t,4),1,if(lt(t,4.75),(4.75-t)/0.75,0))))'"
run(['-f','lavfi','-i','color=c=black:s=1280x720:r=24:d=5','-vf',vf,'-t',5,'-c:v','libx264','-preset','fast','-crf',16,'-pix_fmt','yuv420p','-an',R/'楷体结语-5秒.mp4'])
g='[0:v]trim=end=58,setpts=PTS-STARTPTS,settb=AVTB[a];[1:v]setpts=PTS-STARTPTS,settb=AVTB[b];[0:v]trim=start=58:end=65,setpts=PTS-STARTPTS,settb=AVTB[c];[a][b][c]concat=n=3:v=1:a=0[v];[0:a]atrim=end=58,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a0];[2:a]atrim=duration=5,asetpts=PTS-STARTPTS[a1];[0:a]atrim=start=58:end=65,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a2];[a0][a1][a2]concat=n=3:v=0:a=1[audio]'
run(['-i',SRC,'-i',R/'楷体结语-5秒.mp4','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-filter_complex_threads',1,'-filter_complex',g,'-map','[v]','-map','[audio]','-t',70,'-frames:v',1680,'-r',24,'-c:v','libx264','-preset','fast','-crf',18,'-threads',4,'-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',OUT])
p=run(['-i',OUT,'-progress','pipe:1','-f','null','-']);frames=int(re.findall(r'frame=(\d+)',p.stdout.decode())[-1]);assert frames==1680
reader=io.read_frames(str(OUT));meta=next(reader);reader.close();assert abs(meta['duration']-70)<.05
run(['-ss',56,'-i',OUT,'-t',14,'-c:v','libx264','-preset','fast','-crf',18,'-c:a','aac','-b:a','192k','-movflags','+faststart',R/'结尾预览-灯灭至Logo.mp4'])
run(['-ss',58,'-i',OUT,'-t',12,'-vf','fps=2,scale=400:225,tile=4x6','-frames:v',1,'-update',1,R/'ending-contact.jpg'])
run(['-ss',60,'-i',OUT,'-frames:v',1,'-update',1,R/'text-check.png'])
(R/'检查与来源.json').write_text(json.dumps(dict(output=str(OUT),sha256=hashlib.sha256(OUT.read_bytes()).hexdigest(),source=str(SRC),source_sha256=hashlib.sha256(SRC.read_bytes()).hexdigest(),metadata=meta,frames=frames,full_decode='pass',line=LINE,font='C:/Windows/Fonts/simkai.ttf',font_size=44,timeline={'剧情与已补拍镜头':[0,58],'纯文字结语':[58,63],'v15书法logo':[63,70]},text_timing={'黑场':[58,58.5],'渐显':[58.5,59.5],'完整停留':[59.5,62],'淡出':[62,62.75]},added_dialogue=False,added_bgm=False,new_api_calls=0,user_review='待review',visual_review='待抽帧检查'),ensure_ascii=False,indent=2),'utf-8')
print(str(OUT))
