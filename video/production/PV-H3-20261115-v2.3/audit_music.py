from pathlib import Path
import json,subprocess,sys,types,hashlib
import numpy as np
import onnxruntime as ort
R=Path(__file__).resolve().parent;T=R.parents[2]/'tmp/pv-tools'
# Official Apache-2.0 NumPy feature implementation, with unused package import stubbed.
code=(T/'ast_audio_utils.py').read_text('utf-8').replace('from .utils import is_librosa_available, requires_backends','def is_librosa_available(): return False\ndef requires_backends(*a, **k): raise RuntimeError("unused backend")')
u=types.ModuleType('ast_numpy');exec(compile(code,str(T/'ast_audio_utils.py'),'exec'),u.__dict__)
mf=u.mel_filter_bank(257,128,20,8000,16000,norm=None,mel_scale='kaldi',triangularize_in_mel_space=True)
window=u.window_function(400,'hann',periodic=False)
opts=ort.SessionOptions();opts.intra_op_num_threads=4;opts.inter_op_num_threads=1
s=ort.InferenceSession(str(T/'ast/onnx/model_quantized.onnx'),sess_options=opts,providers=['CPUExecutionProvider'])
labels=json.loads((T/'ast/config.json').read_text('utf-8'))['id2label']
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
for id in sys.argv[1:]:
 d=R/id;p=d if d.is_file() else d/'source.mp4'
 out=p.with_suffix('.events.json') if d.is_file() else d/'audio-events-unverified.json'
 sha=hashlib.sha256(p.read_bytes()).hexdigest()
 if out.exists() and json.loads(out.read_text('utf-8')).get('source_sha256')==sha:continue
 raw=subprocess.check_output([FF,'-v','error','-i',str(p),'-vn','-f','f32le','-ar','16000','-ac','1','pipe:1'])
 x=np.frombuffer(raw,'<f4').copy();results=[]
 for start in range(0,len(x),16000*8):
  wave=x[start:start+16000*10]
  if len(wave)<16000:continue
  f=u.spectrogram(wave,window,400,160,fft_length=512,power=2.0,center=False,preemphasis=.97,mel_filters=mf,log_mel='log',mel_floor=1.192092955078125e-7,remove_dc_offset=True).T
  f=np.pad(f,((0,max(0,1024-len(f))),(0,0)))[:1024];f=((f+4.2677393)/(4.5689974*2)).astype(np.float32)[None]
  logits=s.run(None,{s.get_inputs()[0].name:f})[0].reshape(-1);probs=1/(1+np.exp(-logits))
  top=np.argsort(probs)[-12:][::-1]
  results.append(dict(start=start/16000,top=[dict(label=labels[str(int(i))],p=round(float(probs[i]),4)) for i in top],music=round(float(probs[next(int(k) for k,v in labels.items() if v=='Music')]),4)))
 value=dict(source_sha256=sha,model='Xenova/ast-finetuned-audioset-10-10-0.4593 quantized ONNX; official numpy fbank',scope='machine audio event screening, not listening approval',windows=results)
 out.write_text(json.dumps(value,ensure_ascii=False,indent=2),'utf-8');print(json.dumps(dict(id=id,windows=results),ensure_ascii=False),flush=True)

