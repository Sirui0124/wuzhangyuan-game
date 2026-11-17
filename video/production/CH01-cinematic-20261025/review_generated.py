from pathlib import Path
import json,subprocess,io,sys
import numpy as np
from PIL import Image,ImageDraw
from faster_whisper import WhisperModel
OUT=Path(__file__).parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
model=None
ids=set(sys.argv[1:])
audio_only='--audio-only' in ids
ids.discard('--audio-only')
for p in (OUT/'generated').glob('*-16x9.mp4'):
    id=p.name.removesuffix('-16x9.mp4')
    if ids and id not in ids:continue
    report=OUT/'audit'/(id+'-asr.json')
    if not report.exists():
        if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=6)
        pcm=subprocess.run([FF,'-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
        segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True)
        data=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in (s.words or [])]) for s in segs]
        report.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    else:data=json.loads(report.read_text(encoding='utf-8'))
    print(json.dumps(dict(id=id,transcript=[dict(start=s['start'],end=s['end'],text=s['text']) for s in data]),ensure_ascii=False),flush=True)
    if audio_only:continue
    delivery=json.loads((OUT/'generated'/(id+'-delivery.json')).read_text(encoding='utf-8'))
    duration=next(c['duration'] for c in json.loads((OUT/'production.json').read_text(encoding='utf-8'))['clips'] if c['id']==id)
    times=sorted(set([.1,duration-.1]+[min(duration-.1,x) for s in data for x in [s['start']+.1,(s['start']+s['end'])/2,s['end']-.1]]))
    # Six regular samples plus speech boundaries make lip ownership review possible.
    times=sorted(set(times+[duration*i/7 for i in range(1,7)]))
    w=320;h=203;cols=4;sheet=Image.new('RGB',(cols*w,((len(times)+cols-1)//cols)*h),'#111111');draw=ImageDraw.Draw(sheet)
    for i,t in enumerate(times):
        result=subprocess.run([FF,'-v','error','-ss',str(t),'-i',str(p),'-frames:v','1','-vf',f'scale={w}:-1','-f','image2pipe','-vcodec','png','pipe:1'],capture_output=True)
        im=Image.open(io.BytesIO(result.stdout)).convert('RGB');im.thumbnail((w,180));x=i%cols*w;y=i//cols*h
        sheet.paste(im,(x,y));draw.text((x+3,y+181),f'{id} {t:.2f}s',fill='white')
    sheet.save(OUT/'audit'/(id+'-review.jpg'))
