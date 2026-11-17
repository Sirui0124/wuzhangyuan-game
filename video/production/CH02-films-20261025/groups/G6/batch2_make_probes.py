from pathlib import Path
import json,subprocess,hashlib,av
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'user-review-batch2'
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
films={f['id']:f for f in json.loads((OUT/'baseline-delivery.json').read_text(encoding='utf-8'))['films']}
# Parent times are measured on the frozen encoded audio/video, not old draft estimates.
cuts={
'CH2-E2-002':('V38',[[13.83,17.70],[21.40,25.90]]),
'CH2-LY12A-003':('V39',[[13.45,17.80]]),
'CH2-LY12A-005':('V40',[[6.30,8.32],[9.95,11.51]]),
'CH2-LY12A-008':('V40',[[28.52,31.62]]),
'CH2-LY12A-009':('V40',[[37.25,40.96]]),
'CH2-LY07-BAD2':('V41E',[[14.98,16.56]]),
'CH2-E4-LATE-001':('V41L',[[1.42,4.66],[5.08,7.99],[9.65,13.18],[13.82,17.40]]),
'CH2-E4-LATE-002':('V41L',[[19.90,25.45]])}
records=[]
for node,(fid,ranges) in cuts.items():
    p=Path(films[fid]['path']);dest=OUT/(node+'-original-clean-probe.wav')
    fs=[];labels=[]
    for i,(a,b) in enumerate(ranges):fs.append(f'[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[a{i}]');labels.append(f'[a{i}]')
    fs.append(''.join(labels)+f'concat=n={len(ranges)}:v=0:a=1[a]')
    subprocess.run([FF,'-v','error','-y','-i',str(p),'-filter_complex',';'.join(fs),'-map','[a]','-ac','1','-ar','48000','-c:a','pcm_s16le',str(dest)],check=True)
    records.append(dict(node=node,film=fid,source=str(p),sourceSha256=films[fid]['sha256'],originalRanges=ranges,path=str(dest),sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),review='candidate word windows only; ASR and actual listening pending'))
(OUT/'original-voice-probes.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
for fid in ['V38','V39','V40','V41E','V41L','V43']:
    p=Path(films[fid]['path']);frames=[];nextt=0
    with av.open(str(p)) as c:
        for f in c.decode(video=0):
            t=float(f.pts*f.time_base)
            if t+.001<nextt:continue
            im=f.to_image();im.thumbnail((320,180));frames.append((t,im));nextt+=1
    for page in range((len(frames)+23)//24):
        ss=frames[page*24:page*24+24];sheet=Image.new('RGB',(1280,((len(ss)+3)//4)*205),'#181818');d=ImageDraw.Draw(sheet)
        for i,(t,im) in enumerate(ss):x=i%4*320;y=i//4*205;sheet.paste(im,(x,y));d.text((x+5,y+183),f'{fid} baseline {t:.3f}',fill='white')
        sheet.save(OUT/f'{fid}-baseline-sheet-{page+1}.jpg')
print(json.dumps(dict(probes=len(records),newRequests=0)))
