from pathlib import Path
import json, subprocess, hashlib, wave, re
import numpy as np
import av

ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
SOURCE=ROOT/'video/current/C1T05-05-QA-20261025.mp4'
DEST=ROOT/'video/current/C1T05-05-A29-seed-audio-20261025.mp4'
RATE=48000
def pcm(path, channels=2):
    raw=subprocess.check_output([FF,'-v','error','-i',str(path),'-vn','-ac',str(channels),'-ar',str(RATE),'-f','f32le','pipe:1'])
    return np.frombuffer(raw,dtype=np.float32).reshape(-1,channels).copy()
def wav(path,a):
    with wave.open(str(path),'wb') as w:
        w.setnchannels(a.shape[1]);w.setsampwidth(2);w.setframerate(RATE);w.writeframes((np.clip(a,-1,1)*32767).astype('<i2').tobytes())
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def video_packets(path):
    with av.open(str(path)) as c:
        return [hashlib.sha256(bytes(p)).hexdigest() for p in c.demux(video=0) if p.size]

original=pcm(SOURCE); voice=pcm(OUT/'A-29-player-seed-audio-v1.wav',1)
# Preserve the full generated take, including breath and consonant attacks; original speed/pitch.

old=original[round(5.25*RATE):round(8.85*RATE)].mean(axis=1)
active_old=old[np.abs(old)>.01];active_new=voice[np.abs(voice)>.01]
gain=min(float(np.sqrt(np.mean(active_old**2))/np.sqrt(np.mean(active_new**2))),.94/float(np.abs(voice).max()))
voice*=gain
fade=round(.008*RATE);voice[:fade]*=np.linspace(0,1,fade)[:,None];voice[-fade:]*=np.linspace(1,0,fade)[:,None]
wav(OUT/'A-29-player-seed-audio-matched.wav',voice)
mix=original.copy();start,end=round(5.23*RATE),round(9.375*RATE);ramp=round(.015*RATE)
mix[start:start+ramp]*=np.linspace(1,0,ramp)[:,None];mix[start+ramp:end-ramp]=0;mix[end-ramp:end]*=np.linspace(0,1,ramp)[:,None]
offset=round(5.25*RATE);mix[offset:offset+len(voice)]+=voice
assert np.abs(mix).max()<=1
assert np.array_equal(mix[:start],original[:start]) and np.array_equal(mix[round(9.6*RATE):],original[round(9.6*RATE):])
wav(OUT/'film-audio.wav',mix)
with av.open(str(SOURCE)) as c: duration=float(c.streams.video[0].duration*c.streams.video[0].time_base)
subprocess.run([FF,'-v','error','-y','-i',str(SOURCE),'-i',str(OUT/'film-audio.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(duration),'-movflags','+faststart',str(DEST)],check=True)
subprocess.run([FF,'-v','error','-i',str(DEST),'-f','null','NUL'],check=True)
assert video_packets(SOURCE)==video_packets(DEST)
new=pcm(DEST);outside=np.concatenate([np.arange(round(5.1*RATE)),np.arange(round(9.7*RATE),min(len(new),len(original)))])
corr=float(np.corrcoef(original[outside].ravel(),new[outside].ravel())[0,1]);assert corr>.99
subtitle=ROOT/'GameStarter/web-demo/public/video/subtitles/C1T05-05-A29-seed-audio-20261025.vtt'
old_sub=ROOT/'GameStarter/web-demo/public/video/subtitles/C1T05-05-QA-20261025.vtt'
text=old_sub.read_text(encoding='utf8');assert '00:00:04.860 --> 00:00:08.920' in text
subtitle.write_text(text.replace('00:00:04.860 --> 00:00:08.920','00:00:05.620 --> 00:00:09.290'),encoding='utf8')
record={'node':'A-29','source':str(SOURCE),'sourceSha256':sha(SOURCE),'result':str(DEST),'sha256':sha(DEST),'duration':duration,'bytes':DEST.stat().st_size,'reference':'source-art/audio/voice-clone/20261023/player-reference.wav','model':'seed-audio-1.0','generation':'generation.json','speechOnlyTrim':None,'insertAt':5.25,'replacementWindow':[5.23,9.6],'oldVoiceMutedWindow':[5.23,9.375],'gain':gain,'speed':1,'pitchUnchanged':True,'videoPacketsIdentical':True,'outsideWindowPcmUnchangedBeforeEncode':True,'outsideWindowCorrelationAfterEncode':corr,'fullDecodePassed':True,'subtitle':str(subtitle),'reviewStatus':'待用户试听，ASR与技术检查不代表听审通过'}
(OUT/'edit.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(record,ensure_ascii=False))

