"""ASR is a locator only, never an audio/lip approval."""
from pathlib import Path
import json,subprocess,sys
import numpy as np
from faster_whisper import WhisperModel
OUT=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
selected=set(sys.argv[1:]);model=None
plan=json.loads((OUT/'plan.json').read_text(encoding='utf-8'))
for c in plan['requests']+plan.get('retries',[]):
    if selected and c['id'] not in selected:continue
    p=OUT/'generated'/f"{c['id']}-16x9.mp4";report=OUT/'review'/f"{c['id']}-asr.json"
    if not p.exists():continue
    if report.exists():data=json.loads(report.read_text(encoding='utf-8'))
    else:
        if model is None:model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=4)
        pcm=subprocess.run([FF,'-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
        segs,info=model.transcribe(np.frombuffer(pcm,dtype=np.float32),language='zh',beam_size=5,word_timestamps=True,vad_filter=True)
        data=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in s.words or []]) for s in segs]
        report.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(id=c['id'],strategy=c['audioStrategy'],expected=[l['text'] for l in c['lines'] if l['spoken']],asr=[dict(start=s['start'],end=s['end'],text=s['text']) for s in data],review='ASR辅助定位，未听审'),ensure_ascii=False),flush=True)
