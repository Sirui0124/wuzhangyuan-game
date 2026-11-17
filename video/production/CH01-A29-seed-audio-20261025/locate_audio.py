from pathlib import Path
import subprocess,numpy as np,json

F='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def pcm(p,af=None):
 a=[F,'-v','error','-i',str(p),'-vn','-ac','1','-ar','24000'];a+=['-af',af] if af else [];a+=['-f','f32le','pipe:1'];return np.frombuffer(subprocess.check_output(a),dtype=np.float32)
a=pcm('video/current/C1T05-05-QA-20261025.mp4');b=pcm('video/review/20261023-process/C1T05/player-voice-fix/A-29-player.wav','atempo=1.15');lo=round(4.6*24000);hi=round(10.7*24000);n=1<<((hi-lo+len(b)-2).bit_length());c=np.fft.irfft(np.fft.rfft(a[lo:hi],n)*np.conj(np.fft.rfft(b,n)),n)[:hi-lo-len(b)+1];i=int(c.argmax());start=(lo+i)/24000;seg=a[lo+i:lo+i+len(b)];r=float(np.dot(seg,b)/np.sqrt(np.dot(seg,seg)*np.dot(b,b)));print(json.dumps({'oldTtsAlignment':start,'oldTtsDuration':len(b)/24000,'correlation':r}));
active=np.where(abs(b)>.01)[0];print(json.dumps({'oldVoiceActiveStart':start+active[0]/24000,'oldVoiceActiveEnd':start+active[-1]/24000}));
Path('video/production/CH01-A29-seed-audio-20261025/old-audio-alignment.json').write_text(json.dumps({'start':start,'duration':len(b)/24000,'correlation':r,'activeStart':start+active[0]/24000,'activeEnd':start+active[-1]/24000},indent=2))

