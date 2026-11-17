from pathlib import Path
import json,subprocess,numpy as np
OUT=Path(__file__).parent;ROOT=OUT.parents[2]
record=json.loads((OUT/'edit-record.json').read_text(encoding='utf-8'))
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def raw(src,args):return subprocess.run([FF,'-v','error','-i',str(src),*args,'pipe:1'],capture_output=True,check=True).stdout
modern=Path(record['restoredModern']['source']);final=Path(record['file'])
frames=lambda p:np.frombuffer(raw(p,['-map','0:v:0','-vf','scale=64:36','-pix_fmt','rgb24','-f','rawvideo']),dtype=np.uint8).reshape(-1,36,64,3)
expected=frames(modern)[:720].astype(np.float32);actual=frames(final)[-720:].astype(np.float32)
errors=np.abs(expected-actual).mean(axis=(1,2,3));assert errors.mean()<4,errors.mean()
audio=lambda p:np.frombuffer(raw(p,['-map','0:a:0','-ac','1','-ar','6000','-f','f32le']),dtype=np.float32)
old=audio(modern)[:180000];new=audio(final)[-180000:]
# Codec delay can shift a few samples; verify waveform content without changing it.
nfft=1<<((len(new)+len(old)-2).bit_length())
corr=np.fft.irfft(np.fft.rfft(new,nfft)*np.conj(np.fft.rfft(old,nfft)),nfft)
lags=np.arange(-1200,1201);lag=int(lags[np.argmax(corr[lags%nfft])])
if lag>=0:x,y=new[lag:],old[:len(new)-lag]
else:x,y=new[:len(new)+lag],old[-lag:]
coefficient=float(np.dot(x,y)/(np.linalg.norm(x)*np.linalg.norm(y)))
assert coefficient>.98,coefficient
report=dict(passed=True,modernSource=str(modern),sourceFrames=720,comparedFinalFrames=720,
            meanPixelError64x36=float(errors.mean()),maxFrameMeanPixelError=float(errors.max()),
            audioCorrelation=coefficient,audioOffsetSeconds=lag/6000,audioRmsRatio=float(np.sqrt(np.mean(x*x)/np.mean(y*y))),
            note='现代段末720帧和原声波形对应；仅发布缩放与编码，未替换配音、重排或变速。反应镜头96帧图格另行视觉核对。')
(OUT/'audit/restored-modern-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
