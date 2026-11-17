from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent
notes={
'H21':['2fps全片及8fps前2秒：侧后跟骑有地面位移与树木视差，普通灰马纹理，无旧版花纹。选择0.25—3秒。'],
'H22':['2fps全片及8fps中段：前进方向与耳朵摆动连续；取0—2.458及3.75—5秒，不重复同一段。'],
'H23':['2fps全片及8fps前2秒：仅选0.5—1.208秒的落蹄细节，不用长时间循环。'],
'F21':['2fps全片：前景布帘让开，燃烧帐营纵深显露；生成未完全停稳，分成0—4秒和4—6秒，尾帧用于灾后参考。原音疑似音乐，完全排除。'],
'F22':['2fps全片及8fps后2秒：局部焦布下垂烧断，开口增大；选0.75—3.75秒，使用对应原生燃烧声。'],
'S21':['2fps全片及8fps前4秒：全程恰好两人，肩、腰支撑保持，伤者脚步拖行；按用户后续要求仅选1—2.5秒。'],
}
for id,ns in notes.items():
 p=R/id/'review.json';v=json.loads(p.read_text('utf-8'));v.update(motion_review='selected_with_documented_scope',selected_for_work_edit=True,method='2fps总览与注明范围的8fps动作联系表，由模型看图；不声称人工完整视听审核',notes=ns,user_review='待review');p.write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')
rows=[]
for u in json.loads((R/'production-plan.json').read_text('utf-8'))['units']:
 d=R/u['id'];task=list(d.glob('api/**/task.json'));ids=sorted(set(json.loads(p.read_text('utf-8-sig'))['task_id'] for p in task))
 assert len(ids)<=1
 rows.append(dict(id=u['id'],title=u['title'],task_ids=ids,requested_duration=u['duration'],references=[dict(path=p,sha256=hashlib.sha256(Path(p).read_bytes()).hexdigest()) for p in u['reference_paths']],prompt=str(d/'prompt.txt'),source=str(d/'source.mp4'),source_exists=(d/'source.mp4').exists(),user_review='待review'))
(R/'source-inventory.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),'utf-8')
print('Review scopes and provenance recorded')
