"""Bounded, reproducible offline review evidence; never claims human playback."""
from pathlib import Path
import sys,json,subprocess,hashlib,math
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
sys.path.insert(0,str(R))
from assemble_endings import video_coverage
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def sample(path,label,fps=3):
 out=R/'review/pace-v2'/label;out.mkdir(parents=True,exist_ok=True)
 p=subprocess.run([FF,'-v','error','-nostdin','-i',str(path),'-vf',f'fps={fps},scale=384:216','-q:v','3','-y',str(out/'%04d.jpg')],capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace'))
 frames=sorted(out.glob('[0-9][0-9][0-9][0-9].jpg'));sheets=[]
 for offset in range(0,len(frames),24):
  canvas=Image.new('RGB',(1536,6*240),(20,24,24));draw=ImageDraw.Draw(canvas)
  for k,frame in enumerate(frames[offset:offset+24]):
   x=k%4*384;y=k//4*240
   canvas.paste(Image.open(frame),(x,y));draw.text((x+8,y+219),f'{label} {(offset+k)/fps:.2f}s',fill='white')
  dest=out/f'sheet-{offset//24+1:02d}.jpg';canvas.save(dest,quality=87);sheets.append(str(dest))
 return dict(path=str(path),sha256=sha(path),samplingFPS=fps,sampleCount=len(frames),sheets=sheets,method='全时段定频抽帧；非实时完整动态观看，非音频听审')
def verify():
 d=read(R/'delivery.json');rows=d['films']+d['epilogues'];records=[]
 for r in rows:
  path=Path(r['path']);assert sha(path)==r['sha256']
  coverage=video_coverage(path,r['duration'])
  p=subprocess.run([FF,'-v','info','-i',str(path),'-vf','blackdetect=d=0.08:pix_th=0.10:pic_th=0.98','-an','-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace')
  black=[s for s in p.stderr.splitlines() if 'black_start:' in s]
  assert p.returncode==0 and not black,(r['id'],black)
  if r['id']=='E1':assert abs(r['duration']-60)<0.05
  if r['id'] in ['E1','E3']:assert 'V42' not in r['slots']
  for e in r.get('editDecisionList',[]):
   assert sha(Path(e['path']))==e['sourceSha256']
  records.append(dict(id=r['id'],sha256=r['sha256'],duration=r['duration'],fullDecode=coverage,blackIntervals=black,userApproved=False,realTimePlaybackReview=False,audioListening=False))
 assert len(d['films'])==6 and len(d['epilogues'])==1
 page=(R/'审片.html').read_text(encoding='utf-8');assert page.count('<video ')==7
 out=dict(scope='新剪辑7个文件；完整解码、视频轨覆盖、黑场检测、来源哈希核对及全时段抽帧另列',records=records)
 (R/'review/pace-v2/technical-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Seven files checked; E1 60s; epilogue independent; no detected black intervals')
if __name__=='__main__':
 if sys.argv[1]=='verify':verify()
 else:
  result=sample(Path(sys.argv[1]),sys.argv[2],float(sys.argv[3]) if len(sys.argv)>3 else 3)
  p=R/'review/pace-v2'/sys.argv[2]/'sampling.json';p.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
  print(json.dumps(result,ensure_ascii=False))
