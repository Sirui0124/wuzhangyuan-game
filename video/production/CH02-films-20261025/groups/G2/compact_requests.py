from pathlib import Path
import json,re
OUT=Path(__file__).parent
plan=json.loads((OUT/'plan.json').read_text(encoding='utf-8'))
for c in plan['clips']:
    if (OUT/'tasks'/f'{c["id"]}.json').exists():continue
    q=OUT/'requests'/f'{c["id"]}.local.json';body=json.loads(q.read_text(encoding='utf-8'))
    action=c['shots'][0]['action']
    # Only visible action reaches the video model. Detailed source IDs and postproduction stay in MD.
    action=re.sub(r'[^。；]*后期[^。；]*[。；]?','',action)
    action=re.sub(r'[^。；]*(?:不生成人物|模型不造|模型不生|文字面|准确文字|原句|不得替我说话|不读正文)[^。；]*[。；]?','',action)
    action=action.replace('下一个片','下一镜')
    refs='；'.join(f'图{i}'+({'warehouse':'参考粮棚空间','desk':'参考木案与简牍纸卷材质','injury_tent':'参考伤帐木榻空间'}.get(r['role'],'只参考前景'+r['id']+'的脸和衣服，忽略背景人物')) for i,r in enumerate(c['references'],1))
    text=f'16:9，{c["duration"]}秒，写实三国历史电影，低饱和墨灰土褐，自然肤色，柔和侧光。玩家眼睛的第一视角，不出现玩家脸或肩背，不用反打。{refs}。一个连续镜头：{action}镜头稳定，正常动作速度，末尾停稳。只出现本镜需要的人物与物件，不多复制人。手指正常，实物取放有接触。所有纸木表面不显示可读文字；无字幕，无标题，无标注，无水印。'
    if c['kind']=='dialogue' and not c.get('voice'):
        l=c['sourceLines'][0]
        text+=f'画面中的{l["speaker"]}看向镜头，用自然普通话只说一句：“{l["text"]}”其他人闭嘴。'
    else:text+='所有人物闭口，无对白，无旁白，无人声。'
    text+='全片无BGM、无背景音乐、无配乐、无吟唱，无音乐鼓点。只有轻风、衣料和实际动作的现场声。'
    body['content'][0]['text']=text
    q.write_text(json.dumps(body,ensure_ascii=False,indent=2),encoding='utf-8')
    # Hosted request may exist after preparation-only failure; paid unsubmitted request is safe to replace.
    prepared=OUT/'requests'/f'{c["id"]}.json'
    if prepared.exists():
        p=json.loads(prepared.read_text(encoding='utf-8'));p['content'][0]['text']=text;prepared.write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'prompts'/f'{c["id"]}-API实际正文.txt').write_text(text,encoding='utf-8')
print('Compacted all unsubmitted requests; accepted requests untouched')
