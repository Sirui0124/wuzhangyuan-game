from pathlib import Path
import json,copy
OUT=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
plan=read(OUT/'plan.json');source=next(c for c in plan['clips'] if c['id']=='V26-02')
c=copy.deepcopy(source);c['id']='V26-02-R2';c['duration']=6;c['replaces']='V26-02'
c['action']='第一人称在收件案前已经停稳。桌边只有我刚放下的一束闭合无字竹木卷束，捆绳不拆。对面的同一收件军吏从案后用一只手把这束材料平缓拉到自己一侧，手掌压稳后松开，完成核收；我不再伸手，不出现更多手臂。不展开任何纸面，不出现可读文字，不签名、不盖章、不递交正式案卷。镜头保持水平中近景，看得见军吏闭口的脸和案边完整动作。'
c['frames'][0]['action']=c['action'];c['frames'][0]['end']=6
md=(OUT/'prompts/V26-02.md').read_text(encoding='utf-8').replace('V26-02','V26-02-R2').replace('时长：4秒','时长：6秒').replace('分镜1｜0-4秒','分镜1｜0-6秒').replace(source['action'],c['action'])
md=md.replace('连续性与限制：','连续性与限制：本次修复上一版展开文书乱写与错误交案暗示。整片所有纸面、竹木卷束一律无字，不展开；禁止出现“交案”“军令”“已收”“案”等任何文字或印章。只拍粮情材料核收。')
(OUT/'prompts/V26-02-R2.md').write_text(md,encoding='utf-8')
local=read(OUT/'requests/V26-02.local.json');local['duration']=6;local['content'][0]['text']=md.split('## 视频生成 Prompt',1)[1].strip()
save(OUT/'requests/V26-02-R2.local.json',local)
save(OUT/'retake-plan.json',dict(clips=[c]))
save(OUT/'review/V26-02/decision.json',dict(id='V26-02',dynamicPlayback='浏览器从0到4.48秒播放，结合0.5秒时序图',issues=[dict(start=.9,end=4.48,problem='卷束上出现非源文字，末尾出现近似正式交案字样；叙事边界错误'),dict(start=2.2,end=4.48,problem='多手接触与展开动作复杂，卷束纸面扭曲')],decision='重拍V26-02-R2，原片不用',audio='未听审'))
print(c['id'])
