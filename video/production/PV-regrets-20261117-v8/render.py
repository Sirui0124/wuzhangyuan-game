from pathlib import Path
import subprocess,json,hashlib,re
import imageio_ffmpeg as io
R=Path(__file__).resolve().parent;FF=io.get_ffmpeg_exe()
V=R.parent/'PV-regrets-20261117-v7/逆转五丈原-PV-v7-完整纯文字结尾版.mp4'
F=R.parent/'PV-H3-20261117-v2.14/夷陵撤离-PV-v2.14-远景至近景.mp4'
M=Path(r'C:\Users\zhousirui\Downloads\用户5806 - 止戈.mp3')
def run(args):
 p=subprocess.run([FF,'-y','-v','error',*map(str,args)],capture_output=True,timeout=600)
 if p.returncode:raise RuntimeError(p.stderr.decode('utf8','replace')[-4000:])
 return p
# Frame-aligned duration; accelerate only environment, weapon and travel shots.
parts=[(0,0,1.25,1,30,'悬手'),(0,1.25,6.75,1.1,120,'上方谷'),(0,6.75,9,1,54,'诸葛亮雨中反应'),(1,23.416666667,30.016666667,1.1,144,'火烧连营'),(0,9,23.5,1.1,316,'关羽落刀'),(0,23.5,38.25,1,354,'马谡凝望叩首与反打'),(0,38.25,51,1.1,278,'五丈原夜帐'),(0,51,58,1,168,'悬手灭灯'),(0,58,63,1,120,'楷体结语'),(0,63,70,1,168,'v15书法Logo')]
g=[];timeline=[];at=0
for n,(src,a,b,speed,frames,label) in enumerate(parts):
 d=frames/24
 vf=f'[{src}:v]trim=start={a}:end={b},setpts=(PTS-STARTPTS)/{speed},fps=24,tpad=stop_mode=clone:stop_duration=0.05,trim=duration={d},settb=AVTB,setsar=1'
 if label=='火烧连营':vf+=',fade=t=in:st=0:d=0.083333'
 g.append(vf+f'[v{n}]')
 g.append(f'[{src}:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,atempo={speed},aresample=48000,apad,atrim=duration={d},afade=t=in:d=0.012,afade=t=out:st={d-.012}:d=0.012[a{n}]')
 timeline.append(dict(label=label,start=at,end=at+d,speed=speed,source=str(V if src==0 else F),source_in=a,source_out=b));at+=d
assert abs(at-73)<.001
for kind in ['v','a']:
 g.append(''.join(f'[{kind}{n}]' for n in range(len(parts)))+f'concat=n={len(parts)}:v={int(kind=="v")}:a={int(kind=="a")}[{kind}out]')
base=R/'picture-effects-73s.mp4'
run(['-i',V,'-i',F,'-filter_complex_threads',1,'-filter_complex',';'.join(g),'-map','[vout]','-map','[aout]','-t',73,'-r',24,'-frames:v',1752,'-c:v','libx264','-preset','fast','-crf',18,'-threads',4,'-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-movflags','+faststart',base])
# Smooth gain ramps retain action detail without sudden music-level steps.
env="if(lt(t,26),0.5,if(lt(t,29),0.5-(t-26)*0.0666667,if(lt(t,40),0.3,if(lt(t,44),0.3+(t-40)*0.05,0.5))))"
g=f"[1:a]atrim=start=180:end=241,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=2.5,afade=t=out:st=55:d=6,volume='{env}':eval=frame,apad=whole_dur=73[score];[1:a]atrim=start=285:end=292,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=0.35,afade=t=out:st=3.5:d=3.5,volume=0.55,adelay=66000:all=1[logo];[0:a]volume=0.7[fx];[fx][score][logo]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.94:level=false[a]"
out=R/'逆转五丈原-PV-v8-止戈配乐与火烧连营.mp4'
run(['-i',base,'-i',M,'-filter_complex',g,'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','256k','-t',73,'-movflags','+faststart',out])
p=run(['-i',out,'-progress','pipe:1','-f','null','-']);frames=int(re.findall(r'frame=(\d+)',p.stdout.decode())[-1]);assert frames==1752
reader=io.read_frames(str(out));meta=next(reader);reader.close();assert abs(meta['duration']-73)<.05
run(['-ss',6,'-i',out,'-t',10,'-vf','fps=2,scale=400:225,tile=4x5','-frames:v',1,'-update',1,R/'fire-transition-check.jpg'])
run(['-i',out,'-vf','fps=1/4,scale=320:180,tile=5x4','-frames:v',1,'-update',1,R/'full-contact.jpg'])
run(['-ss',0,'-i',out,'-t',18,'-c:v','libx264','-preset','fast','-crf',20,'-c:a','aac','-movflags','+faststart',R/'上方谷至连营-18秒预览.mp4'])
record=dict(output=str(out),sha256=hashlib.sha256(out.read_bytes()).hexdigest(),bytes=out.stat().st_size,duration=73,frames=1752,metadata=meta,timeline=timeline,music={'source':str(M),'body':[180,241],'logo':[285,292],'text_silence':[61,66]},sound='v7已筛查环境与动作轨；新火场使用v2.14已制作环境声，保留70%；无其他配乐。自动筛查不等于听审。',full_decode='pass',user_review='待review')
(R/'检查与来源.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),'utf8')
print(json.dumps({'output':str(out),'duration':73,'frames':frames,'hash':record['sha256']},ensure_ascii=False))
