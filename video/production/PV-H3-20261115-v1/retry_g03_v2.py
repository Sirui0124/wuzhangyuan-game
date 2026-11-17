from pathlib import Path
import json,shutil
import pipeline

OUT=Path(__file__).resolve().parent
original=OUT/'G03';retry=OUT/'G03-v2';retry.mkdir(exist_ok=True)
u=next(x for x in pipeline.PLAN['units'] if x['id']=='G03').copy()
u.update(id='G03-v2',version='v2',retry_of='G03-v1',retry_limit=1)
auth={'date':'2026-11-15','question':'庞统托付镜头G03返回HTTP 520，未取得任务ID，也暂时无法核对服务端记录。原请求仍有可能已创建并计费。是否允许仅对G03另存v2、重提一次？','user_answer':'允许G03重提一次','scope':'只对G03额外提交一次，保留v1不明状态。其他镜头不获得重投授权。'}
pipeline.save(retry/'authorization.json',auth)
for filename in ('prompt.txt','references.json'):
    target=retry/filename
    if not target.exists():shutil.copy2(original/filename,target)
pipeline.save(retry/'plan.json',u)
if not (original/'v1-submission-state.json').exists():pipeline.save(original/'v1-submission-state.json',pipeline.read(original/'state.json'))
pipeline.work(u)
state=pipeline.read(retry/'state.json',{})
if state.get('status')=='downloaded':
    for f in retry.iterdir():
        if f.is_file() and (f.name in ('source.mp4','selected.mp4','end-selected.png','end-native.png','contact.jpg','technical.json','edit-record.json','review.json') or f.name.startswith('dense-')):
            target=original/f.name
            if not target.exists():shutil.copy2(f,target)
    pipeline.save(original/'active-version.json',{'version':'v2','directory':str(retry),'task_id':state.get('task_id'),'authorization':str(retry/'authorization.json'),'v1':'原520提交状态不明，记录完整保留。'})
    state.update(id='G03',version='v2',active_directory=str(retry),v1_status='unknown_outcome',local_file=str(original/'source.mp4'),selected_file=str(original/'selected.mp4'))
    pipeline.save(original/'state.json',state)
    pipeline.report('G03 v2 selected; G04 can continue from actual selected endpoint')
else:pipeline.report('G03 v2 not delivered; no further retry authorized')
