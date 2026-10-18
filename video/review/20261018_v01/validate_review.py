from pathlib import Path
import subprocess,json,re,hashlib,math
from PIL import Image,ImageDraw
import numpy as np
B=Path(__file__).resolve().parents[3];O=Path(__file__).parent;E=O/'evidence';M=json.loads((E/'edit-manifest.json').read_text());R=[]
for item in M:
 p=O/item['file'];probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(p)]));v=next(s for s in probe['streams'] if s['codec_type']=='video');a=next(s for s in probe['streams'] if s['codec_type']=='audio')
 decode=subprocess.run(['ffmpeg','-hide_banner','-loglevel','warning','-xerror','-i',str(p),'-map','0:v:0','-map','0:a:0','-f','null','-'],capture_output=True,text=True)
 detect=subprocess.run(['ffmpeg','-hide_banner','-i',str(p),'-vf','blackdetect=d=0.04:pix_th=0.10:pic_th=0.98','-an','-f','null','-'],capture_output=True,text=True)
 black=[dict(zip(['start','end','duration'],map(float,m))) for m in re.findall(r'black_start:(\S+) black_end:(\S+) black_duration:(\S+)',detect.stderr)]
 loud=subprocess.run(['ffmpeg','-hide_banner','-i',str(p),'-vn','-af','loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True).stderr;ld=json.JSONDecoder().raw_decode(loud[loud.rfind('{'):])[0]
 pcm=np.frombuffer(subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-i',str(p),'-vn','-ac','2','-ar','48000','-f','f32le','-']),dtype=np.float32);peak=float(np.max(np.abs(pcm)));clipcount=int(np.count_nonzero(np.abs(pcm)>=1));assert decode.returncode==0 and v['codec_name']=='h264' and a['codec_name']=='aac' and not black and clipcount==0
 row={'id':item['id'],'file':item['file'],'containerDuration':float(probe['format']['duration']),'videoDuration':float(v['duration']),'audioDuration':float(a['duration']),'avDurationDifference':abs(float(v['duration'])-float(a['duration'])),'fps':v['r_frame_rate'],'width':v['width'],'height':v['height'],'codecs':[v['codec_name'],a['codec_name']],'decodeExit':decode.returncode,'blackIntervals':black,'pcmPeak':peak,'samplesAtOrAboveFullScale':clipcount,'integratedLufs':float(ld['input_i']),'truePeakDb':float(ld['input_tp']),'lra':float(ld['input_lra']),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()};R.append(row);print(item['id'],row['containerDuration'],'LUFS',row['integratedLufs'],'peak',row['truePeakDb'],'AVdiff',row['avDurationDifference'],flush=True)
 folder=E/'frames'/(item['id']+'-edited-'+row['sha256'][:8]);folder.mkdir(exist_ok=True)
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(p),'-vf','select=not(mod(n\\,12)),scale=256:144','-fps_mode','vfr','-q:v','3',str(folder/'%03d.jpg')],check=True);imgs=sorted(folder.glob('*.jpg'));sheet=Image.new('RGB',(6*256,math.ceil(len(imgs)/6)*166),(18,18,18));d=ImageDraw.Draw(sheet)
 for i,f in enumerate(imgs):
  x=i%6*256;y=i//6*166;sheet.paste(Image.open(f),(x,y));d.text((x+4,y+146),f"{item['id']} edited {i/2:06.3f}",fill='white')
 sheet.save(E/(item['id']+'-edited-contact.jpg'),quality=92)
(E/'validation.json').write_text(json.dumps(R,ensure_ascii=False,indent=2))
# Complete original and current file bytes remain untouched.
protected=json.loads((E/'protected-before.json').read_text());checks={k:hashlib.sha256((B/k).read_bytes()).hexdigest()==v for k,v in protected.items()};assert all(checks.values())
for x in json.loads((E/'new-sources.json').read_text()):assert hashlib.sha256((B/x['path']).read_bytes()).hexdigest()==x['sha256']
(E/'protected-after.json').write_text(json.dumps({'unchanged':checks,'allSixRawSourcesUnchanged':True,'gamePathsAndCurrentUntouched':True},ensure_ascii=False,indent=2))
# Prove each recognizable source speech interval survives in full; raw tiny transcript is kept separate from script anchors.
coverage=[]
for item in M:
 for key in sorted({s['sourceId'] for s in item['segments']}):
  path=E/(key+'-transcript.json')
  if not path.exists():continue
  for line in json.loads(path.read_text())['segments']:
   if not line['text'].strip() or line['text'].strip() in ['surfaces','!']:continue
   a=float(line['start']);b=float(line['end']);kept=[s for s in item['segments'] if s['sourceId']==key and s['in']<=a+.1 and s['outExclusive']>=b-.1]
   s=kept[0] if kept else None
   coverage.append({'clip':item['id'],'source':key,'sourceSpeech':[a,b],'rawASR':line['text'],'fullyKept':bool(kept),'outputSpeech':[s['outputIn']+(a-s['in'])/s['speed'],s['outputIn']+(b-s['in'])/s['speed']] if s else None})
(E/'speech-coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2))
