from pathlib import Path
import json,subprocess,hashlib,importlib.util,av
OUT=Path(__file__).resolve().parent;ROOT=OUT/'user-review-20261025'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
old=Path(next(f['path'] for f in read(OUT/'delivery.json')['films'] if f['id']=='V38'))
source=OUT/'generated/V41E-01-16x9.mp4'
child=OUT/'edited/V38-02-ending-reuse.mp4'
newchild=ROOT/'V38-02-无字闭卷修版.mp4';new=ROOT/'V38-救下眼前的人-去元文书R3.mp4'
def encode(original,dest,pre,end,total):
    # Frame-index boundaries preserve every unaffected frame's original position.
    filt='[1:v]trim=start_frame=17:end_frame=243,scale=1280:720,setsar=1,settb=1/24000,setpts=N*1000[b]'
    labels='[b]';n=1
    if pre:
        filt=f'[0:v]trim=start_frame=0:end_frame={pre},scale=1280:720,setsar=1,settb=1/24000,setpts=N*1000[a];'+filt
        labels='[a][b]';n=2
    if end<total:
        filt+=f';[0:v]trim=start_frame={end}:end_frame={total},scale=1280:720,setsar=1,settb=1/24000,setpts=N*1000[c]';labels+='[c]';n=3
    filt+=';'+labels+f'concat=n={n}:v=1:a=0,settb=1/24000,setpts=N*1000[v]'
    subprocess.run([FF,'-v','error','-y','-i',str(original),'-i',str(source),'-filter_complex',filt,'-map','[v]','-map','0:a:0','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-r','24','-fps_mode','cfr','-video_track_timescale','24000','-c:a','copy','-movflags','+faststart',str(dest)],check=True)
encode(child,newchild,0,226,226)
encode(old,new,226,452,819)
def audio_packets(p):
    with av.open(str(p)) as c:return [hashlib.sha256(bytes(pkt)).hexdigest() for pkt in c.demux(audio=0) if pkt.size]
assert audio_packets(old)==audio_packets(new),'Original complete audio must remain identical'
spec=importlib.util.spec_from_file_location('track',OUT/'track_integrity.py');t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
track=t.inspect(new);assert track['videoFrames']==819 and track['fullVideoTrack']
info=dict(oldFile=str(old),oldSha256=hashlib.sha256(old.read_bytes()).hexdigest(),newFile=str(new),newSha256=hashlib.sha256(new.read_bytes()).hexdigest(),replacedFrameRange=[226,452],replacedTimeRange=[226/24,452/24],pictureSource=str(source),sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),sourceFrameRange=[17,243],newChild=str(newchild),newChildSha256=hashlib.sha256(newchild.read_bytes()).hexdigest(),completeOriginalAudioPacketHashesIdentical=True,videoTrack=track,newVideoRequests=0,newTTSRequests=0,reviewState='awaiting-visual-review-do-not-adopt-yet')
(ROOT/'V38-local-repair.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(info,ensure_ascii=False))
