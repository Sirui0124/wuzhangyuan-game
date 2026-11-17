from pathlib import Path
import json,hashlib,sys
OUT=Path(__file__).resolve().parents[1];ROOT=OUT.parents[2]
sys.path.insert(0,'C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools')
from video_api import atomic_json
rows=[]
for p in sorted((OUT/'references/results').glob('*.json')):
 d=json.loads(p.read_text(encoding='utf-8'));assert Path(d['path']).is_file();assert hashlib.sha256(Path(d['path']).read_bytes()).hexdigest()==d['sha256']
 d.update(ready=True,status='ready',visualReview='根任务已逐张对照现片检查；无明显穿帮，可用于生成候选，非用户批准')
 if d['id'] in ['仓吏','仓中经手人','粮队管事','前线接收人','信使']:d['constraint']='只取前景单人身份，忽略/不得复制背景其他人、粮袋数量与文字；环境由空间图决定'
 if d['id']=='书房':d['constraint']='以低案席坐设计正式场面，避免放大参考图中高背椅；其余锁左窗、右书架、旧木与灯位'
 rows.append(d)
assert len(rows)==15
atomic_json(OUT/'references/manifest.json',{'version':1,'ready':True,'status':'ready','model':'gpt-image-2','provider':'OpenAI Next','assets':rows,'byId':{d['id']:d for d in rows},'note':'15张均实际生成且逐张目视核对；主要身份从现片延续，新次要角色统一创建；参考不是用户最终批准'})
print('15 references ready')
