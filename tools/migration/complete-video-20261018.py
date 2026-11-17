"""Final SC01/PR01 and LI01 edits; immutable inputs, frame-based EDL."""
from pathlib import Path
import subprocess,json,hashlib,math
R=Path(__file__).resolve().parents[2]
F='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
E=R/'video/review/20261018-integration'
def run(args): return subprocess.run([F,'-hide_banner',*map(str,args)],capture_output=True,encoding='utf8',check=True)
def frames(src):
    r=run(['-v','error','-i',R/src,'-map','0:v:0','-f','framemd5','-'])
    return len([l for l in r.stdout.splitlines() if l and not l.startswith('#')])
sc='video/review/20261018_v03/SC01-entry-sync-compatible-v03.mp4'
a='video/raw/PR01A-手机揭示-20261018231045.mp4'
b='video/raw/PR01B - 时代遗憾 - 20261018231117.mp4'
pr='video/in-progress/edits/PR01-prologue-27s-clean-v02.mp4'
voice='video/in-progress/generation-current-20261018/当前五条视频生成包/02-PR01B-时代遗憾多场景回忆-7.5秒/声音/hero-opening-original.wav'
old='video/in-progress/edits/LI01-grain-road-rescue-review.mp4'
rescue='video/raw/01 - 悬崖救人替换段 - 20261018231431.mp4'
counts={x:frames(x) for x in [a,b,rescue]}
(E/'source-frame-counts.json').write_text(json.dumps(counts,ensure_ascii=False,indent=2),encoding='utf8')
edl=[]
def encode(name,inputs,segments,voiceIndex=None):
    filters=[];offset=0;rows=[]
    for n,(i,src,first,last,speed) in enumerate(segments):
        duration=(last-first)/24/speed
        vf=f'[{i}:v:0]trim=start_frame={first}:end_frame={last},setpts=(PTS-STARTPTS)/{speed},fps=24,setsar=1'
        if src==b:
            duration=170/24
            vf+=',tpad=stop_mode=clone:stop_duration=0.1,trim=end_frame=170'
        filters.append(vf+f'[v{n}]')
        if src==b:
            # One original voice/room-tone track only; generated B audio is discarded entirely.
            af=f'[{voiceIndex}:a:0]atrim=duration=6.85,asetpts=PTS-STARTPTS,adelay=200:all=1,apad,atrim=duration={duration}'
        else:
            af=f'[{i}:a:0]atrim=start={first/24}:end={last/24},asetpts=PTS-STARTPTS'
            if speed!=1:af+=f',atempo={speed}'
            af+=f',aresample=48000,apad,atrim=duration={duration}'
        filters.append(af+f'[a{n}]')
        rows.append(dict(source=src,sourceFrames=[first,last],sourceSeconds=[first/24,last/24],speed=speed,outputSeconds=[offset,offset+duration],audio='original hero WAV only, +0.2s; generated audio discarded' if src==b else 'source audio; synchronized atempo' if speed!=1 else 'source audio unchanged in timing'))
        offset+=duration
    filters.append(''.join(f'[v{i}][a{i}]' for i in range(len(segments)))+f'concat=n={len(segments)}:v=1:a=1[v][a]')
    out=R/'video/current'/name
    args=[]
    for src in inputs:args+=['-i',R/src]
    args+=['-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',out]
    if not out.exists():run(args)
    d=run(['-i',out,'-vf','blackdetect=d=0.1:pix_th=0.10','-f','null','NUL'])
    (E/(name+'.decode.log')).write_text(d.stderr,encoding='utf8')
    edl.append(dict(target=out.relative_to(R).as_posix(),duration=offset,segments=rows,sha256=hashlib.sha256(out.read_bytes()).hexdigest(),bytes=out.stat().st_size,blackdetect=[x for x in d.stderr.splitlines() if 'black_start:' in x],fullDecodePassed=True,subjectiveAudioReview=False))
encode('PR01-opening-complete-20261018.mp4',[sc,a,b,pr,voice],[(0,sc,0,735,1),(1,a,0,counts[a],1),(2,b,0,counts[b],1),(3,pr,213,375,1),(3,pr,527,648,1)],4)
encode('LI01-cliff-rescue-20261018.mp4',[old,rescue],[(0,old,0,246,1),(1,rescue,0,54,1),(1,rescue,54,84,2),(1,rescue,84,counts[rescue],1)])
(E/'final-edit-list.json').write_text(json.dumps(edl,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(edl,ensure_ascii=False))
