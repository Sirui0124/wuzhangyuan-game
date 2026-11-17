from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent
common='''横向16:9真人历史电影实拍质感，三国夷陵战败后凌晨撤退线临时帐棚。与参考图同一个刘备，六十余岁、灰白须发、破旧深色衣甲；自然皮肤与眼神，不磨皮不CG。画右固定油灯暖光，画左帐口冷夜色，光向不跳变。第一视角面对刘备，不出现玩家的脸。参考图用于人物、服装、场景、光照连续性，不是严格首帧。全片禁止字幕、说明文字、水印。声音控制说明绝不朗读；只有下列引号内原句允许发声。无BGM、无配乐、无旋律、无鼓点、无吟唱。保留轻微衣料、呼吸、远处撤离脚步和低风声，无额外可辨人声。'''
data=[
('L02','陈述来意',6,'L02-刘备倾听.png',None,'''0—1秒，刘备低头看画外下方递来的信物，嘴闭合。1—5秒，镜头后的年轻成年男性玩家平静、略疲惫地说原句；刘备全程闭口倾听，仅眼神抬起与一次自然呼吸，没有口型。5—6秒他视线重新落向信物。固定中近景，轻微自然身体重心变化，无机械点头。唯一允许发声的原句（只由镜头后玩家画外说）：
“我受凤雏先生所托，持此印来见陛下。”'''),
('L04','传令救援',13,'L02-刘备倾听.png',None,'''刘备已经认出了庞统的印，悲伤收住后仍疲惫，目光有决断，不怒吼，不哭喊。中近景固定，构图与参考一致。0—1秒短呼气。1—5秒只把头转向画右身侧守卫，低沉有力说第一句。守卫闭口不回答。5—6秒转回面对镜头后的玩家。6—10秒对玩家说第二句。10—11秒看住对方停半拍。11—13秒音量稍低说第三句，手落向案面并准备引向地图。刘备是唯一画内说话者，六十余岁男子低沉略沙哑自然普通话，清晰、克制；每句口型匹配，不抒情朗诵，不拉长所有字。顺序唯一允许发声的原句：
“传令，拨一队人马，听他调遣。”
“你去收拢残部，接应尚未撤出的将士。”
“把他们带回来。”'''),
]
units=[]
for id,title,dur,ref,dep,prompt in data:
 d=R/id;d.mkdir(exist_ok=True);p=common+'\n\n请求时长：'+str(dur)+'秒。\n'+prompt
 (d/'prompt.txt').write_text(p,'utf-8');refs=[str(R/'references'/ref)]
 (d/'references.json').write_text(json.dumps(refs,ensure_ascii=False,indent=2),'utf-8')
 (d/'视频生成Prompt.md').write_text(f'# {id}｜{title}\n\n状态：待review；用户已授权本轮生成。\n模型：MiniMax-H3，768P，16:9，{dur}秒。\n\n参考图1：{refs[0]}\n\n'+p,'utf-8')
 units.append(dict(id=id,title=title,duration=dur,edit_duration=dur,depends_on=dep,reference_paths=refs,prompt_status='待review',video_status='待生成',prompt_path=str(d/'视频生成Prompt.md'),request_prompt_sha256=hashlib.sha256(p.encode()).hexdigest()))
(R/'production-plan.json').write_text(json.dumps(dict(version='v2.15',authorization='2026-11-17用户明确要求生成参考图、按H3生成并衔接撤离PV；无BGM保留对白环境音',units=units),ensure_ascii=False,indent=2),'utf-8')
print('Prepared',len(units),'units')
