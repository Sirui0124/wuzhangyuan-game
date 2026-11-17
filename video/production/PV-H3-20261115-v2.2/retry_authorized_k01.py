from pathlib import Path
import json,shutil
R=Path(__file__).resolve().parent;p=R/'production-plan.json';plan=json.loads(p.read_text('utf-8'));old=next(u for u in plan['units'] if u['id']=='K01');new={**old,'id':'K01R','title':'伤兵伸手抓牢（用户授权重提一次）'}
d=R/'K01R';d.mkdir(exist_ok=True)
if not (d/'state.json').exists():
 for n in ['prompt.txt','references.json']:shutil.copy2(R/'K01'/n,d/n)
 (d/'retry-authorization.json').write_text(json.dumps({'date':'2026-11-15','user_answer':'允许 K01 重提一次','original':'K01','original_status':'HTTP502无任务ID，可能已创建计费','retry_limit':1,'new_request':'K01R','policy':'K01R若仍无ID不得再自动重投'},ensure_ascii=False,indent=2),'utf-8')
 if 'K01R' not in [u['id'] for u in plan['units']]:plan['units'].append(new)
 k=next(u for u in plan['units'] if u['id']=='K02');assert not list((R/'K02').glob('api/**/task.json'));k['depends_on']='K01R'
 s=R/'K02/state.json'
 if s.exists():
  st=json.loads(s.read_text('utf-8'));st.update(status='prepared',depends_on='K01R');s.write_text(json.dumps(st,ensure_ascii=False,indent=2),'utf-8')
 p.write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
print('One expressly authorized K01 replacement prepared; original preserved.')
