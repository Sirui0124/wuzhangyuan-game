from pathlib import Path
import importlib.util,json,time,urllib.parse
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('review_server',ROOT/'scripts/review_server.py')
server=importlib.util.module_from_spec(spec);spec.loader.exec_module(server)
state=server.data();slots=[]
for group in state['groups']:
 for clip in group['clips']:
  uri=clip['file'];p=ROOT/urllib.parse.unquote(uri.split('?')[0]) if uri else None
  slots.append({'id':clip['id'],'name':clip['name'],'owner':group['group'],'file':str(p) if p else None,'status':'制作候选，待审阅' if p else '制作中或缺片','audio':'待统一；本索引不代表声音审核','userApproved':False,'entry':clip['entry']})
out={'updated':time.strftime('%Y-%m-%d %H:%M:%S'),'logicalSlots':len(slots),'playableCandidates':sum(bool(s['file']) for s in slots),'reviewUrl':'http://127.0.0.1:8894/','scope':'同一逻辑段已登记候选，不串联互斥分支；具体画面自查/音频问题见各组delivery.json','complete':all(s['file'] for s in slots),'slots':slots}
dest=ROOT/'deliveries/当前候选索引.json';dest.parent.mkdir(exist_ok=True);temp=dest.with_suffix('.tmp');temp.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(dest)
print(json.dumps({'candidates':out['playableCandidates'],'total':out['logicalSlots'],'missing':[s['id'] for s in slots if not s['file']]},ensure_ascii=False))
