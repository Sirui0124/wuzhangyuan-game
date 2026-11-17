"""Replace one leaked epilogue frame, keeping duration and compressed audio."""
from pathlib import Path
import json, hashlib, subprocess, sys
import av
from PIL import Image, ImageDraw

R=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
sys.path.insert(0,str(R))
from assemble_endings import video_coverage

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def audio_hash(p):
    h=hashlib.sha256(); n=0
    with av.open(str(p)) as c:
        for packet in c.demux(audio=0):
            if packet.size: h.update(bytes(packet)); n+=1
    return {'sha256':h.hexdigest(),'packets':n}

src=R/'films/E3-真相到了人没回来-V2.mp4'
assert sha(src)=='d423e1d3ee142aebb7919ab7ef1463150b82b652af16e661c0697b108eee9fcd'
dest=R/'films/E3-真相到了人没回来-V3.mp4'
assert not dest.exists(), 'Do not overwrite an existing revision'
cmd=[FF,'-v','error','-nostdin','-i',str(src),'-map','0:v:0','-map','0:a:0',
     '-vf','trim=end_frame=1797,tpad=stop_mode=clone:stop=1,setpts=N/(24*TB)',
     '-r','24','-fps_mode','cfr',
     '-c:v','libx264','-threads','2','-preset','fast','-crf','18','-c:a','copy',
     '-movflags','+faststart',str(dest)]
subprocess.run(cmd,check=True,capture_output=True)
coverage=video_coverage(dest,1798/24)
decode=subprocess.run([FF,'-v','error','-i',str(dest),'-f','null','-'],capture_output=True)
assert decode.returncode==0,decode.stderr
a,b=audio_hash(src),audio_hash(dest)
assert a==b, 'Audio packets changed'
frames=[]
with av.open(str(dest)) as c:
    for i,f in enumerate(c.decode(video=0)):
        if i>=1786: frames.append((i,float(f.time),f.to_image().resize((480,270))))
assert len(frames)==12
canvas=Image.new('RGB',(1920,3*296),(20,24,24)); draw=ImageDraw.Draw(canvas)
for k,(i,t,im) in enumerate(frames):
    x=k%4*480;y=k//4*296;canvas.paste(im,(x,y));draw.text((x+5,y+274),f'E3 V3 {t:.6f}s f{i}',fill='white')
sheet=OUT/'E3-V3-last-12-frames.jpg';canvas.save(sheet,quality=92)
result={'id':'E3','source':str(src),'sourceSha256':sha(src),'path':str(dest),'sha256':sha(dest),
        'repair':'Replace frame 1797 at 74.875s (leaked V42 desk) with a clone of frame 1796 (empty cot).',
        'duration':1798/24,'videoCoverage':coverage,'fullDecodePassed':True,
        'audioPacketIdentity':a,'audioPacketsUnchanged':True,'userApproved':False,'gameIntegrated':False,
        'lastFrameSheet':str(sheet),'continuousHumanReview':False,'audioListening':False}
(OUT/'E3-tail-repair.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False),flush=True)
