from pathlib import Path
import json,subprocess,numpy as np
from faster_whisper import WhisperModel
OUT=Path(__file__).parent;ROOT=OUT.parents[2]
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def raw(path,args):
 r=subprocess.run([FF,'-v','error','-i',str(path),*args,'pipe:1'],capture_output=True);assert r.returncode==0;return r.stdout
repairs=json.loads((OUT/'local-repairs.json').read_text(encoding='utf-8'))+json.loads((OUT/'generated-repairs.json').read_text(encoding='utf-8'))
opening=Path(next(r['file'] for r in repairs if r['index']==1))
old=ROOT/'video/current/PR01-DEF-20261024-77fc2fdd.mp4'
pixels=lambda p:np.frombuffer(raw(p,['-vf','scale=64:36','-pix_fmt','rgb24','-f','rawvideo']),dtype=np.uint8).reshape(-1,36,64,3)
a=pixels(old)[:720];b=pixels(opening)[-720:];err=np.abs(a.astype(np.float32)-b.astype(np.float32)).mean()
assert len(a)==len(b)==720 and err<4
pcm=lambda p:np.frombuffer(raw(p,['-vn','-ac','1','-ar','6000','-f','f32le']),dtype=np.float32).copy()
a=pcm(old)[:180000];b=pcm(opening)[-180000:];a-=a.mean();b-=b.mean();n=1<<((len(a)+len(b)-2).bit_length())
corr=np.fft.irfft(np.fft.rfft(b,n)*np.conj(np.fft.rfft(a,n)),n);lags=np.arange(-1200,1201);lag=int(lags[np.argmax(corr[lags%n])])
if lag>=0:aa,bb=a[:len(a)-lag],b[lag:]
else:aa,bb=a[-lag:],b[:len(b)+lag]
coefficient=float(np.dot(aa,bb)/np.sqrt(np.dot(aa,aa)*np.dot(bb,bb)))
assert coefficient>.98
proof=dict(passed=True,modernSource=str(old),comparedFrames=720,meanPixelError=float(err),audioCorrelation=coefficient,audioOffsetSeconds=lag/6000,subjectiveListening=False)
(OUT/'audit/modern-preservation.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2),encoding='utf-8')
print('Modern full 30s preservation:',proof,flush=True)
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=6,local_files_only=True)
for r in repairs:
 p=OUT/'audit'/f'fixed-{r["index"]}-asr.json'
 samples=np.frombuffer(raw(Path(r['file']),['-vn','-ac','1','-ar','16000','-f','f32le']),dtype=np.float32)
 segs,_=model.transcribe(samples,language='zh',beam_size=4,word_timestamps=True,vad_filter=True,condition_on_previous_text=False)
 data=[dict(start=s.start,end=s.end,text=s.text,words=[dict(start=w.start,end=w.end,word=w.word) for w in s.words or []]) for s in segs]
 p.write_text(json.dumps({'segments':data,'note':'自动识别仅定位，不作逐字听审、口型验收或用户通过结论'},ensure_ascii=False,indent=2),encoding='utf-8')
 print(r['index'],' | '.join(x['text'] for x in data),flush=True)
