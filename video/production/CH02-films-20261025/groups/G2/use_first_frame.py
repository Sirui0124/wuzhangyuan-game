from pathlib import Path
import json
OUT=Path(__file__).parent;BASE=OUT.parents[1]
id='V16B-02'
if not (OUT/'tasks'/f'{id}.json').exists():
    p=OUT/'requests'/f'{id}.local.json';r=json.loads(p.read_text(encoding='utf-8'))
    r['content']=[dict(type='text',text='16:9，8秒，保持图中的同一个苟安、原伤帐木榻和灰麻衣，不换脸、不换景、不换姿势。摄影机是床边玩家的眼睛，固定近景，不出现玩家本人。苟安半趴在榻上，先看我，轻收下颌后用自然中低男声说：“好，这笔罪，我认。你报上去吧，别再查了。”说完低下目光，嘴闭合。仅细小呼吸与嘴唇运动，不起身，不新增人物或物件，无字幕，无任何屏幕文字，无水印。全片无BGM、无背景音乐、无配乐、无吟唱，只有低风和帐布轻响。'),dict(type='image_url',image_url=dict(local_path=str((BASE/'references/source-frames/gouan-talk.png').resolve())),role='first_frame')]
    p.write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'prompts'/f'{id}-API实际正文.txt').write_text(r['content'][0]['text'],encoding='utf-8')
    print('Unsubmitted V16B-02 bound to existing actual first frame')
else:print('Already accepted; unchanged')
