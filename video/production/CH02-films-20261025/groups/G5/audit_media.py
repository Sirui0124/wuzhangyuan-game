"""Continuous timed frame sequences and ASR aids; never label ASR as listening."""
from pathlib import Path
import sys,json,subprocess,io,math
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).parent
sys.path.insert(0,str(OUT))
from run_pipeline import FF,read,save,metadata
font=ImageFont.truetype('C:/Windows/Fonts/simhei.ttf',18)
def sheets(c,source=None):
    src=Path(source) if source else OUT/'generated'/f'{c["id"]}-16x9.mp4'
    if not src.exists():return
    folder=OUT/'review'/c['id'];folder.mkdir(parents=True,exist_ok=True)
    # Every 0.25s throughout, not isolated highlights; inspect temporal contact sequence.
    duration=metadata(src)['duration'];times=[round(t*.25,2) for t in range(math.ceil(duration*4))]
    framefolder=folder/'frames';framefolder.mkdir(exist_ok=True)
    if not (framefolder/'000001.jpg').exists():
        subprocess.run([str(FF),'-v','error','-i',str(src),'-vf','fps=4,scale=384:216','-q:v','3',str(framefolder/'%06d.jpg')],check=True)
    files=sorted(framefolder.glob('*.jpg'))
    result=[]
    for first in range(0,len(files),20):
        path=folder/f'sequence-{first//20+1:02d}.jpg'
        if not path.exists():
            sheet=Image.new('RGB',(1536,1205),'#171717');d=ImageDraw.Draw(sheet)
            for n,p in enumerate(files[first:first+20]):
                x=(n%4)*384;y=(n//4)*241
                sheet.paste(Image.open(p).convert('RGB'),(x,y))
                d.text((x+5,y+217),f'{c["id"]} {((first+n)/4):05.2f}s',font=font,fill='white')
            sheet.save(path,quality=88)
        result.append(str(path.resolve()))
    save(folder/'sequence-index.json',dict(id=c['id'],source=str(src.resolve()),duration=duration,sampling='continuous 4fps timed sequence, auxiliary to motion audit',frames=len(files),sheets=result,visualReview='pending model inspection',audioListening='未逐字听审'))
    print(json.dumps(dict(id=c['id'],sheets=result),ensure_ascii=False),flush=True)
def transcribe(plan):
    from faster_whisper import WhisperModel
    candidates=list(Path('C:/Users/zhousirui/.cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots').glob('*/model.bin'))
    model_path=max(candidates,key=lambda p:p.stat().st_size).parent
    model=WhisperModel(str(model_path),device='cpu',compute_type='int8',cpu_threads=4,num_workers=1,local_files_only=True)
    for c in plan:
        src=OUT/'generated'/f'{c["id"]}-16x9.mp4';folder=OUT/'review'/c['id'];folder.mkdir(parents=True,exist_ok=True)
        target=folder/'asr.json'
        if not src.exists() or target.exists():continue
        try:
            import numpy as np
            decoded=subprocess.run([str(FF),'-v','error','-i',str(src),'-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],capture_output=True,check=True)
            waveform=np.frombuffer(decoded.stdout,dtype=np.float32)
            segments,info=model.transcribe(waveform,language='zh',beam_size=5,vad_filter=True,word_timestamps=True)
            rows=[dict(start=s.start,end=s.end,text=s.text,avg_logprob=s.avg_logprob,no_speech_prob=s.no_speech_prob) for s in segments]
            save(target,dict(id=c['id'],segments=rows,text=''.join(s['text'] for s in rows),expected=[dict(node=x['node'],text=x['text']) for x in c['generatedSpokenLines']],warning='ASR辅助不是逐字听审，不能仅凭谐音判错，也不证明无BGM',voiceMatch='未主观听审'))
            print(c['id'],''.join(s['text'] for s in rows),flush=True)
        except Exception as e:print(c['id'],'ASR error',str(e),flush=True)
if __name__=='__main__':
    selected=set(sys.argv[2:]);all_clips=read(OUT/'plan.json')['clips']+(read(OUT/'repair-plan.json')['clips'] if (OUT/'repair-plan.json').exists() else []);plan=[c for c in all_clips if not selected or c['id'] in selected]
    if sys.argv[1]=='asr':transcribe(plan)
    else:
        for c in plan:sheets(c)
