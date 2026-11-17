"""Read-only, hash-bound review evidence for the received Chapter Two update."""
from pathlib import Path
import hashlib, json, subprocess
import av
import numpy as np
from PIL import Image, ImageDraw
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs/ch2-video-update-20261027'
FF = 'C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
OUT.mkdir(parents=True, exist_ok=True)
model = None
rows = []
for source in sorted((ROOT / 'video/raw/1026视频更新').glob('*.mp4')):
    key = source.name.split('_')[0]
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    target = OUT / (key + '-review.json')
    if target.exists() and json.loads(target.read_text(encoding='utf-8'))['sha256'] == digest:
        rows.append(json.loads(target.read_text(encoding='utf-8')))
        continue
    with av.open(str(source)) as c:
        v = c.streams.video[0]
        meta = dict(duration=float(v.duration*v.time_base), containerDuration=c.duration/1e6,
                    width=v.width, height=v.height, fps=str(v.average_rate), frames=v.frames,
                    videoCodec=v.codec_context.name, hasAudioTrack=bool(c.streams.audio))
    subprocess.run([FF, '-v', 'error', '-i', str(source), '-f', 'null', '-'], check=True)
    frame_dir = OUT / (key + '-frames')
    frame_dir.mkdir(exist_ok=True)
    subprocess.run([FF, '-v', 'error', '-i', str(source), '-vf', 'fps=1,scale=384:216', '-y', str(frame_dir/'%03d.jpg')], check=True)
    frames = sorted(frame_dir.glob('*.jpg'))
    sheet = Image.new('RGB', (1536, 240*((len(frames)+3)//4)), '#202020')
    draw = ImageDraw.Draw(sheet)
    for i,p in enumerate(frames):
        x,y=i%4*384,i//4*240
        sheet.paste(Image.open(p),(x,y)); draw.text((x+8,y+219),f'{key} {i+.5:.1f}s',fill='white')
    sheet.save(OUT/(key+'-contact.jpg'))
    prior = ROOT/'outputs/subtitle-review-20261026/received'/(key+'.json')
    cached = json.loads(prior.read_text(encoding='utf-8')) if prior.exists() else {}
    if cached.get('sha256') == digest:
        segments=cached['segments']
    elif key == '01':
        segments=[]
    else:
        if model is None:
            model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=6)
        raw=subprocess.run([FF,'-v','error','-i',str(source),'-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],check=True,capture_output=True).stdout
        ss,info=model.transcribe(np.frombuffer(raw,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=False,condition_on_previous_text=False)
        segments=[dict(start=s.start,end=s.end,text=s.text,noSpeechProbability=s.no_speech_prob,
                       words=[dict(start=w.start,end=w.end,word=w.word) for w in s.words or []]) for s in ss]
    row=dict(id=key,source=str(source),sha256=digest,**meta,fullDecodePassed=True,
             segments=segments,method='full decode; 1fps visual evidence; local whisper-small audio locator',
             humanListeningReview=False,userApproved=False)
    target.write_text(json.dumps(row,ensure_ascii=False,indent=2),encoding='utf-8')
    rows.append(row)
    print(json.dumps(dict(id=key,**meta,segments=[(s['start'],s['end'],s['text']) for s in segments]),ensure_ascii=False),flush=True)
(OUT/'inventory.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
