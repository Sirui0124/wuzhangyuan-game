"""Read-only ASR locator for the exact delivered ending revisions."""
from pathlib import Path
import hashlib, json, subprocess, os
import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'review' / 'batch2-audio'
OUT.mkdir(parents=True, exist_ok=True)
FF = 'C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def save(p, value):
    temp = p.with_suffix('.pending')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    os.replace(temp, p)

delivery = json.loads((ROOT/'delivery.json').read_text('utf-8'))
save(OUT/'input-delivery.json', delivery)
model = None
for row in delivery['films'] + delivery.get('epilogues', []):
    path = Path(row['path'])
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest == row['sha256'], row['id']
    target = OUT/(row['id']+'-'+digest[:12]+'.json')
    if target.exists():
        print('CACHED', row['id'], flush=True)
        continue
    if model is None:
        model = WhisperModel('small', device='cpu', compute_type='int8', local_files_only=True, cpu_threads=2)
    pcm = subprocess.run([FF,'-v','error','-i',str(path),'-f','f32le','-ac','1','-ar','16000','pipe:1'], capture_output=True, check=True).stdout
    segments, info = model.transcribe(np.frombuffer(pcm, dtype=np.float32), language='zh', beam_size=5, word_timestamps=True, vad_filter=True, condition_on_previous_text=False)
    rows = [dict(start=s.start,end=s.end,text=s.text,avg_logprob=s.avg_logprob,no_speech_prob=s.no_speech_prob,words=[dict(start=w.start,end=w.end,text=w.word) for w in s.words or []]) for s in segments]
    result = dict(id=row['id'],file=str(path),sha256=digest,duration=row['duration'],segments=rows,audioListening=False,userApproved=False,limitation='ASR locator only. Does not establish actual wording, voice identity, lip sync, or absence of music.')
    save(target,result)
    print(row['id'],json.dumps([dict(start=x['start'],end=x['end'],text=x['text']) for x in rows],ensure_ascii=False),flush=True)
