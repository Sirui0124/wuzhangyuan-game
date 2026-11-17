from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent
plan=json.loads((R/'production-plan.json').read_text('utf-8'))
common=(R/'L02/prompt.txt').read_text('utf-8').split('\n\n请求时长')[0]
data=[
('L03','刘备认印',7,['L03-刘备认印.png'],'''0—2秒，刘备右手指尖轻扶绢帕上的25毫米铜私印，拇指触碰旧红褐绦带，印不悬浮不变大，鼻钮朝上，印底不朝镜头。2—4秒，他看住铜印，呼吸顿住片刻，只低声唤出原句；眼眶微红，下颌轻微绷住，绝不仰头号哭，不流夸张长泪。4—7秒，缓缓呼出气，手放松仍留在印旁，重新抬眼看玩家。镜头只轻微靠近，保留完整头部和手。唯一画内发声者刘备，六十余岁男子低沉略沙哑自然普通话，与后续传令一致，不朗诵。唯一允许发声的原句：
“士元……”'''),
('L05','军图交接',5,['L05-军图.png'],'''此镜只有军图与刘备右手，没有脸和口型。从参考图的俯拍近景开始。0—2秒，指尖沿河道方向只移动一小段，停一下后向画面上缘收回，不再指点。2—5秒，相机缓慢垂直向下靠近图面，使军图填满画面；丝绢是有厚度的真实织物，墨线不变成真实山水，图案不融化、不变形、不增加文字。河道形状、山脊和岛的位置全程固定。动作小而自然，镜头不绕转，不产生过强透视。声音只有手离开绢面的细响、袖甲轻擦和低风，无任何人声、对白、旁白或音乐。唯一允许发声的原句：无。''')]
for id,title,dur,refs,prompt in data:
 d=R/id;d.mkdir(exist_ok=True);p=common+f'\n\n请求时长：{dur}秒。\n'+prompt
 paths=[str(R/'references'/ref) for ref in refs]
 (d/'prompt.txt').write_text(p,'utf-8');(d/'references.json').write_text(json.dumps(paths,ensure_ascii=False,indent=2),'utf-8')
 (d/'视频生成Prompt.md').write_text(f'# {id}｜{title}\n\n模型MiniMax-H3，768P，16:9，{dur}秒。用户已授权生成；状态待review。\n\n参考图顺序：\n'+ '\n'.join(paths)+'\n\n'+p,'utf-8')
 if not any(u['id']==id for u in plan['units']):plan['units'].append(dict(id=id,title=title,duration=dur,edit_duration=dur,depends_on=None,reference_paths=paths,prompt_status='待review',video_status='待生成',prompt_path=str(d/'视频生成Prompt.md'),request_prompt_sha256=hashlib.sha256(p.encode()).hexdigest()))
(R/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
