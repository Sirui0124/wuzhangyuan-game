from pathlib import Path
import json,hashlib
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):p.parent.mkdir(exist_ok=True,parents=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
plan=read(OUT/'plan.json');bindings=read(OUT/'reference-bindings.json');clips=[]
scene=read(BASE/'references'/'manifest.json')['byId']['粮仓'];bindings['camp_frame']=dict(path=scene['path'],purpose='营道、粮棚、木车空间与自然光，唯一首帧；不按粮袋数推定粮数',sha256=scene['sha256'],ready=scene['ready'],centralId='粮仓')
actions={
 'V02-01':'我的双眼沿营道向前走两步，镜头只轻轻随落脚起伏，然后停住看向左边的木车与麻袋。近处没有人物，不出现任何人的脸、背影、身体或倒影。',
 'V02-02':'我的双眼从同一营道缓慢向左侧粮棚望去，看见停住的木车、车绳和远处帐篷，镜头停稳。近处没有人物，不出现任何人的脸、背影、身体或倒影。',
 'V02-03':'我的双眼在同一营道向前缓慢走两步，然后转向右侧营帐入口，停在帘外。仅看当下营地，不出现战场、宫廷或别国场景。近处没有人物，不出现任何人的脸、背影、身体或倒影。'}
for orig,action in actions.items():
    c=dict(next(x for x in plan['clips'] if x['id']==orig));cid=orig+'-R2';c.update(id=cid,repairOf=orig,referenceKeys=['camp_frame'],referenceRole='first_frame',reason='Third-person picture and burnt production captions; not an audio-only repair')
    prompt='实拍历史电影，低饱和墨灰土褐，麻布旧木有真实纹理，自然肤色与阴天柔光。摄影机就是我的双眼，第一人称，人眼高度。图片1直接作为首帧，同一营地、粮棚与营道。\n'+f"0–{c['duration']}秒："+action+'\n全片只有这一段连续主观镜头，不切到外面拍我，不拍人物肩背。没有任何字幕、字卡、文字叠加或水印。没有对白、旁白、人声、BGM、背景音乐、配乐、吟唱；只留轻风、自然脚步和远处帐布声。'
    req=dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=[dict(type='text',text=prompt),dict(type='image_url',image_url={'local_path':scene['path']},role='first_frame')])
    save(OUT/'requests'/f'{cid}.local.json',req)
    (OUT/'prompts'/f'{cid}.md').write_text(f"尺寸：16:9\n模型：MiniMax-H3\n声音：有声音\n时长：{c['duration']}秒\n\n图片1：`{scene['path']}`，唯一首帧，锁当下营地空间。\n\n分镜1｜0-{c['duration']}秒\n\n参考图关系：图片1锁营道、粮棚与木车空间，不代表粮数。\n\n画面与动作：{action}\n\n摄影与切点：同一连续玩家眼高镜头，末尾停稳。\n\n后期配音原句（不发送模型）："+' / '.join(x['text'] for x in c['sourceLines'])+'\n\n连续性：不拍未来事件，不拍玩家脸背；原请求与失败候选保留。\n\n拍摄手法参考：沿用已核验《1917》ASC访谈的以行进动作组织机位，具体第一视角为项目设计。\n\n声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点；只留轻风、脚步、帐布，不新增人声。\n',encoding='utf-8')
    clips.append(c)
save(OUT/'reference-bindings.json',bindings);save(OUT/'repair-plan.json',dict(clips=clips,authorization='User permits picture repairs, audio-only issues do not trigger regeneration'))
print('3 picture-only repairs prepared; no request submitted')
