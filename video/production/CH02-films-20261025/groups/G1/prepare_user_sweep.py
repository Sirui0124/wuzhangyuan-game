from user_repair import *
from PIL import Image,ImageDraw
import html,math
groups=[['V01','V03B','V04','V05'],['V09','V11T','V11D','V11R','V11A']]
for batch,sids in enumerate(groups,1):
 rows=[]
 for sid in sids:
  a=rd(O/'assembled'/f'{sid}-assembly.json');file=Path(a['path']);length=dur(file)
  times=list(range(0,int(length),2))+[length-.5]
  sheet=Image.new('RGB',(1200,math.ceil(len(times)/4)*188),(12,12,12));draw=ImageDraw.Draw(sheet)
  for i,t in enumerate(times):
   f=D/'inspection'/f'{sid}-sweep-t{i:02}.jpg';run(['-ss',t,'-i',file,'-frames:v','1','-vf','scale=300:168',f]);sheet.paste(Image.open(f),(i%4*300,i//4*188));draw.text((i%4*300+3,i//4*188+170),f'{sid} {t:.2f}s',fill='white')
  sheet.save(D/'inspection'/f'{sid}-user-sweep.jpg',quality=92)
  src=html.escape('../'+file.relative_to(O).as_posix(),quote=True);rows.append(f'<section><h3>{sid}</h3><video muted controls preload="auto" src="{src}"></video><p></p></section>')
 page='''<!doctype html><meta charset="utf-8"><style>body{background:#151515;color:white;font:16px sans-serif}main{display:grid;grid-template-columns:1fr 1fr;gap:8px}video{width:100%}h3,p{margin:4px}</style><button onclick="document.querySelectorAll('video').forEach(v=>{v.currentTime=0;v.play()})">播放新标准画面核对</button><main>'''+''.join(rows)+'''</main><script>document.querySelectorAll('video').forEach(v=>{const p=v.nextElementSibling;setInterval(()=>p.textContent=v.currentTime.toFixed(2)+'/'+v.duration.toFixed(2)+(v.ended?' ended':''),100)})</script>'''
  # Own G1 helper only, no central user-review frontend changes.
 (O/'review'/f'user-sweep-{batch}.html').write_text(page,encoding='utf-8')
print('two sweep pages ready')
