"""Approved bedside edit. Retains old releases; subtitle words come from approved scripts."""
import json, pathlib, subprocess, hashlib, wave, shutil, re
R=pathlib.Path(__file__).resolve().parents[3]
P=pathlib.Path(__file__).resolve().parent
PUB=R/'GameStarter/web-demo/public'
FF=pathlib.Path('C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args):subprocess.run([str(FF),'-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)
def stamp(t):
 m=round(t*1000);return f'{m//3600000:02}:{m//60000%60:02}:{m//1000%60:02}.{m%1000:03}'
def cues(path):
 s=path.read_text(encoding='utf-8-sig');out=[]
 for a,b,text in re.findall(r'(\d+:\d+:\d+\.\d+) --> (\d+:\d+:\d+\.\d+)\n([^\n]+)',s):
  def sec(s):h,m,x=map(float,s.split(':'));return h*3600+m*60+x
  out.append(dict(start=sec(a),end=sec(b),text=text))
 return out
config=read(PUB/'cinematics.json');manifest=read(PUB/'video/media-manifest.json')
backup=P/'config-before.json'
if not backup.exists():save(backup,config);save(P/'media-before.json',manifest)
original=read(backup);orig={x['id']:x for x in original['chapterTwo']}
origmedia={x['url']:x for x in read(P/'media-before.json')['clips']}
def source(id):return R/'video/current'/pathlib.Path(orig[id]['src']).name
def originalcues(id):return cues(PUB/orig[id]['subtitles'].lstrip('/'))
stills=PUB/'video/stills';stills.mkdir(exist_ok=True)
entry=stills/'CH2-bedside-entry-20261025.png';bed=stills/'CH2-bedside-choice-20261025.png'
run(['-ss','54.833333','-i',source('CH2-V02'),'-frames:v',1,entry])
run(['-ss','5.416667','-i',source('CH2-V04'),'-frames:v',1,bed])
enc=['-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart']
patches=[]
def register(id,path,duration,cs,title,provenance):
 url='/video/current/'+path.name;sub='/video/subtitles/'+path.with_suffix('.vtt').name
 (PUB/sub.lstrip('/')).write_text('WEBVTT\n\n'+''.join(f'{i+1}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}\n\n' for i,c in enumerate(cs)),encoding='utf-8')
 patches.append(dict(id=id,src=url,title=title,subtitles=sub,duration=duration,sha256=sha(path),bytes=path.stat().st_size,cues=cs,provenance=provenance))
def static(id,audio,image,duration,cs,title,provenance):
 p=R/'video/current'/f'{id}-same-camera-20261025.mp4'
 run(['-loop','1','-framerate','24','-i',image,'-i',audio,'-map','0:v','-map','1:a','-t',duration,*enc,p])
 register(id,p,duration,cs,title,provenance)
# Hold the preceding actual camera during the two early player utterances.
v02=source('CH2-V02');anchors=[]
for t in [39.125,45.583333]:
 p=P/f'entry-before-{t}.png';run(['-ss',t,'-i',v02,'-frames:v',1,p]);anchors.append(p)
out=R/'video/current/CH2-V02-player-holds-20261025.mp4'
run(['-i',v02,'-loop','1','-i',anchors[0],'-loop','1','-i',anchors[1],'-filter_complex',"[0:v][1:v]overlay=enable='between(t,39.166667,41.25)'[v1];[v1][2:v]overlay=enable='between(t,45.625,47.25)'[v]",'-map','[v]','-map','0:a','-t',origmedia[orig['CH2-V02']['src']]['duration'],*enc,out])
register('CH2-V02',out,origmedia[orig['CH2-V02']['src']]['duration'],originalcues('CH2-V02'),'回忆与伤帐认人',dict(original=str(v02),sha256=sha(v02),holds=[[39.166667,41.25],[45.625,47.25]]))
for id in ['CH2-V03A','CH2-V03B']:
 static(id,source(id),entry,origmedia[orig[id]['src']]['duration'],originalcues(id),orig[id]['title'],dict(original=str(source(id)),still=str(entry),audio='retained original'))
out=R/'video/current/CH2-V04-before-choice-20261025.mp4'
duration=131/24
run(['-i',source('CH2-V04'),'-t',duration,*enc,out])
register('CH2-V04',out,duration,originalcues('CH2-V04')[:1],'五月饮酒自述',dict(original=str(source('CH2-V04')),cut=[0,duration]))
jobs={x['id']:x for x in read(P/'approved-lines.json')['jobs']}
def voice(id):
 state=read(P/(id+'-state.json'));sentences=state['subtitle']['sentences']
 assert ''.join(s['text'] for s in sentences)==jobs[id]['text'],id
 # The provider supplies times only. Every displayed word is checked against approved text.
 cs=[dict(start=s['start_time']/1000,end=s['end_time']/1000,text=s['text'],node=id) for s in sentences]
 return P/(id+'.wav'),state['duration'],cs
old=R/'video/production/CH02-films-20261025/groups/G1/user-review-20261025'
for suffix in ['A','B','C']:
 q,qd,qc=voice('CH2-LY02-Q'+suffix)
 if suffix!='C':a,ad,ac=voice('CH2-LY02-R'+suffix)
 else:
  a=old/'CH2-LY02-007-seed-audio1-reference.wav'
  with wave.open(str(a)) as w:ad=w.getnframes()/w.getframerate()
  ac=[dict(start=.1,end=ad-.1,text='我认栽，没什么委屈，养好伤就行了。',node='CH2-LY02-007')]
 combined=P/f'branch-{suffix}.wav'
 run(['-i',q,'-i',a,'-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1[a]','-map','[a]','-ar','48000','-ac','1',combined])
 static('CH2-V04'+suffix,combined,bed,qd+ad,qc+[dict(c,start=c['start']+qd,end=c['end']+qd) for c in ac],'伤帐回应'+suffix,dict(still=str(bed),voices=[str(q),str(a)],sourceRows=['CH2-LY02-Q'+suffix,'CH2-LY02-R'+suffix if suffix!='C' else 'CH2-LY02-007']))
a=old/'CH2-LY02-008-seed-audio1-reference.wav'
with wave.open(str(a)) as w:d=w.getnframes()/w.getframerate()
static('CH2-V04-END',a,bed,d,[dict(start=.1,end=d-.1,text='我没打算去魏国。',node='CH2-LY02-008')],'否认赴魏',dict(still=str(bed),voice=str(a)))
# Fresh reads preserve unrelated work completed during encoding.
config=read(PUB/'cinematics.json');manifest=read(PUB/'video/media-manifest.json')
for p in patches:
 c={k:p[k] for k in ['id','src','title','subtitles']}
 found=next((i for i,x in enumerate(config['chapterTwo']) if x['id']==p['id']),None)
 if found is None:config['chapterTwo'].append(c)
 else:config['chapterTwo'][found]=c
 manifest['clips']=[x for x in manifest['clips'] if x['url']!=p['src']]
 manifest['clips'].append(dict(file='current/'+pathlib.Path(p['src']).name,url=p['src'],source='../../video/current/'+pathlib.Path(p['src']).name,duration=p['duration'],bytes=p['bytes'],sha256=p['sha256'],status='integrated-awaiting-human-review'))
urls={x['src'] for group in config.values() for x in group}
manifest['clips']=[x for x in manifest['clips'] if x['url'] in urls]
save(PUB/'cinematics.json',config);save(PUB/'video/media-manifest.json',manifest)
save(P/'caption-manifest.json',patches)
print(json.dumps(dict(clips=len(patches),newVoices=len(jobs),humanListeningReview=False)))
