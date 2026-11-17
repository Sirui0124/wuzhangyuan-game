from pathlib import Path
import json,subprocess,time,sys,re,difflib
import numpy as np
from faster_whisper import WhisperModel
OUT=Path(__file__).parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=2,local_files_only=True)
def clean(t):return re.sub(r'[^\u4e00-\u9fff]','',t)
while True:
    plan=json.loads((OUT/'plan.json').read_text(encoding='utf-8'))
    for c in plan['clips']:
        p=OUT/'generated'/f'{c["id"]}-raw.mp4';dest=OUT/'review'/c['id']/'asr.json'
        if not p.exists() or not (OUT/'generated'/f'{c["id"]}-technical.json').exists() or dest.exists():continue
        audio=subprocess.run([FF,'-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','16000','pipe:1'],capture_output=True,check=True).stdout
        segs,info=model.transcribe(np.frombuffer(audio,dtype=np.float32),language='zh',initial_prompt='简体中文普通话。',beam_size=5,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
        data=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in s.words or []]) for s in segs]
        actual=''.join(s['text'] for s in data)
        expected=c['sourceLines'][0]['text'] if c['kind']=='dialogue' and not c.get('voice') else ''
        ratio=difflib.SequenceMatcher(None,clean(expected),clean(actual)).ratio() if expected else 1 if not clean(actual) else 0
        report=dict(id=c['id'],expected=expected,recognized=actual,similarity=ratio,segments=data,flag='check_dialogue' if ratio<.85 else 'ASR_no_major_difference',note='ASR仅辅助定位，不等于逐字听审、BGM检测或用户通过')
        dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(c['id'],round(ratio,3),actual,flush=True)
    if '--watch' not in sys.argv:break
    if all((OUT/'review'/c['id']/'asr.json').exists() for c in plan['clips']):break
    time.sleep(25)
