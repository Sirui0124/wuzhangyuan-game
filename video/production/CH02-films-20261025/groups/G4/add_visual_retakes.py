from pathlib import Path
import json,copy
OUT=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
plan=read(OUT/'plan.json');rp=OUT/'retake-plan.json';retakes=read(rp)['clips']
actions={'V26-04':'第一人称向下观察同一收件案头无字平整麻纸。画内没有任何人和手；器物不移动、不展开、不变形，纸面始终无字且平整。只有极轻的帐布光影变化。','V26-08':'第一人称固定中近景看同一收件军吏，他在案后平静说话，手始终自然放在画面外，不拿卷束、不碰纸页。脸与衣冠、案后帐布保持不变，不切到书写或纸面。话后自然闭嘴看向我。','V26-09':'第一人称稳定看同一收件军吏，他在案后说完整原句，语气低稳，谈到诺言时短暂一停；没有额外人物从背后入镜，没有武器逼近，没有文件或卷束交接，不切纸面。双手自然不动，句末闭口看我。'}
for original,action in actions.items():
    cid=original+'-R2'
    if any(c['id']==cid for c in retakes):continue
    c=copy.deepcopy(next(c for c in plan['clips'] if c['id']==original));c['id']=cid;c['replaces']=original;c['action']=action
    c['frames'][0]['action']=action
    retakes.append(c)
    save(OUT/'requests'/f'{cid}.local.json',read(OUT/'requests'/f'{original}.local.json'))
    (OUT/'prompts'/f'{cid}.md').write_text((OUT/'prompts'/f'{original}.md').read_text(encoding='utf-8'),encoding='utf-8')
    save(OUT/'review'/original/'decision.json',dict(id=original,method='0.5秒连续时序抽帧，待动态复核',visualIssues=[dict(start=0,end=c['duration'],issue='纸面大段可见乱码，文书由空白变有字；不能作为准确证物或军情画面采用')],decision='重拍'+cid,audioIssues=['保留现有原声，错误仅记录，不因此重拍']))
save(rp,dict(clips=retakes));print([c['id'] for c in retakes])
