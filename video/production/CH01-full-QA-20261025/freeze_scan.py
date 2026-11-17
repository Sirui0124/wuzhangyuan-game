from pathlib import Path
import json,subprocess,re
from concurrent.futures import ThreadPoolExecutor
OUT=Path(__file__).parent;ROOT=OUT.parents[2]
FF='C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
def scan(item):
 r=subprocess.run([FF,'-hide_banner','-threads','2','-i',str(ROOT/item['src'].lstrip('/')),'-vf','scale=320:180,freezedetect=n=0.00003:d=1.5,blackdetect=d=0.15:pix_th=0.05','-an','-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace')
 lines=[s for s in r.stderr.splitlines() if 'freeze_' in s or 'black_start:' in s]
 assert r.returncode==0
 return dict(id=item['id'],index=item['index'],events=lines,decode='passed')
with ThreadPoolExecutor(max_workers=3) as pool:result=list(pool.map(scan,json.loads((OUT/'inventory.json').read_text(encoding='utf-8'))))
(OUT/'audit/freeze-black-decode.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
for r in result:
 if r['events']:print(r['index'],r['id'],' | '.join(r['events']))
