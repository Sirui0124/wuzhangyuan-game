from pathlib import Path
import json,subprocess,sys,hashlib
import numpy as np
from faster_whisper import WhisperModel
R=Path(__file__).resolve().parent
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
M=r'D:/AI视频/VJ-1106/motion-runtime/audio-analysis-env/models/models--Systran--faster-whisper-base/snapshots/ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66'
model=WhisperModel(M,device='cpu',compute_type='int8',cpu_threads=5)
allowed={'H02':['此乃我的私印，请你持此，速救主公。'],'H03':['御营败了，速去救驾！'],'H04':['降了，免死！','吴狗！何有汉将军降者！'],'H10':['你若见天际赤红，便须星夜速往救援。'],'H11':['若已无力挽回败局，也当尽力保全我军儿郎。'],'H18':['拉住我。']}
targets=sys.argv[1:]
for d in sorted(R.iterdir()):
 if not d.is_dir() or (targets and d.name not in targets) or not (d/'source.mp4').exists():continue
 out=d/'audio-ASR-unverified.json'
 if out.exists():continue
 raw=subprocess.check_output([FF,'-v','error','-i',str(d/'source.mp4'),'-vn','-f','f32le','-ac','1','-ar','16000','pipe:1'])
 audio=np.frombuffer(raw,dtype='<f4').copy()
 segments,info=model.transcribe(audio,language=None,beam_size=5,vad_filter=True,condition_on_previous_text=False)
 rows=[{'in':s.start,'out':s.end,'text':s.text,'no_speech_probability':s.no_speech_prob,'logprob':s.avg_logprob} for s in segments]
 val={'source_sha256':hashlib.sha256((d/'source.mp4').read_bytes()).hexdigest(),'method':'faster-whisper-base CPU int8; no expected script injected; VAD; automatic language','language':info.language,'language_probability':info.language_probability,'expected_lines':allowed.get(d.name,[]),'segments':rows,'rms_dbfs':float(20*np.log10(max(1e-9,np.sqrt(np.mean(audio**2))))),'peak_dbfs':float(20*np.log10(max(1e-9,np.max(np.abs(audio))))),'notice':'Machine locator only; not a transcript approval or proof of no music; inspect actual audio and lip/action timing.'}
 out.write_text(json.dumps(val,ensure_ascii=False,indent=2),'utf-8')
 print(json.dumps({'id':d.name,'lang':info.language,'segments':rows},ensure_ascii=False),flush=True)
