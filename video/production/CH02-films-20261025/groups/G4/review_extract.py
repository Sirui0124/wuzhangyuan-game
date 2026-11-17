"""Technical and ASR evidence only; never labels ASR as human listening."""
from pathlib import Path
import json,subprocess,re,io,sys,difflib
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
def norm(t):return re.sub(r'[^\u4e00-\u9fffa-zA-Z0-9]','',t)
frames_only='--frames-only' in sys.argv
selected=set(x for x in sys.argv[1:] if x!='--frames-only');model=None
clips=read(OUT/'plan.json')['clips']+(read(OUT/'retake-plan.json')['clips'] if (OUT/'retake-plan.json').exists() else [])
for c in clips:
    cid=c['id'];p=OUT/'generated'/f'{cid}-16x9.mp4';folder=OUT/'review'/cid
    if selected and cid not in selected:continue
    if not p.exists() or not (OUT/'generated'/f'{cid}-delivery.json').exists():continue
    folder.mkdir(parents=True,exist_ok=True)
    d=read(OUT/'generated'/f'{cid}-delivery.json')['duration']
    # Dense temporal evidence supplements playback, does not replace motion review.
    if not (folder/'timeline.jpg').exists():
        ts=[round(.15+i*.5,2) for i in range(int(d*2)) if .15+i*.5<d-.05]
        cols=5;rows=(len(ts)+cols-1)//cols
        sheet=Image.new('RGB',(cols*320,rows*202),'#151515');draw=ImageDraw.Draw(sheet)
        for i,t in enumerate(ts):
            r=subprocess.run([FF,'-v','error','-ss',str(t),'-i',str(p),'-frames:v','1','-vf','scale=320:180','-f','image2pipe','-vcodec','png','pipe:1'],capture_output=True)
            if not r.returncode and r.stdout:
                im=Image.open(io.BytesIO(r.stdout)).convert('RGB');x=(i%cols)*320;y=(i//cols)*202;sheet.paste(im,(x,y));draw.text((x+5,y+183),f'{cid}  {t:.2f}s',fill='white')
        sheet.save(folder/'timeline.jpg',quality=88)
        save(folder/'timeline.json',dict(times=ts,method='0.5秒间隔连续时序抽帧；仅辅助动态审片'))
    if frames_only:continue
    if not (folder/'asr.json').exists():
        from faster_whisper import WhisperModel
        if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=2,local_files_only=True)
        import numpy as np
        pcm=subprocess.run([FF,'-v','error','-i',str(p),'-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],capture_output=True,check=True).stdout
        segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,vad_filter=True,word_timestamps=True)
        segs=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word,probability=w.probability) for w in s.words or []]) for s in segs]
        actual=''.join(s['text'] for s in segs);expected='' if c['silent'] or c.get('audioOverlay') else ''.join(l['text'] for l in c['lines'])
        ratio=difflib.SequenceMatcher(None,norm(expected),norm(actual)).ratio() if expected else (1 if not actual else 0)
        save(folder/'asr.json',dict(id=cid,expected=expected,postVoiceText=''.join(l['text'] for l in c['lines']) if c.get('audioOverlay') else None,actual=actual,similarity=ratio,segments=segs,limitation='ASR仅辅助定位；不能证明口型/说话人/逐字听审/BGM通过。'))
        print(json.dumps(dict(id=cid,expected=expected,actual=actual,similarity=round(ratio,3)),ensure_ascii=False),flush=True)
