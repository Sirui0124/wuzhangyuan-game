"""Local MDX inference; original tracks untouched. Candidate, not certified clean stems.
Model metadata and inference contract from Anjok07/ultimatevocalremovergui.
No torch dependency: NumPy STFT reproduces center=True, Hann, unnormalised FFT.
"""
from pathlib import Path
import json,hashlib,subprocess
import numpy as np
import onnxruntime as ort
from scipy.signal import resample_poly
from numpy.lib.stride_tricks import sliding_window_view
R=Path(__file__).resolve().parent;T=R.parents[2]/'tmp/pv-tools'
FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'
MODEL=T/'UVR-MDX-NET-Inst_HQ_3.onnx';N=6144;H=1024;F=3072;C=H*255
window=np.hanning(N+1)[:-1].astype(np.float32)
opts=ort.SessionOptions();opts.intra_op_num_threads=6;opts.inter_op_num_threads=1
session=ort.InferenceSession(str(MODEL),sess_options=opts,providers=['CPUExecutionProvider'])
def stft(x):
 y=np.pad(x,((0,0),(N//2,N//2)),mode='reflect')
 frames=sliding_window_view(y,N,axis=-1)[:,::H,:]
 z=np.fft.rfft(frames*window,axis=-1).transpose(0,2,1)
 return np.stack([z.real,z.imag],axis=1).reshape(1,4,N//2+1,256).astype(np.float32)[:,:,:F,:]
def inverse(x):
 z=x.reshape(2,2,F,256);z=z[:,0]+1j*z[:,1]
 z=np.pad(z,((0,0),(0,N//2+1-F),(0,0)))
 frames=np.fft.irfft(z.transpose(0,2,1),n=N,axis=-1).astype(np.float32)*window
 out=np.zeros((2,C+N),np.float32);den=np.zeros(C+N,np.float32)
 for j in range(256):out[:,j*H:j*H+N]+=frames[:,j];den[j*H:j*H+N]+=window**2
 out/=np.maximum(den,1e-8)
 return out[:,N//2:N//2+C]
def main():
 src=R/'v2-原生声音按新剪点对齐.wav'
 raw=subprocess.check_output([FF,'-v','error','-i',str(src),'-f','f32le','-ar','44100','-ac','2','pipe:1'])
 mix=np.frombuffer(raw,'<f4').reshape(-1,2).T.copy();L=mix.shape[1]
 # Verify transform independently with a round trip before neural inference.
 x=np.pad(mix[:,:min(C,L)],((0,0),(0,max(0,C-L))))
 back=inverse(stft(x));err=float(np.sqrt(np.mean((back-x)**2)))
 assert err<0.001,err
 trim=N//2;data=np.pad(mix,((0,0),(trim,C)))
 result=np.zeros_like(data);div=np.zeros(data.shape[1],np.float32);step=C//2
 for idx,start in enumerate(range(0,L+trim,step)):
  part=data[:,start:start+C];actual=part.shape[1]
  if actual<C:part=np.pad(part,((0,0),(0,C-actual)))
  spec=stft(part);spec[:,:,:3,:]=0
  pred=session.run(None,{'input':spec})[0]
  y=inverse(pred)*1.022
  w=np.hanning(C).astype(np.float32);w[0]=w[-1]=1e-6
  result[:,start:start+actual]+=y[:,:actual]*w[:actual];div[start:start+actual]+=w[:actual]
  print(f'background separation {idx+1} at {start/44100:.1f}s',flush=True)
 result/=np.maximum(div,1e-8);background=result[:,trim:trim+L]
 out=R/'v2-背景声分离候选.wav'
 subprocess.run([FF,'-v','error','-y','-f','f32le','-ar','44100','-ac','2','-i','pipe:0','-ar','48000','-c:a','pcm_s24le',str(out)],input=background.T.astype('<f4').tobytes(),check=True)
 final=R/'开篇PV-v2-92秒-分镜预演-背景声候选.mp4'
 subprocess.run([FF,'-v','error','-y','-i',str(R/'work/v2-picture-only.mp4'),'-i',str(out),'-map','0:v:0','-map','1:a:0','-c:v','copy','-af','alimiter=limit=0.794:level=false:latency=true','-c:a','aac','-b:a','192k','-t','92','-movflags','+faststart',str(final)],check=True)
 (R/'background-separation.json').write_text(json.dumps({'source':str(src),'output':str(final),'model':str(MODEL),'model_sha256':hashlib.sha256(MODEL.read_bytes()).hexdigest(),'metadata_md5_last_10MiB':hashlib.md5(MODEL.read_bytes()[-10000*1024:]).hexdigest(),'primary_stem':'Instrumental','transform_roundtrip_rmse':err,'compensate':1.022,'sample_rate':44100,'source_pcm_duration':L/44100,'output_picture_seconds':92,'notice':'音乐人声分离模型用于背景声候选；可能损失呼吸/马嘶/撞击并残留人声，不声称干净环境声。未增加BGM。旧混音、分离候选与图片均待review。','human_audio_review':'pending'},ensure_ascii=False,indent=2),'utf-8')
 print(str(final),flush=True)
if __name__=='__main__':main()
