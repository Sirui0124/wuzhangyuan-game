from pathlib import Path
import importlib.util,json,subprocess,sys,hashlib
import numpy as np
R=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('mdx_local',R.parent/'PV-redesign-20261115-v2/separate_background.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def separate(mix):
 L=mix.shape[1];trim=m.N//2;data=np.pad(mix,((0,0),(trim,m.C)));result=np.zeros_like(data);div=np.zeros(data.shape[1],np.float32)
 for start in range(0,L+trim,m.C//2):
  part=data[:,start:start+m.C];actual=part.shape[1]
  if actual<m.C:part=np.pad(part,((0,0),(0,m.C-actual)))
  x=m.stft(part);x[:,:,:3,:]=0;y=m.inverse(m.session.run(None,{'input':x})[0])*1.022
  w=np.hanning(m.C).astype(np.float32);w[0]=w[-1]=1e-6
  result[:,start:start+actual]+=y[:,:actual]*w[:actual];div[start:start+actual]+=w[:actual]
 result/=np.maximum(div,1e-8)
 return result[:,trim:trim+L]
for id in sys.argv[1:]:
 d=R/id;src=d/'source.mp4';dest=d/'ambience-separated.wav'
 if dest.exists():continue
 raw=subprocess.check_output([m.FF,'-v','error','-i',str(src),'-vn','-f','f32le','-ar','44100','-ac','2','pipe:1']);mix=np.frombuffer(raw,'<f4').reshape(-1,2).T.copy()
 bed=separate(mix)
 subprocess.run([m.FF,'-v','error','-y','-f','f32le','-ar','44100','-ac','2','-i','pipe:0','-ar','48000','-c:a','pcm_s24le',str(dest)],input=bed.T.astype('<f4').tobytes(),check=True)
 if id=='H09':
  # Preserve all original breaths and physical sound before the stray speech; treat only its tail.
  t=np.arange(mix.shape[1])/44100;weight=np.clip((t-9.4)/.15,0,1)[None,:];repaired=mix*(1-weight)+bed*weight
  out=d/'audio-repaired.wav'
  subprocess.run([m.FF,'-v','error','-y','-f','f32le','-ar','44100','-ac','2','-i','pipe:0','-ar','48000','-c:a','pcm_s24le',str(out)],input=repaired.T.astype('<f4').tobytes(),check=True)
 else:out=dest
 (d/'audio-repair.json').write_text(json.dumps({'source':str(src),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'output':str(out),'method':'local MDX nonvocal candidate; preserve native outside known unwanted speech','applied_interval':([9.4,mix.shape[1]/44100] if id=='H09' else 'non-dialogue action portion only; clean warning provided by H03B'),'not_music_removal_proof':True,'no_new_music':True,'model':str(m.MODEL),'user_review':'pending'},ensure_ascii=False,indent=2),'utf-8')
 print(id+' audio repair prepared',flush=True)
