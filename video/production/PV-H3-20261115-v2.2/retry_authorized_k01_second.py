from pathlib import Path
import json,shutil
R=Path(__file__).resolve().parent;p=R/'production-plan.json';plan=json.loads(p.read_text('utf-8'));old=next(u for u in plan['units'] if u['id']=='K01');new={**old,'id':'K01RR','title':'伤兵伸手抓牢（第二次明确授权重提）'}
d=R/'K01RR';d.mkdir(exist_ok=True)
if not (d/'state.json').exists():
 for n in ['prompt.txt','references.json']:shutil.copy2(R/'K01'/n,d/n)
 (d/'retry-authorization.json').write_text(json.dumps({'date':'2026-11-15','user_answer':'允许再重提一次','originals':['K01','K01R'],'original_statuses':['HTTP502无ID','HTTP520无ID'],'retry_limit_for_this_approval':1,'new_request':'K01RR','wait_evidence':'B02和B04均已生成下载；用新版本重提，不覆盖先前未知请求','policy':'本次若仍无ID，不再自动重投'},ensure_ascii=False,indent=2),'utf-8')
 if 'K01RR' not in [u['id'] for u in plan['units']]:plan['units'].append(new)
 k=next(u for u in plan['units'] if u['id']=='K02');assert not list((R/'K02').glob('api/**/task.json'));k['depends_on']='K01RR'
 s=R/'K02/state.json'
 if s.exists():
  st=json.loads(s.read_text('utf-8'));st.update(status='prepared',depends_on='K01RR');s.write_text(json.dumps(st,ensure_ascii=False,indent=2),'utf-8')
 p.write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
