from pathlib import Path
import json,shutil,hashlib
import pipeline

OUT=Path(__file__).resolve().parent;original=OUT/'G04';retry=OUT/'G04-v2';retry.mkdir(exist_ok=True)
u=next(x for x in pipeline.PLAN['units'] if x['id']=='G04').copy()
source=OUT.parent/'PV-opening-20261114/references/existing/E12-庞统托印.png'
u.update(id='G04-v2',version='v2',retry_of='G04-v1',depends_on=None,reference_ids=['E12'],reference_paths=[str(source)])
prompt='''生成一条5秒、横向16:9的古代中国军帐真人电影镜头，无声。

参考图1控制同一位深蓝衣、黑冠的中年士人庞统，同一小铜印、军帐和凤鸟屏风。镜头改为清楚的正面半身中景，完整看见他的脸、上身衣袍与伸出的右手；自然中性柔光，正常50mm透视，皮肤和衣料真实。保持有足够景深读清双手，不能推到只剩皮肤的极端微距。

庞统的右掌托着同一枚25毫米见方、低穿孔鼻钮、旧红褐短绦的小铜印。摄影机是坐在对面的我，第一视角；我的青白色衣袖和左手从左下方伸入，左掌平稳伸到小铜印下方。庞统把印与短绦轻轻放到我的左掌，确认我托稳后撤回右手。0至1秒建立递交关系，1至3秒只完成一次接印，3至4秒我的掌心承住印，他的手退出，第4至5秒保持交接后的自然呼吸和衣袖余动。双手在正常中景尺度，手腕和袖口连接清楚，五指自然，小印真实落在掌心，绦带受重力垂下；禁止印复制、穿过皮肤、双手融合。

全程是两个衣着完整的成年人平静交接一件小物的普通动作，不涉及武器或伤害。庞统闭口看交接，不添加额外人物、对白口型、文字、字幕、水印或音乐；不变脸、不突然换衣、不淡黑、不定格。无音频。'''
u['action']='同一交接改为可清楚读出脸、衣着和双手关系的正面中景；不使用极端掌心近景。'
u['prompt_sha256']=hashlib.sha256(prompt.encode()).hexdigest()
if not (retry/'prompt.txt').exists():(retry/'prompt.txt').write_text(prompt,'utf-8')
pipeline.save(retry/'references.json',u['reference_paths']);pipeline.save(retry/'plan.json',u)
pipeline.save(retry/'remediation.json',{'original_task_status':'failed','original_error_code':'content_policy_violation','provider_message':'content did not pass the safety policy and was not published','provider_output_seconds':0,'reason_detail':'服务端未给出具体拦截依据。','change':'改为衣着、人物与普通物件交接关系清晰的军帐中景；不改变交印剧情。','scope':'对已确认失败镜头做一次有针对性的正常内容修订，旧任务和响应完整保留。'})
if not (original/'v1-submission-state.json').exists():pipeline.save(original/'v1-submission-state.json',pipeline.read(original/'state.json'))
pipeline.work(u)
state=pipeline.read(retry/'state.json',{})
if state.get('status')=='downloaded':
    for f in retry.iterdir():
        if f.is_file() and (f.name in ('source.mp4','selected.mp4','end-selected.png','end-native.png','contact.jpg','technical.json','edit-record.json','review.json') or f.name.startswith('dense-')):
            target=original/f.name
            if not target.exists():shutil.copy2(f,target)
    pipeline.save(original/'active-version.json',{'version':'v2','directory':str(retry),'task_id':state.get('task_id'),'v1':'原任务内容策略失败；原API记录保留。'})
    state.update(id='G04',version='v2',active_directory=str(retry),v1_status='failed',local_file=str(original/'source.mp4'),selected_file=str(original/'selected.mp4'))
    pipeline.save(original/'state.json',state)
    pipeline.report('G04 v2 handover candidate collected')
else:pipeline.report('G04 v2 not delivered; preserved failure and no automatic extra generation')
