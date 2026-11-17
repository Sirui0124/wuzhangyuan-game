from user_repair import *
from PIL import Image,ImageDraw
import html

# The generated paper acquires glyphs after 4.3s. Keep only the complete,
# clean take-and-hold action. No further request or concealment layer.
v=voice['CH2-LY02-015'];p=D/'V06-仅保留干净拿纸动作-R1.mp4'
if not p.exists():
 run(['-i',O/'edited/V06-UR1-normalized.mp4','-i',v['path'],'-filter_complex','[0:v]trim=end=4,setpts=(PTS-STARTPTS)/0.8[v];[1:a]adelay=300:all=1,apad,atrim=duration=5[a]','-map','[v]','-map','[a]','-r','24','-c:v','libx264','-crf','18','-preset','fast','-c:a','aac','-ar','48000','-movflags','+faststart',p])
r=rd(reportpath)
if not any(x['id']=='V06' for x in r.get('globalRepairs',[])):
 old=snapshot['V06'];r.setdefault('globalRepairs',[]).append(dict(id='V06',requirement='20261025-no-meta-no-cards-no-boxes',oldFile=old['file'],oldSha256=old['sha256'],oldInterval=[0,dur(old['file'])],newFile=str(p),newSha256=sha(p),newDuration=dur(p),status='candidate-awaiting-real-check',treatment='新生成镜头只取0–4秒完整干净拿纸/持纸动作，以0.8倍播放；4.3秒后伪字全段弃用，无局部模糊/遮罩；完整复用既有心声。',details=dict(source=str(O/'edited/V06-UR1-normalized.mp4'),sourceSha256=sha(O/'edited/V06-UR1-normalized.mp4'),sourceRange=[0,4],rate=.8,voice=v),userApproved=False))
save(reportpath,r)
rows=[]
for sid in ['V02','V06','V08A','V10']:
 x=next((z for z in r['comments'] if z['id']==sid and z.get('newFile')),None) or next(z for z in r['globalRepairs'] if z['id']==sid)
 file=Path(x['newFile']);length=dur(file)
 q=subprocess.run([F,'-v','info','-i',str(file),'-vf','blackdetect=d=0.1:pix_th=0.10','-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace')
 save(D/'inspection'/f'{sid}-technical.json',dict(file=str(file),sha256=sha(file),decode=q.returncode==0,blackEvents=[z for z in q.stderr.splitlines() if 'black_start:' in z]))
 assert q.returncode==0
 times=[0,.5,1,1.5,2,2.5,3,3.5,4,4.5,4.9] if sid=='V06' else [0,2,4,5,8,12,min(15,length-.5),max(0,length/2),length-.5]
 sheet=Image.new('RGB',(960, int((len(times)+2)/3)*200),(10,10,10));draw=ImageDraw.Draw(sheet)
 for i,t in enumerate(times):
  f=D/'inspection'/f'{sid}-user-t{i:02}.jpg';run(['-ss',t,'-i',file,'-frames:v','1','-vf','scale=320:180',f]);sheet.paste(Image.open(f),(i%3*320,i//3*200));draw.text((i%3*320+4,i//3*200+181),f'{sid} {t:.2f}s',fill='white')
 sheet.save(D/'inspection'/f'{sid}-user-sequence.jpg',quality=90)
 src=html.escape('../'+file.relative_to(O).as_posix(),quote=True)
 rows.append(f'<section><h3>{sid}</h3><video controls muted preload="auto" src="{src}"></video><p></p></section>')
page='''<!doctype html><meta charset="utf-8"><style>body{background:#151515;color:white;font:16px sans-serif}main{display:grid;grid-template-columns:1fr 1fr;gap:8px}video{width:100%}p{margin:4px}h3{margin:4px}</style><button onclick="document.querySelectorAll('video').forEach(v=>{v.currentTime=0;v.play()})">播放四个返修候选</button><main>'''+''.join(rows)+'''</main><script>document.querySelectorAll('video').forEach(v=>{const p=v.nextElementSibling;setInterval(()=>p.textContent=v.currentTime.toFixed(2)+'/'+v.duration.toFixed(2)+(v.ended?' ended':''),100)})</script>'''
(O/'review/user-repair-more.html').write_text(page,encoding='utf-8')
print('four candidates decoded; full sequences and own playback page ready')
