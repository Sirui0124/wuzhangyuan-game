"""Remove confirmed director speech, retain the happy ending and essential order handoff."""
from pathlib import Path
import json, hashlib, subprocess, av
from PIL import Image, ImageDraw
R=Path(__file__).resolve().parent
D=R/'review/batch2-audio'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,v): p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
old=R/'films/E1-一起回头-60秒-V2.mp4'
assert sha(old)=='a75c9ac47dca27ae5675103d371c579e753bbca6b72843c32781fbb08f2bc013'
new=R/'films/E1-一起回头-54秒-V3.mp4'
start=138/24;end=1435/24
# The order handoff is an essential visible action, not an invented silent filler.
filters=f"[0:v]trim=start_frame=138:end_frame=1435,setpts=PTS-STARTPTS[v];[0:a]volume=0:enable='between(t,{1011/24},{1099/24})',atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a]"
subprocess.run([FF,'-v','error','-nostdin','-i',str(old),'-filter_complex',filters,'-map','[v]','-map','[a]','-c:v','libx264','-threads','2','-crf','18','-preset','fast','-r','24','-fps_mode','cfr','-c:a','aac','-ar','48000','-b:a','192k','-t',str(end-start),'-movflags','+faststart','-y',str(new)],check=True)
subprocess.run([FF,'-v','error','-i',str(new),'-f','null','-'],capture_output=True,check=True)
c=av.open(str(new));v=c.streams.video[0];count=sum(1 for _ in c.decode(video=0));c.close()
assert count==1297,count
times=[0,.25,7.9,8,15.8,24.8,35.9,36.375,37.25,38.25,39.25,40.041667,42.7,44.6,48.5,52.5]
c=av.open(str(new));sheet=Image.new('RGB',(1280,808));draw=ImageDraw.Draw(sheet);j=0
for f in c.decode(video=0):
 t=float(f.pts*f.time_base)
 if j<len(times) and t>=times[j]:
  x=(j%4)*320;y=(j//4)*202;sheet.paste(f.to_image().resize((320,180)),(x,y));draw.text((x+4,y+181),f'{t:.4f}s',fill='white');j+=1
c.close();sheet.save(D/'E1-V3-review.jpg')
save(D/'E1-repair-candidate.json',dict(id='E1',oldPath=str(old),oldSha256=sha(old),oldDuration=60.0,path=str(new),sha256=sha(new),duration=round(end-start,6),decodedFrames=count,decodePassed=True,removedRanges=[dict(start=0,end=start,reason='Confirmed director action text 先收齐才谈核实 and preceding excess reaction; whitelist starts around 6.01s'),dict(start=end,end=60,reason='Remove audio-only container padding after final video frame')],essentialActionAudioCleanup=dict(originalRange=[1011/24,1099/24],newRange=[1011/24-start,1099/24-start],reason='No dialogue allowed in V36-06; retain actual order handoff, remove unwanted voice. No frozen/looped filler.'),preserved=['All formal receipt and disposition dialogue','Happy Gou An greeting, smiling reaction and turning to cart','Final legal inner voice and shared cart action'],ownerEvidence='G5 V36-02 and V36-06 confirmed source SHA and batch2 EDL supplied by owner',newGeneration=False,newTTS=False,audioListening=False,userApproved=False,gameIntegrated=False))
print(new,sha(new),count,flush=True)
