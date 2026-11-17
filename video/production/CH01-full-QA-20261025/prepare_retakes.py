from pathlib import Path
import json,shutil
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent;CORE=ROOT/'source-art/core'
for d in ['requests','tasks','generated','prompts']:(OUT/d).mkdir(exist_ok=True)
common='Photorealistic Chinese historical live-action drama, muted natural brown and blue-grey colors, realistic skin and cloth, readable natural shadows. One continuous real-time shot, stable intentional camera, no slow motion, no jump cuts. 16:9 full frame. No writing, captions, subtitles, title cards or logos. Natural background ambience only. No spoken words, narration, singing or music.'
clips=[
dict(id='QA-GUARD-LISTEN',duration=8,name='甲的统一身份与倾听',refs=[(CORE/'甲.png','人物身份：中年、黑布包髻、短须、旧札甲'),(OUT/'refs/guard-context.png','场景、光照、甲的位置和对话距离；身份仍按图片1')],
action='0—1秒对面守卒甲将目光落在摄影机位置；1—6.5秒闭口听我的军情；6.5—8秒轻收下颌，准备回答但不说话。',
prompt="""<Picture 1> defines the ONLY visible man's exact face and age, broad middle-aged face, narrow moustache and short chin beard, black wrapped cloth headgear, worn iron lamellar armor and grey-brown collar. <Picture 2> defines the closed headquarters tent, warm brazier at image right, camera distance and this man's placement; use the identity from Picture 1.
Medium close-up, head and chest, eye-level camera from the unseen visitor's position. The man faces slightly towards the camera and silently listens to the offscreen visitor. BOTH HIS LIPS REMAIN GENTLY TOGETHER FOR THE ENTIRE EIGHT SECONDS. Do not make any speech mouth shapes. No one speaks in the generated clip.
0-1 seconds: he settles his eyes on the visitor beside the lens.
1-6.5 seconds: he listens attentively, tiny breathing and one natural blink, restrained unhurried expression, no repeated nods.
6.5-8 seconds: he subtly lowers his chin, still keeping his lips closed.
Only this guard is visible. No shoulder, silhouette or hand in the foreground. Hands and all weapons remain below the bottom of the frame. Keep the same identity and armor throughout. The tent curtains remain completely closed behind him."""),
dict(id='QA-WEI-LISTEN',duration=5,name='魏延闭口倾听动态替换定格',refs=[(CORE/'魏延.png','只锁魏延脸、黑巾、暗朱衣与札甲'),(OUT/'refs/weiyan-listen.png','中军帐外夜色、灯光和倾听方向，不继承裁切或模糊')],
action='0—1秒魏延止步；1—4秒听我说明禁令，闭口、自然呼吸；4—5秒凝视我，准备回复。',
prompt="""<Picture 1> defines Wei Yan's EXACT middle-aged face, broad cheeks, black moustache and short thick beard, black cloth headwrap, dark red tunic and dark lamellar armor. <Picture 2> defines only the night military-camp background and cool/warm lighting, not the crop or blur.
An eye-level medium close-up of Wei Yan standing outdoors, head and upper chest fully within frame, closed headquarters tent softly blurred behind. Only Wei Yan is visible; no foreground objects, no hands or weapons in frame.
0-1 seconds: he has stopped walking and fixes his eyes on the unseen guard beside the camera.
1-4 seconds: he silently listens to an urgent warning. His lips stay completely together, subtle natural breathing and a blink, restrained impatience in his eyes.
4-5 seconds: a slight tightening of his eyes and steady gaze, mouth still CLOSED, preparing to respond after the shot ends.
No speech mouth shapes at any point. Fully live moving performance, never a still photograph. Keep his face and costume identical to Picture 1 throughout."""),
dict(id='QA-WEI-EXIT',duration=6,name='魏延接令后沿营道离开',refs=[(CORE/'魏延.png','魏延身份、暗朱衣、黑巾和札甲'),(CORE/'夜营.png','只锁营道、木栏、帐篷、夜色，不继承其他人的身份')],
action='0—1秒魏延在营道上转身背向摄影机；1—5秒正常步行离去；5—6秒继续远离，摄影机保持原处。',
prompt="""<Picture 1> defines Wei Yan's exact face, black headwrap, short black beard, dark red tunic and dark lamellar armor. <Picture 2> defines only the dirt camp lane, low timber railings, rows of tents and dark blue night. The scene is outdoors on the lane, never inside a tent.
Medium-wide shot at adult eye level. Wei Yan is the only foreground person. At the start he is three metres away in three-quarter side view, having just received orders. The camera faces OUTWARD ALONG THE CAMP ROAD, away from the headquarters. No tent entrance or doorway is in his path or visible ahead of him.
0-1 seconds: he turns toward the open lane, presenting his armored back.
1-5 seconds: he walks steadily away from the camera along the lane, normal human steps and natural swinging arms, passing the railings. His red sleeves and black headwrap remain unchanged.
5-6 seconds: he continues further down the road while the camera stays behind. He never turns back, never approaches a tent, never opens a curtain and never enters any shelter.
No dialogue. Natural boots on earth, cloth and armor sounds. No visible drawn weapon, no extra hands, no change of costume."""),
dict(id='QA-HAND-RELAX',duration=4,name='天亮后握矛的手放松',refs=[(OUT/'refs/hand-dawn.png','精确首帧：现用右手、灰褐麻布袖、木矛、白昼中军帐')],
first=True,action='0—0.7秒沿首帧自然握矛；0.7—2.5秒拇指与四指依次稍松，仍扶稳木杆；2.5—4秒保持放松扶矛，不掉落、不长出另一只手。',
prompt="""Animate the provided first frame into a continuous four-second photorealistic close-up at dawn. Preserve exactly the existing right hand, grey-brown coarse linen sleeve, single wooden spear shaft, blurred closed headquarters tent and morning light.
0-0.7 seconds: the right hand holds the wooden shaft as in the first frame.
0.7-2.5 seconds: the thumb and four fingers naturally ease their pressure very slightly. The fingers remain anatomically correct, five digits only. The hand still supports the shaft; it does not release it or drop it.
2.5-4 seconds: the relaxed fingers rest loosely against the shaft and the wrist lowers by only two centimetres, a small visible release of tension.
Locked camera, stable background, no change of lens or framing. Exactly one right hand is visible throughout; the left hand stays offscreen. Keep the spear straight and whole. No other person or object enters the image.
No voices. Only soft cloth and very quiet dawn camp air.""")
]
for c in clips:
 refs=c.pop('refs');parts=[{'type':'text','text':common+'\n'+c['prompt']}]
 for p,use in refs:
  assert p.is_file(),p
  parts.append({'type':'image_url','image_url':{'local_path':p.as_posix()},'role':'first_frame' if c.get('first') else 'reference_image'})
 payload=dict(model='MiniMax-H3',duration=c['duration'],resolution='768P',ratio='16:9',content=parts)
 (OUT/'requests'/(c['id']+'.local.json')).write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
 reflines='\n\n'.join(f'图片{i}｜{p.as_posix()}\n用途：{use}' for i,(p,use) in enumerate(refs,1))
 relation='；'.join(f'图片{i}负责{use}' for i,(_,use) in enumerate(refs,1))
 doc=f'''尺寸：16:9
模型：MiniMax-H3
声音：有声音
时长：{c['duration']}秒

## 参考图（实际上传顺序）

{reflines}

## 视频生成 Prompt

{c['name']}。本条只生成所需的无对白动作，剪入后保留原片对应说话人的音轨。英文实际提交内容见同名requests JSON，不将人工说明念入音轨。

### 分镜1｜0-{c['duration']}秒

参考图关系：{relation}。

画面与动作：{c['action']}

摄影与切点：单一连续镜头、自然原速、机位与构图稳定；按镜头内动作完成点剪回前后原片，不用照片停格填时长。画面与既有现场声按实际帧核对。

对白：本次源片无人说话；倾听镜头中可见NPC全程闭口，剪入后由画外的我说原句。离开／手部镜头仅承担原有演出，不新增故事和对白。

连续性约束：人物、年龄、发须、衣甲、时段和地理空间按参考分工固定。魏延接令离开沿营道执行军令；甲守在闭帘前；手只缓慢放松而不丢矛。无字幕和新增标识。768P源片只微裁为16:9，不拉伸。

拍摄手法参考：《影》摄影访谈中有限且有意图的镜头运动、保持表演连续性的做法，应用于本镜稳定观察和克制表演；具体动作与时间为本项目设计。已核验研究：https://theasc.com/article/dual-nature-shadow/

声音要求：全片无BGM、无背景音乐、无配乐；只保留与动作同步的呼吸、衣料、步履／护甲或晨间风声。生成源片禁止新增对白、旁白、吟唱或其他人声；合成片保留原片指定说话人及原句。
'''
 (OUT/'prompts'/(c['id']+'.md')).write_text(doc,encoding='utf-8')
(OUT/'production.json').write_text(json.dumps({'date':'2026-10-25','authorization':'用户要求第一关所有视频完整检查，穿帮、人物不一致、衔接问题直接修复。','clips':[{k:v for k,v in c.items() if k!='prompt'} for c in clips]},ensure_ascii=False,indent=2),encoding='utf-8')
shutil.copy2(ROOT/'video/production/CH01-opening-fix-20261025/run_pipeline.py',OUT/'run_pipeline.py')
print('Prepared 4 independent repair requests with bound real references.')
