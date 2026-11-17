from pathlib import Path
import json,ast
OUT=Path(__file__).parent;BASE=OUT.parents[1]
plan=json.loads((OUT/'plan.json').read_text(encoding='utf-8'));c=next(c for c in plan['clips'] if c['id']=='V16B-02')
path=str((BASE/'references/source-frames/gouan-talk.png').resolve())
c['actualReferences']=[dict(id='现片苟安卧榻',path=path,role='first_frame',use='现片原脸、原灰麻衣、半趴木榻及帐柱悬甲；唯一首帧，不混reference_image')]
(OUT/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
r=json.loads((OUT/'requests/V16B-02.local.json').read_text(encoding='utf-8'))
film='参考《影》保留低饱和环境中的自然肤色和帐布材质，应用于本镜侧光，依据 https://theasc.com/article/dual-nature-shadow/ 。机位与反应设计为本项目设计，不复制原片剧情。'
doc=f'''尺寸：16:9
模型：MiniMax-H3
声音：有声音
时长：{c['duration']}秒

## 参考图

1. 图片1｜现片苟安卧榻｜用途：唯一first_frame，固定原脸、灰麻衣、半趴木榻和同一伤帐；不混用reference_image。
   本地路径：`{path}`

## 视频生成 Prompt

### 分镜1｜0-{c['duration']}秒

参考图关系：图片1为唯一首帧，保留苟安脸、黑巾、短须、灰麻衣、半趴木榻、帐柱悬甲和日光方向。镜头固定在床边玩家眼高，不出现玩家脸、肩背或倒影。

画面与动作：苟安看向我，轻收下颌后开口，说完压低目光并闭口；不坐起，不拿账页，不增加人物或新伤势。

摄影与切点：固定正常透视近景，只有呼吸、眼神和嘴唇的小动作；句末留下气口和静止反应，结束接UI-EARLY，不替玩家作决定。

对白：原编号CH2-LY07-W02；说话人苟安；受话人镜头位置的我；画内声，唯一口型承担者苟安，我不发声。原句：“好，这笔罪，我认。你报上去吧，别再查了。”中年中低男声略疲惫粗粝，清楚克制。

连续性约束：沿用首帧同脸同伤帐，不变成坐案、站立或拿文书；无字幕、水印、黑边和屏幕文字。API实际正文另存同名txt，不把原编号和导演说明送模型。

拍摄手法参考：{film}

声音要求：全片无BGM、无背景音乐、无配乐、无吟唱、无音乐鼓点。只留指定苟安原句、低风声、帐布轻响与实际衣料摩擦，不新增对白、旁白或群杂声。
'''
(OUT/'prompts/V16B-02.md').write_text(doc,encoding='utf-8')
print('Document and actual first-frame attachment aligned')
