from pathlib import Path
import json,shutil
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent
(OUT/'requests').mkdir(exist_ok=True)
ref=ROOT/'source-art/core/诸葛亮.png'
assert ref.is_file()
prompt="""Create a 4-second photorealistic historical film insert, one continuous shot. Picture 1 defines the EXACT man's face, loose long dark-grey hair, grey long beard, black linen robe, pale inner collar, age and natural skin texture.
Tight close-up of ONLY his face, hair, beard and a little collar. His hands and everything held in them stay far below the lower edge for the entire shot. Empty, very soft, dark canvas background. No other person or visible object anywhere in the frame.
He stands in the same dim military tent, looking downward at something below the frame. A small warm practical light touches one cheek; natural muted grey and brown tones, readable shadows. His lips remain gently CLOSED throughout.
0-1.3 seconds: his downward gaze settles and he takes one subtle breath.
1.3-3.1 seconds: the breath catches briefly; eyes lower slightly, a restrained silent reaction.
3.1-4 seconds: he holds that downward gaze with natural tiny breathing motion.
Locked camera at eye level, 85mm portrait lens, no pan, no zoom, no change of framing, no slow motion, no cuts. Maintain the same face, hairstyle, clothing and anatomy in every frame. This is a quiet dramatic reaction, not a talking performance.
Audio contains only very soft cloth and breathing. NO speech, NO narration, NO singing, NO music. No subtitles, writing, logos, title cards or borders. 16:9 full frame."""
payload={'model':'MiniMax-H3','duration':4,'resolution':'768P','ratio':'16:9','content':[{'type':'text','text':prompt},{'type':'image_url','image_url':{'local_path':ref.as_posix()},'role':'reference_image'}]}
(OUT/'requests/ZL-REACTION.local.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
plan={'date':'2026-10-25','authorization':'用户指出诸葛亮兵器穿帮并要求重做；后续要求现代段恢复旧版、开头直接从已燃灯火开始，删除点灯。','clips':[{'id':'ZL-REACTION','duration':4,'name':'诸葛亮灭灯后反应重拍'}]}
(OUT/'production.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
shutil.copy2(ROOT/'video/production/CH01-cinematic-20261025/run_pipeline.py',OUT/'run_pipeline.py')
doc=f'''尺寸：16:9
模型：MiniMax-H3
声音：有声音
时长：4秒

## 参考图（按以下顺序上传）

图片1｜诸葛亮现用面部身份与发须；不指定道具、持握或全身姿势。
本地路径：{ref.as_posix()}

## 视频生成 Prompt

重拍灭灯后的无言反应。只拍脸、发须和少量衣领，手与所持器物始终处于画面下方，不以裁切旧穿帮画面代替重拍。背景只留虚化帐布。口唇自然闭合，不新增对白。

### 分镜1｜0-4秒

参考图关系：图片1锁定当前同一诸葛亮的长脸、披发、长须、黑袍白襟及自然肤质，不继承其他版本帽饰或演员。

画面与动作：0—1.3秒垂眼看画外低处；1.3—3.1秒吸气停半拍、目光略沉；3.1—4秒稳住，只留自然呼吸。双手和兵器全程不入画，不出现陌生兵器、道具或其他人物。

摄影与切点：85mm稳定面部近景，机位不动、构图不变；前接掀帘后的灯灭，后接原有灭灯细烟近景。实际采用区间按本轮成片检查选取。

连续性约束：沿用前镜披发、长须、黑袍和灯侧位置，灯已灭，不表演再次点亮或熄灭。没有手部／兵器镜头，不改变前镜右手持普通直剑且剑尖向下的空间事实。英文API文本独立保存于请求JSON，人工说明和编号不送入音轨生成。

拍摄手法参考：《影》既有摄影研究中克制的侧光与有动机的反应镜头，用于本镜面部塑形和短停顿；具体表演与切点为本项目设计。参考：https://theasc.com/article/dual-nature-shadow/

声音要求：全片无BGM、无背景音乐、无配乐；仅轻微衣料和呼吸，无对白、旁白、吟唱或其他人声。剪回开场时保留既有现场声，不用生成念白覆盖它。
'''
(OUT/'诸葛亮反应镜头-重拍Prompt.md').write_text(doc,encoding='utf-8')
print('Prepared one 4-second replacement reaction, one clean face reference. No lighting action in the new opening.')
