from pathlib import Path
import json,hashlib
O=Path(__file__).resolve().parent
def rd(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def wr(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
cid='V09-04-P1';ref=O/'references/V09-closed-letter-first.png';sha=hashlib.sha256(ref.read_bytes()).hexdigest()
b=rd(O/'reference-bindings.json');b['closed_letter_frame']=dict(path=str(ref),sha256=sha,ready=True,purpose='V09-03真实8.0秒闭合信件续接首帧；灰衣苟安、日间同榻、右手闭信与榻边位置，不增加正文',source=str(O/'edited/V09-03-normalized.mp4'),sourceTime=8.0);wr(O/'reference-bindings.json',b)
action='延续图片1的同一灰麻衣男子和同一封闭合的牛皮色折信。0–1秒双手握稳闭信；1–3秒将信缓慢转为平放，放在面前的草席榻边；草席承住信后，两手依次松开并向身侧收回；3–6秒信平躺在草席上，双手已离开，稳定停住。全过程信封封口保持闭合，折痕不翻开、不抽出信纸；不展示正文。男子保持榻上姿态。第一视角固定近景，单一连续镜头，镜头只拍参考图的男子上身、手、闭信与草席，不出现摄影者。纸和手有真实接触重量，信落下后不漂浮。全片没人说话，不作口型，不出现字幕、水印。仅纸与草席摩擦、衣料和轻风现场声，无BGM、无背景音乐、无配乐。'
request=dict(model='MiniMax-H3',duration=6,resolution='768P',ratio='16:9',content=[dict(type='text',text='写实历史电影，延续首帧的日间柔光与同一伤帐。'+action),dict(type='image_url',image_url=dict(local_path=str(ref)),role='first_frame')]);wr(O/'requests'/f'{cid}.local.json',request)
original=next(x for x in rd(O/'plan.json')['clips'] if x['id']=='V09-03')
c={**original,'id':cid,'duration':6,'referenceKeys':['closed_letter_frame'],'sourceLines':[],'entryState':'V09-03取出闭信的8秒位置，信仍在两手间。','endState':'同一闭信平放榻边且两手离开；未读正文，停UI-FIRST-LETTER前。','audioMode':'native-environment-only','repairOf':'V09-03','reason':'G4完整动态实证缺少闭信放下松手；仅补必要动作。','shots':[dict(start=0,end=6,action=action,camera='第一视角固定近景单镜，手与信、榻边接触全程可见。',lines=[])]}
r=rd(O/'repair-plan.json')
if not any(x['id']==cid for x in r['clips']):r['clips'].append(c)
wr(O/'repair-plan.json',r)
text=f'''尺寸：16:9
模型：seedance2.5
声音：有声音
时长：6秒

参考图（实际请求使用MiniMax-H3，沿用总控已授权API模型；本正文保留固定Seedance交付格式）

图片1：{ref}
用途：V09-03真实8.0秒闭信首帧；锁定同一日间伤帐、灰麻衣苟安、双手闭信和草席位置。SHA256：{sha}

视频生成Prompt

写实历史电影，柔和日光，低饱和土褐。接续取出信的前段，仅补放下闭信的必要动作；不新增台词或剧情。

分镜1｜0-6秒

参考图关系：图片1负责本镜唯一首帧、苟安身份衣服、日间空间与光照、双手所持闭信的朝向及草席榻边构图。全过程延续同一信件。

画面动作：{action.split('第一视角')[0]}

摄影切点：第一视角固定近景、单一连续镜头，双手与信的接触清楚，信放下后不再向上抬回。0秒续上前段8.0秒；6秒停在闭信和已退开的双手，无读信UI画面。

对白：无对白、无旁白、无心声。

连续性约束：灰麻衣黑巾苟安始终留榻上；同一封牛皮色闭信，封口与折痕不打开；不新增其他人物、器物或正文，不提前读信，不展示玩家脸/肩背。动作完成后才可接UI-FIRST-LETTER。

拍摄手法参考：沿用本组已核验《1917》的视线带动镜头原则，本镜采用稳定的第一视角近距离观察，用连续接触动作交代放物，不用第三人称反打。

声音要求：全片无BGM、无背景音乐、无配乐。只保留同步的纸与草席摩擦、衣料、轻风和帐布声；无对白，禁止新增人声。
'''
(O/'prompts'/f'{cid}.md').write_text(text,encoding='utf-8')
print(cid,sha)
