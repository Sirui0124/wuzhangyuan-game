"""One-off repair of three authored silent-action endings; no runtime component."""
from pathlib import Path
import json, subprocess, hashlib, wave
import numpy as np
ROOT=Path.cwd(); OUT=ROOT/'video/production/ENDINGS-AUDIO-20261029'; OUT.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
SR=48000; DURATION=293/24; N=round(DURATION*SR)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
configPath=ROOT/'GameStarter/web-demo/public/cinematics.json';mediaPath=ROOT/'GameStarter/web-demo/public/video/media-manifest.json';emptyPath=ROOT/'video/subtitles/empty-tracks.json'
config=read(configPath);media=read(mediaPath);empty=read(emptyPath)
for p in [configPath,mediaPath,emptyPath,ROOT/'video/subtitles/catalog.json']:
 target=OUT/('before-'+p.name)
 if not target.exists(): target.write_bytes(p.read_bytes())
clips=[c for g in config.values() for c in g if c['id'] in ['C1END-EXEC','C1END-RADIO','C1END-ITEM']]
results=[]
def run(args): return subprocess.run([FF,'-v','error',*args],capture_output=True,check=True)
def video_hash(path): return run(['-i',str(path),'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).stdout.decode().strip()
for idx,clip in enumerate(clips):
 id=clip['id']; original=ROOT/'video/current'/f'{id}-integrated-20261025.mp4'; target=ROOT/'video/current'/f'{id}-foley-20261029.mp4'
 rng=np.random.default_rng(20261029+idx)
 def noise(n,lo,hi):
  frequencies=np.fft.rfftfreq(n,1/SR)
  spectrum=np.fft.rfft(rng.normal(size=n))
  weights=1/(1+(frequencies/hi)**4)
  if lo:weights*=1-1/(1+(frequencies/lo)**4)
  samples=np.fft.irfft(spectrum*weights,n)
  return samples/max(np.sqrt(np.mean(samples*samples)),1e-10)
 time=np.arange(N)/SR
 # A quiet unpitched wind bed; amplitude changes slowly, with no melody or voice samples.
 wind=noise(N,30,450)*(.006+.0015*np.sin(time*.7))
 mix=np.column_stack((wind,wind));events=[]
 def event(at,length,gain,lo,hi,label,pan=0):
  count=round(length*SR);s=noise(count,lo,hi)
  x=np.linspace(0,1,count);s*=np.sin(np.pi*x)**2*np.exp(-x*2)
  start=round(at*SR);end=min(N,start+count)
  if end<=start:return
  s=s[:end-start]*gain
  mix[start:end,0]+=s*(1-pan*.3);mix[start:end,1]+=s*(1+pan*.3)
  events.append({'at':at,'duration':length,'sound':label})
 for at in [1.2,3.8,6.6,9.7]:event(at,.075,.006,650,5200,'远处火盆轻响',-.5)
 if id=='C1END-EXEC':
  for i,at in enumerate(np.arange(1.8,11.5,.63)):
   event(float(round(at,3)),.22,.045*(1-i/25),35,800,'踏土脚步，随人物远离减弱',.5)
   event(float(round(at+.08,3)),.3,.009,400,4000,'衣甲轻擦',.3)
 elif id=='C1END-RADIO':
  for at in [2.2,3.0,4.1,5.1,5.8,6.5,7.25]:event(at,.2,.033,35,750,'营道脚步',.25)
  for at in [1.0,2.7,4.8,6.1,9.7]:event(at,.4,.012,400,4800,'转身与持物时衣甲轻擦')
  event(1.4,.14,.013,1500,7000,'设备一次短促电流底噪')
 else:
  for at,length in [(1.2,.7),(2.5,1.1),(4.1,.9),(5.7,.7)]:event(at,length,.018,400,5200,'袖口与布包擦动')
  event(1.65,.12,.035,40,550,'手部接触木案')
  for at in [7.4,8.2,9.1,10.0]:event(at,.22,.03,40,750,'转向营道脚步')
  for at in [7.0,8.8]:event(at,.45,.009,400,4000,'转身衣甲轻擦')
 fade=np.minimum(1,time/.12)*np.minimum(1,(DURATION-time)/.4);mix*=fade[:,None]
 peak=float(np.max(np.abs(mix)))
 if peak>.55:mix*=.55/peak
 wav=OUT/f'{id}-foley.wav'
 with wave.open(str(wav),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((mix*32767).astype('<i2').tobytes())
 run(['-y','-i',str(original),'-i',str(wav),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','160k','-movflags','+faststart','-shortest',str(target)])
 assert video_hash(original)==video_hash(target),'Video stream changed'
 run(['-i',str(target),'-f','null','-'])
 originalUrl=clip['src'];newUrl='/video/current/'+target.name
 row=next(c for c in media['clips'] if c['url']==originalUrl)
 assert sha(original)==row['sha256'],'Original asset changed during repair'
 record={'id':id,'title':clip['title'],'original':str(original),'originalSha256':sha(original),'replacement':str(target),'sha256':sha(target),'videoStreamUnchanged':True,'videoDuration':DURATION,'audioSource':str(wav),'audioRecipe':'Deterministic unpitched noise-based wind and Foley; no original audio, voice samples, TTS or music','events':events,'peakDbFS':round(20*np.log10(np.max(np.abs(mix))),2),'rmsDbFS':round(20*np.log10(np.sqrt(np.mean(mix*mix))),2),'userApproved':False}
 results.append(record)
 row.update(file='current/'+target.name,url=newUrl,source='../../video/current/'+target.name,bytes=target.stat().st_size,sha256=sha(target),containerDuration=round(DURATION,3),status='integrated-awaiting-human-review')
 clip['src']=newUrl
 disposition=next(e for e in empty['entries'] if e['id']==id)
 disposition.update(videoSha256=sha(target),status='planned-no-dialogue',reason='原稿要求无对白。本版移除原音轨，替换为单独合成的风声和动作拟音，无人声、无配乐；视频流原样复制。详见 video/production/ENDINGS-AUDIO-20261029/repair.json。',humanListeningReview=False)
for p,d in [(configPath,config),(mediaPath,media),(emptyPath,empty),(OUT/'repair.json',results)]:p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps([{k:r[k] for k in ['id','videoStreamUnchanged','peakDbFS','rmsDbFS','replacement']} for r in results],ensure_ascii=False,indent=2))
