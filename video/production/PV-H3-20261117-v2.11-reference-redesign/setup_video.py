from pathlib import Path
import json,shutil,hashlib
P=Path(__file__).resolve().parent.parent
R=P/'PV-H3-20261117-v2.11';R.mkdir(exist_ok=True)
T=P.parent.parent/'.local-tools/pv-h3'
refs=R/'references';refs.mkdir(exist_ok=True)
for name in ['F31-连营大火大全景.png','F32-火后乱营与撤离.png']:
 shutil.copy2(Path(__file__).parent/name,refs/name)
shutil.copy2(Path('C:/Users/zhousirui/.codex/generated_images/01a1d983-5ada-7a93-b3bc-b154ad9ffdfe/exec-533772be-89ed-4ac8-88b1-fff5c91b8cea.png'),refs/'F33-撤出火营侧面远景.png')
common='''横向16:9满幅，真人历史电影摄影观感，夷陵大火正在发生的同一个傍晚。延续参考图地形、帐篷和服装，不改变时间与天气。干燥焦土、真实粗麻布、粗木和绳结，深景深，前中景清楚，远景才有自然空气透视；天光中性，暖光只来自实际火源。不使用整体雾化、CG渲染、塑料木材或夸张HDR。无雨、无积水、无湿地，无火焰突然熄灭，无变成次日的时间变化。无字幕、文字、水印、制作说明和新增特写人物。

声音执行（仅控制说明，绝不朗读）：生成现场同期声，无BGM、无背景音乐、无配乐、无旋律、无鼓点、无吟唱。火焰燃烧和干木噼啪声按远近分层，风声适量。无新增对白、旁白、喊词；有人物时允许自然非语言呼吸、脚步和衣甲摩擦，声音随真实动作发生。唯一允许发声的原句：无。'''
specs=[
('F31',6,'连营大火展开','F31-连营大火大全景.png',17+10/24,
'''参考图1负责本镜场景、起始构图、物件材质和傍晚光色，保持道路从右下通向左中，左侧枯树、右侧哨楼、远处山口位置关系。大全景，摄影机位于真实土坡高度。
0—2秒：从参考图构图起步，沿土坡向右平移，近处破木车和栅栏比远山产生更明显视差，揭开谷地层叠营帐。整个镜头只有这一种小幅横移，无升空、环绕或变焦。
2—6秒：继续同速小幅右移，火焰随风在已有燃烧帐顶持续翻卷，烟向上偏右升腾。近中景帐布随热流颤动，少量真实火星由燃烧物产生。主变化是视差逐步展开连营，禁止全营同时坍塌或突然爆炸。
结束时仍是熊熊大火，营区和道路清晰，给后镜撤离行动留下空间。无人物新增。'''),
('F32',8,'乱营中的辎重撤离','F32-火后乱营与撤离.png',23+10/24,
'''参考图1负责起始站位、道路、手推车、士卒衣甲、营寨及火势。大全景，摄影机在撤离道路侧前方，与参考图方向一致。
0—2秒：两名拉车士卒已经握稳车架，一人在前牵引、一人在侧协助，开始沿畅通道路朝镜头方向撤离。脚掌真实落地再蹬地，车轮沿土路滚动，不滑行、不离地。
2—6秒：同一组士卒和车连续前进，衣摆随步伐摆动，车身越过小土坎产生一次轻微颠簸，货物保持系牢；其他原有小人物沿各自原有路线退离近处火源，不增殖、不穿越火墙。摄影机只缓慢后退保持大全景，人与车占比不突然放大。
6—8秒：继续撤离，不停步摆造型；留下身后烧塌的帐布、倾倒辎重和远处仍在燃烧的连营。近处残火与远处大火持续，不产生雨或熄火。
只保留参考中已有少量士卒，无伤兵互相搀扶，无近景脸、无倒地尸体。车轮轴、手握车柄和腿脚全程保持结构稳定。火声之外加入轮轴吱呀、碎石脚步和短促自然呼吸，不出现词语。'''),
('F33',8,'撤出火营','F33-撤出火营侧面远景.png',31+10/24,
'''参考图1负责所有人物、车与道路的起始位置、火场和侧面机位。固定机位侧面大远景，全镜不推近、不变焦。道路由画面右方营地通往左方画外安全方向，火场位于身后中远景。
0—3秒：现有撤离士卒和一辆木车从右向左连续行进。前方士卒持车柄向左牵引，后方士卒扶住车体向左推，两轮沿地面同步滚动；全员步伐急促而有重量，不能慢动作漂浮。
3—6秒：前面的两名士卒先离开左侧画面，车和后续士卒沿同一路径向左跟上。衣角、脚下少量干尘与车轮颠簸来自实际步行，人物保持原来数量与装束，不回头冲向火场、不复制新增人流。
6—8秒：撤离继续，车逐渐靠近左边缘，后方留出越来越多可见的燃烧营寨。火势保持强烈，帐布局部飘动，烟柱持续升起。结尾仍有撤离动作及大火，不让火熄灭，不转成空营废墟，不在模型内淡黑。
非语言脚步与车轮声随队伍接近左侧离画逐渐减弱，背景火声持续；无新对白或喊声。''')]
units=[]
for ident,duration,title,ref,start,body in specs:
 d=R/ident;d.mkdir(exist_ok=True)
 prompt=f'单镜连续视频，时长{duration}秒。{title}。\n\n'+body+'\n\n'+common
 (d/'prompt.txt').write_text(prompt,'utf-8')
 rp=refs/ref
 u=dict(id=ident,title=title,duration=duration,edit_duration=duration,depends_on=None,reference_paths=[str(rp)],timeline_in=start,prompt_status='待review',video_status='待生成',authorization='2026-11-17用户本轮明确要求完善Prompt与参考图并直接使用MiniMax API实现、剪辑整合；直接制作授权，不伪记单独文稿已通过')
 units.append(u)
 (d/'references.json').write_text(json.dumps([str(rp)],ensure_ascii=False,indent=2),'utf-8')
 doc=f'# {ident}｜{title}\n\n版本v2.11；Prompt待review，已获本轮直接制作授权；视频待生成。\n\n平台MiniMax-H3；768P；16:9；整数时长{duration}秒。计划成片位置{start:.6f}—{start+duration:.6f}秒。\n\n参考图上传顺序1：{rp.as_posix()}\n\n仅作为reference_image输入，不宣称严格首尾帧锁定。\n\n## 完整提交Prompt\n\n{prompt}\n'
 (d/'视频生成Prompt.md').write_text(doc,'utf-8')
 u['prompt_path']=str(d/'视频生成Prompt.md');u['request_prompt_sha256']=hashlib.sha256((d/'prompt.txt').read_bytes()).hexdigest();u['reference_sha256']=hashlib.sha256(rp.read_bytes()).hexdigest()
 (d/'state.json').write_text(json.dumps(dict(id=ident,status='prepared',version='v2.11',user_review='待review'),ensure_ascii=False),'utf-8')
(R/'production-plan.json').write_text(json.dumps(dict(version='v2.11',units=units,user_review='待review',total_duration=946/24,bgm=False,source_version='v2.10',retained_range=[0,418/24]),ensure_ascii=False,indent=2),'utf-8')
pipe=(P/'PV-H3-20261117-v2.9/pipeline.py').read_text('utf-8')
pipe=pipe.replace('D:/AI视频/VJ-1106/api-tools/Invoke-HailuoVideo.ps1',(T/'Invoke-HailuoVideo.ps1').as_posix()).replace('D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe',(T/'ffmpeg.exe').as_posix()).replace('D:/AI视频/VJ-1106/motion-runtime/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe',(T/'ffprobe.exe').as_posix()).replace('C:/Users/zhousirui/Documents/ChatGPT/平行世界/tools/video_api.py','D:/ArchivedProjects/平行世界/tools/video_api.py').replace("'version':'v2.9'","'version':'v2.11'")
(R/'pipeline.py').write_text(pipe,'utf-8');shutil.copy2(P/'PV-H3-20261117-v2.9/invoke_unit.ps1',R/'invoke_unit.ps1')
print('Prepared 3 independent H3 requests and references; 39.416667s edit')
