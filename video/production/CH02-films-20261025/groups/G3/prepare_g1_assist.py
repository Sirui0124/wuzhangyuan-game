from pathlib import Path
import json,subprocess,hashlib,datetime,math,re
from PIL import Image,ImageDraw,ImageFont
O=Path(__file__).resolve().parent;G=O.parent/'G1';R=O/'review';A=R/'G1-assist';A.mkdir(exist_ok=True)
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
ids=['L01-01','V11T-01','V11D-01','V11R-01','V11A-01','V11N-01','V12-01','V12-02','V12-03']
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
P=read(G/'plan.json');C={c['id']:c for c in P['clips']}
reportpath=R/'G1-template-assist-review.json'
report=read(reportpath) if reportpath.exists() else dict(scope='G1本地只读协助；不调用API，不改G1文件或运行器，无TTS或生成请求',clips={})
for id in ids:
 src=G/'generated'/f'{id}-raw.mp4'
 if not src.exists():continue
 h=hashlib.sha256(src.read_bytes()).hexdigest();row=report['clips'].get(id,{})
 if row.get('sourceSha256')==h:continue
 probe=subprocess.run([FF,'-hide_banner','-i',str(src)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
 m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',probe);duration=int(m[1])*3600+int(m[2])*60+float(m[3])
 f=A/id;f.mkdir(exist_ok=True)
 subprocess.run([FF,'-v','error','-y','-i',str(src),'-vf','fps=3,scale=320:-1',str(f/'%04d.jpg')],check=True)
 frames=sorted(f.glob('*.jpg'));w,hh=Image.open(frames[0]).size;im=Image.new('RGB',(w*5,(hh+24)*math.ceil(len(frames)/5)),'#111');d=ImageDraw.Draw(im)
 for n,p in enumerate(frames):
  x=n%5*w;y=n//5*(hh+24);im.paste(Image.open(p),(x,y));d.text((x+4,y+hh+3),f'{n/3:.2f}s',fill='white')
 contact=A/f'{id}-3fps.jpg';im.save(contact,quality=88)
 row.update(sourcePath=str(src),sourceMtimeLocal=datetime.datetime.fromtimestamp(src.stat().st_mtime).astimezone().isoformat(),sourceSha256=h,sourceBytes=src.stat().st_size,duration=duration,sourceLines=C[id]['sourceLines'],plannedState=dict(entry=C[id]['entryState'],end=C[id]['endState'],shots=C[id]['shots']),contactSheet=str(contact),visualReview='pending',actualPlayback=False,audioIssues=['本次不逐字听审；音频仅标记，纯音频不建议付费重拍'])
 report['clips'][id]=row
report['notYetDownloaded']=[id for id in ids if id not in report['clips']];report['updatedLocal']=datetime.datetime.now().astimezone().isoformat()
reportpath.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
rows=[dict(id=id,file=f'/G1/generated/{id}-raw.mp4') for id in ids if id in report['clips']]
html='''<!doctype html><meta charset="utf-8"><title>G1只读协助审片</title><style>body{background:#151515;color:#eee;font:16px sans-serif}video{width:1000px;max-width:95vw}pre{white-space:pre-wrap}button{padding:12px}</style><h2>G1本地只读审片</h2><button id="go">播放本批</button><video controls muted id="v"></video><pre id="s"></pre><pre id="log"></pre><script>
let clips=ROWS;let q=new URLSearchParams(location.search).get('only');if(q)clips=clips.filter(c=>q.split(',').includes(c.id));let i=0,v=document.querySelector('video'),log=[];
function play(){v.src=clips[i].file;v.play()};document.querySelector('button').onclick=play;
v.addEventListener('ended',()=>{let played=[];for(let j=0;j<v.played.length;j++)played.push([v.played.start(j),v.played.end(j)]);log.push({...clips[i],duration:v.duration,played,ended:true});document.querySelector('#log').textContent=JSON.stringify(log,null,2);i++;if(i<clips.length)play()});setInterval(()=>document.querySelector('#s').textContent=(clips[Math.min(i,clips.length-1)]?.id||'')+' '+v.currentTime.toFixed(2)+' / '+(v.duration||0).toFixed(2)+' '+(v.ended?'ended':v.paused?'paused':'playing'),100);
</script>'''.replace('ROWS',json.dumps(rows))
(R/'G1-assist-player.html').write_text(html,encoding='utf-8')
print(json.dumps(dict(prepared=list(report['clips']),missing=report['notYetDownloaded']),ensure_ascii=False))
