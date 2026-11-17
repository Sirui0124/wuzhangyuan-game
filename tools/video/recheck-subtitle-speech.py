"""Second-pass actual-audio locator. Does not publish captions or claim listening approval."""
from pathlib import Path
import json,subprocess,hashlib,sys
import numpy as np
from faster_whisper import WhisperModel
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'outputs/subtitle-review-20261026';(OUT/'asr').mkdir(parents=True,exist_ok=True)
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
rows=read(OUT/'audio-comparison.json')
targets=[x for x in rows if not x['cueCount'] or not x['asrEvidence'] or x['uncoveredWords']]
requested=sys.argv[1:]
if requested:targets=[x for x in rows if x['id'] in requested]
model=WhisperModel('small',device='cpu',compute_type='int8',local_files_only=True,cpu_threads=6)
ff='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
for x in targets:
    target=OUT/'asr'/(x['id']+'.json')
    if target.exists() and read(target).get('sha256')==x['sha256']:continue
    path=ROOT/'video/current'/Path(x['video']).name
    assert hashlib.sha256(path.read_bytes()).hexdigest()==x['sha256']
    proc=subprocess.run([ff,'-v','error','-i',str(path),'-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],capture_output=True)
    if proc.returncode:
        error=proc.stderr.decode('utf-8',errors='replace')
        if 'does not contain any stream' not in error:raise RuntimeError(error)
        target.write_text(json.dumps(dict(id=x['id'],video=x['video'],sha256=x['sha256'],method='ffmpeg confirms no audio stream',humanListeningReview=False,segments=[]),ensure_ascii=False,indent=2),encoding='utf-8')
        print(x['id']+': no audio stream',flush=True);continue
    samples=np.frombuffer(proc.stdout,dtype=np.float32)
    segs,info=model.transcribe(samples,language='zh',beam_size=5,word_timestamps=True,vad_filter=False,condition_on_previous_text=False)
    segments=[dict(start=s.start,end=s.end,text=s.text,noSpeechProbability=s.no_speech_prob,words=[dict(start=w.start,end=w.end,word=w.word) for w in s.words or []]) for s in segs]
    target.write_text(json.dumps(dict(id=x['id'],video=x['video'],sha256=x['sha256'],method='faster-whisper-small; VAD disabled; no prompt; actual current audio',humanListeningReview=False,segments=segments),ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(id=x['id'],segments=[(s['start'],s['end'],s['text'],round(s['noSpeechProbability'],2)) for s in segments]),ensure_ascii=False),flush=True)
