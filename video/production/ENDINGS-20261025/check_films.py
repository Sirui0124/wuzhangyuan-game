"""Decode delivered media, normalize display geometry, and sample three frames per second."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parent
FF=Path('C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')

def ff(args):
    return subprocess.run([str(FF),'-hide_banner','-nostdin',*args],capture_output=True,text=True,encoding='utf-8',errors='replace')

reports=[]
visual=json.loads((ROOT/'visual-review.json').read_text(encoding='utf-8')) if (ROOT/'visual-review.json').exists() else {}
adoption=json.loads((ROOT/'adoption.json').read_text(encoding='utf-8')) if (ROOT/'adoption.json').exists() else {}
for s in json.loads((ROOT/'plan.json').read_text(encoding='utf-8')):
    take=adoption.get(s['id'],s['id'])
    raw=ROOT/'generated'/f"{take}.mp4"
    if not raw.exists(): continue
    target=ROOT/'films'/f"{take}-{s['name']}.mp4"
    target.parent.mkdir(exist_ok=True)
    if not target.exists():
        p=ff(['-i',str(raw),'-vf','scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24',
              '-c:v','libx264','-crf','18','-preset','medium','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart','-y',str(target)])
        if p.returncode: raise RuntimeError(p.stderr[-1800:])
    meta=ff(['-i',str(target)])
    decode=ff(['-v','error','-i',str(target),'-f','null','-'])
    review=ROOT/'review'
    review.mkdir(exist_ok=True)
    # Complete 0–12 second coverage at 3 frames/s; motion samples, not a listening review.
    contact=review/f"{take}-3fps.jpg"
    frames=ff(['-i',str(target),'-vf','fps=3,scale=320:180,tile=6x6','-frames:v','1','-q:v','2','-y',str(contact)])
    first=review/f"{take}-first.jpg"
    ff(['-i',str(target),'-frames:v','1','-q:v','2','-y',str(first)])
    duration=re.search(r'Duration: ([\d:.]+)',meta.stderr)
    report={'id':s['id'],'ending':s['ending'],'title':s['name'],'path':str(target),'source':str(raw),
            'take':take,'task':json.loads((ROOT/'tasks'/f"{take}.json").read_text(encoding='utf-8'))['task_id'],
            'duration':duration.group(1) if duration else None,'size':[1280,720], 'fps':24,
            'decode':'passed' if decode.returncode==0 and not decode.stderr.strip() else 'failed',
            'decodeErrors':decode.stderr,'audioPresent':'Audio:' in meta.stderr,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
            'motionSamples':str(contact),'visualReview':visual.get(take,{'decision':'pending'}),'audioReview':'not-listened','userApproved':False,'gameIntegrated':False}
    reports.append(report)
    print(s['id'],report['duration'],report['decode'])
(ROOT/'technical-review.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
