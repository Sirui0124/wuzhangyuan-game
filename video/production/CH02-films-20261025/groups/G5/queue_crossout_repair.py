from pathlib import Path
import json,copy
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
id='V32A-07-R2'
assert not (OUT/'tasks'/f'{id}.json').exists(), 'Known task must never be resubmitted'
ref=read(OUT/'references/composition-manifest.json')['byId']['gouan-tent-desk']
prompt='Historical live action, night inside a Han-era tent. The camera tilts down from Gou An at the low desk to a close view of his right hand and paper. He presses a brush onto one existing short row of faded ink and draws one firm horizontal stroke all the way across the row. He lifts the brush, moves below the crossed-out row, and writes his short signature. He lifts the brush and places it on the brush rest. A single continuous nine-second shot, warm small lamp light, grey linen sleeve, only paper, brush and cloth sounds. No speech or background music.'
save(OUT/'requests'/f'{id}.local.json',dict(model='MiniMax-H3',duration=9,resolution='768P',ratio='16:9',content=[dict(type='text',text=prompt),dict(type='image_url',image_url={'local_path':ref['path']},role='first_frame')]))
rp=read(OUT/'repair-plan.json');c=next(c for c in rp['clips'] if c['id']==id);c.update(visualRepairReason='原片未清楚拍出先划去再署名，单独验证实际动作，不因音频重拍',status='necessary-visual-repair',action=prompt)
save(OUT/'repair-plan.json',rp)
q=read(OUT/'queue-plan.json');q['clips']=[x for x in q['clips'] if x['id']!=id]+[c];save(OUT/'queue-plan.json',q)
print('One necessary visual repair appended to existing unique runner queue; unknown unchanged')
