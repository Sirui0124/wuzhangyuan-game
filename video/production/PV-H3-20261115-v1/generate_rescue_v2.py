from pathlib import Path
import json,shutil,hashlib
import pipeline

OUT=Path(__file__).resolve().parent;d=OUT/'G24-25-v2';d.mkdir(exist_ok=True)
r=pipeline.read(OUT/'rescue-reference-v2.json');ref=d/'P01-伤兵无接触起始图-v2.png'
if not ref.exists():shutil.copy2(r['source'],ref)
prompt='''9秒真人历史电影，16:9横向，单一连续第一视角POV，无音频。

唯一参考图是准确起始构图：同一名年轻伤兵靠在车轮旁，画面左边，黑褐札甲和灰黑衣服，来路军营在右后方。参考图没有施救者身体，这一点在整条视频必须保持。摄影机就是施救者的双眼，不是跟拍摄影机。画面中永远不出现施救者的头、脸、肩、背、胸、腿、倒影或投影。不能在镜头前加一个走路或蹲下的人。Only true first-person POV, never over-the-shoulder or third person.

0至3秒：摄影机直接朝伤兵靠近约30厘米，轻轻降低视点，像我在他面前蹲下，车轮与伤兵脸真实变近。伤兵先仰头看向镜头，手仍各自放在膝边和地上，嘴保持闭合。这里前景没有我的手，没有任何接触。

3至5秒：我的一条右前臂才从画面右下角进入，青白色粗织布袖口带一片朴素银灰色护腕，右手张开向伤兵伸出。伤兵把自己左手从膝边抬起，迎向我的右前臂。仅这一条施救前臂进入镜头，不能沿前臂画出我的肩背或完整身体。

5至6秒：我的右手抓住伤兵左前臂，他左手回握我的右前臂；是互握前臂的救援握法，不是握手。恰好两个手腕、两只参与握持的手，五指清楚，手和手腕与各自身袖连接，不融合、不多指、不交换左右。

6至8秒：双方开始真实向上用力，衣袖绷紧，伤兵的背离开车轮，肩与脸上移，地面相对向下移动，我的眼睛视点也随起身略抬。伤兵仍是画面中的同一张脸，无痛苦喊叫、不张嘴发言，不突然跑走。8至9秒保留起身的连续余势供剪辑，不能定格或淡黑。

只有原有伤兵、原有场景和我的右前臂参与近处动作，后方两个小士兵仍向营外走。火与烟只是既有背景。真实演员、实物衣甲和自然接触受力，正常50mm透视、脸与手腕同时可读。自然中性色温，暖火只在真实反光范围，皮肤不塑料、不CG。没有字幕、文字、额外角色、音乐、对白、音效或其他声音。'''
u={'id':'G24-25-v2','title':'第一视角靠近互握扶起修订','version':'v2','duration':9,'edit_duration':8,'source_shots':['S30','S31','S32'],'reference_ids':['P01-rescue-no-contact'],'reference_paths':[str(ref)],'depends_on':None,'action':'以干净无玩家起始图完成单一连续POV靠近、互握和扶起，替换旧第三人称版本。','prompt_sha256':hashlib.sha256(prompt.encode()).hexdigest(),'status':'prepared'}
if not (d/'prompt.txt').exists():(d/'prompt.txt').write_text(prompt,'utf-8')
pipeline.save(d/'references.json',u['reference_paths']);pipeline.save(d/'plan.json',u)
pipeline.save(d/'remediation.json',{'reason':'原G24视频出现施救者背影，违反原分镜的第一视角约束。','changes':'先制作没有玩家身体、没有接触的准确起始图，再使用单一参考生成一次连续POV动作；不把第三人称错误作为续镜起点。','replaces':['G24','G25'],'planned_duration':8,'original_versions_preserved':True})
pipeline.work(u)
