from pathlib import Path
import sys,json,hashlib,time,urllib.request
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[3]
sys.path.insert(0,str(PROJECT.parent/'平行世界/tools'))
import video_api as api
G5=PROJECT/'video/production/CH02-films-20261025/groups/G5'
OUT=ROOT/'revision-v2'
SPECS=[
 dict(id='E1-CLERK-NOCARD-V2',ref='clerk-receiving-desk',old='V36-03',duration=8,
 text='Historical live-action, same Chinese military clerk and same tent as the first frame. One continuous eye-level medium close-up. Start talking immediately, calmly and briskly, looking just beside camera: “李严交出此次粮运调度职责，受处分，仍须配合查问。” Only this clerk speaks. Keep the camera on his face and upper torso for all eight seconds. His hands remain resting below frame; no picking up or opening documents. A gentle push in, never tilt toward the desk. Same face, hat, beard, black robe, natural daylight. No text, subtitles, captions, floating panels, title cards, watermarks or readable document inserts. No extra people. Natural Chinese speech and quiet tent ambience only; no music.',
 beats=[('0-2','参考图中的同一军吏立即开始宣读，神情平静；摄影机轻推至胸像，桌案不成为展示对象。','李严交出此次粮运调度职责，'),('2-6.8','保持军吏胸像，正常嘴部表演，一气读完；双手在画外，无取卷动作。','受处分，仍须配合查问。'),('6.8-8','军吏读完轻轻点头，留短促气口；保持同一机位。','无新增对白')]),
 dict(id='E1-GOUAN-HAPPY-V2',ref='gouan-empty-cart-road',old='V37-02-R2',duration=8,
 text='Historical live action. Same Gou An, same face, short moustache and beard, black headcloth, plain grey linen clothes, same empty wooden grain cart and overcast camp road as the first frame. He is relieved to be alive, in noticeably good spirits and happy to have his companion: his tense eyes soften immediately, cheeks lift into a warm unmistakable smile. 0-2 seconds: he looks back at the companion just beside the camera with a friendly grin, shoulders relaxed. 2-5 seconds: still smiling, in a bright playful Mandarin voice he says exactly “别光看着，搭把手！” It is an affectionate invitation, not an angry command. 5-8 seconds: he gives a small cheerful nod, turns toward the road and firmly places both hands on the rear rail ready to push. He stays at the LEFT rear of the cart; no walking through it or changing sides. The cart remains visibly empty with a bare wooden floor. Camera remains near the cart behind him and gently follows his natural turn, one continuous shot. Do not show the companion face or add any foreground person. No sad frown, no bowed head, no crying, no victory celebration. No titles, text, subtitles, overlays, watermarks. Only the specified line, cloth rustle and light wind; no music.',
 beats=[('0-2','同一苟安回望镜头旁的我，眉头舒展、眼角和嘴角上扬，肩膀放松；中近景看清开心。','无对白'),('2-5','苟安保持真切笑意，轻快地招呼，语气带一点熟人间的打趣，不是命令。','别光看着，搭把手！'),('5-8','笑着点头，转回路面，两手落到空车后沿准备推；机位随他的注意力轻微转动，不越轴。','无新增对白')])
]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def prepare():
 for s in SPECS:
  for f in ['prompts','requests','tasks','generated']:(OUT/f).mkdir(parents=True,exist_ok=True)
  ref=G5/'references'/s['ref']/'image-01.png'
  body=read(G5/'requests'/f"{s['old']}.json")
  url=next(c['image_url']['url'] for c in body['content'] if c['type']=='image_url').replace('https://res.cloudinary.com/','https://res-1.cloudinary.com/')
  verification=api.verify_image_url(url,hashlib.sha256(ref.read_bytes()).hexdigest())
  body.update(duration=s['duration'],content=[{'type':'text','text':s['text']},{'type':'image_url','image_url':{'url':url},'role':'first_frame'}])
  api.validate_payload(body)
  api.atomic_json(OUT/'requests'/f"{s['id']}.json",body)
  api.atomic_json(OUT/'requests'/f"{s['id']}.reference.json",dict(path=str(ref),sha256=hashlib.sha256(ref.read_bytes()).hexdigest(),role='first_frame',verification=verification))
  lines=['尺寸：16:9','模型：MiniMax-H3（OpenAI Next API）','声音：有声音','时长：8秒','','## 参考图（实际上传顺序）','',f'1. 图片1｜{ref}｜唯一实际上传首帧；锁定人物身份、衣着、场景、构图、道具与光照。','','## 视频生成 Prompt','']
  for i,(t,action,dialogue) in enumerate(s['beats'],1):
   lines += [f'### 分镜{i}｜{t}秒','',f'参考图关系：图片1负责本镜同一人物的脸、服装、场景与光照；空车镜头同时锁定左后方站位和裸木车底，不改变身份或凭空添加人物。',f'画面动作、摄影切点：{action} 本段为同一连续镜头内节拍，无硬切。',f'对白：{dialogue}','']
  lines += ['连续性约束：无文字浮层、字幕或说明卡；不展示玩家正脸；不新增剧情事实。苟安是幸存后的轻快，不表示粮荒已经解决。','', 'API实际发送文本：',s['text'],'','拍摄手法参考：《1917》摄影师访谈中按人物注意力与动作安排机位移动的方式，应用于本片各节拍；本片只借用动机明确的轻微运镜，不模仿时代或战争内容。已核验来源：https://theasc.com/article/lives-under-siege-the-goldfinch-and-1917/','','声音要求：全片无BGM、无背景音乐、无配乐。只保留上述指定人物对白及同步衣料、轻风或帐内环境声；空白节拍禁止新增人声。']
  (OUT/'prompts'/f"{s['id']}.md").write_text('\n'.join(lines)+'\n',encoding='utf-8')
  print(s['id'],'reference verified; prepared',flush=True)
def submit():
 original=api.poll_task
 api.poll_task=lambda p,**kw:original(p,max_polls=1)
 for s in SPECS:
  p=OUT/'tasks'/f"{s['id']}.json"
  if p.exists():print(s['id'],'existing state; no repeat POST');continue
  d=api.submit_request(OUT/'requests'/f"{s['id']}.json",p)
  d['last_poll_epoch']=time.time();api.atomic_json(p,d)
def poll():
 for s in SPECS:
  p=OUT/'tasks'/f"{s['id']}.json"
  d=read(p)
  if d.get('status') not in api.TERMINAL and time.time()-d.get('last_poll_epoch',0)>=120:
   d=api.poll_task(p,max_polls=1);d['last_poll_epoch']=time.time();api.atomic_json(p,d)
  print(s['id'],d.get('status'),flush=True)
  target=OUT/'generated'/f"{s['id']}.mp4"
  if d.get('status')=='succeeded' and not target.exists():
   with urllib.request.urlopen(urllib.request.Request(api.public_https(d['result_url']),headers={'User-Agent':'Mozilla/5.0'}),timeout=120) as r:
    api.public_https(r.url);data=r.read(200*1024*1024+1)
   if b'ftyp' not in data[:64] or len(data)>200*1024*1024:raise ValueError('Unexpected payload')
   target.with_suffix('.part').write_bytes(data);target.with_suffix('.part').replace(target)
   print('Downloaded',s['id'],len(data),flush=True)
if __name__=='__main__':globals()[sys.argv[1]]()
