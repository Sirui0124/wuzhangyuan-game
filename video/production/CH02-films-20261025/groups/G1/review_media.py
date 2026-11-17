"""Technical/ASR aids only. Visual and listening conclusions require inspection."""
from pathlib import Path
import json,subprocess,math,sys,io
import numpy as np
from PIL import Image,ImageDraw
from faster_whisper import WhisperModel
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
model=None;selected=set(sys.argv[1:]);plan=read(OUT/'plan.json');(OUT/'review').mkdir(exist_ok=True)
if (OUT/'repair-plan.json').exists():plan['clips']+=read(OUT/'repair-plan.json')['clips']
for c in plan['clips']:
    cid=c['id']
    if selected and cid not in selected:continue
    p=OUT/'edited'/f'{cid}-normalized.mp4'
    if not p.exists():continue
    tech=read(OUT/'generated'/f'{cid}-technical.json');dur=tech['output']['duration'];dest=OUT/'review'/f'{cid}-asr.json'
    if not dest.exists():
        if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=2)
        pcm=subprocess.run([FF,'-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
        segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,condition_on_previous_text=False)
        data=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in (s.words or [])]) for s in segs]
        dest.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    else:data=read(dest)
    print(json.dumps(dict(id=cid,audioMode=c['audioMode'],duration=dur,transcript=[dict(start=s['start'],end=s['end'],text=s['text']) for s in data]),ensure_ascii=False),flush=True)
    # Full ordered 2fps sample, precise times shown under every frame.
    sheet=OUT/'review'/f'{cid}-sequence.jpg'
    if not sheet.exists():
        ts=[min(dur-.05,.05+i*.5) for i in range(math.ceil(dur*2))];w=320;h=198;cols=4
        canvas=Image.new('RGB',(w*cols,h*math.ceil(len(ts)/cols)),'#121212');draw=ImageDraw.Draw(canvas)
        for i,t in enumerate(ts):
            r=subprocess.run([FF,'-v','error','-ss',str(t),'-i',str(p),'-frames:v','1','-vf',f'scale={w}:-1','-f','image2pipe','-vcodec','png','pipe:1'],capture_output=True,check=True)
            im=Image.open(io.BytesIO(r.stdout)).convert('RGB');x=i%cols*w;y=i//cols*h;canvas.paste(im,(x,y));draw.text((x+3,y+181),f'{cid} {t:.2f}s',fill='white')
        canvas.save(sheet,quality=85)
    # A dedicated player for inspecting the actual moving source, no game state.
    html=OUT/'review'/f'{cid}.html'
    html.write_text(f'<!doctype html><meta charset="utf-8"><title>G1 {cid} dynamic review</title><style>body{{background:#151515;color:#eee;font:18px sans-serif}}video{{width:min(95vw,1280px);display:block}}p{{margin:6px}}</style><h3>{cid} · actual motion · {dur:.2f}s</h3><video controls playsinline src="../edited/{cid}-normalized.mp4"></video><p>Space：播放/暂停；逐句听审与口型审核不得以ASR代替。</p>',encoding='utf-8')
