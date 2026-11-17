from pathlib import Path
import json,hashlib,runpy
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1];ROOT=BASE.parents[2]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
mapping={'gouan':'苟安','wound_tent':'伤帐','camp_night':'粮仓','grain_clerk':'粮队管事','grain_table':'收件案头'}
manifest=read(BASE/'references'/'manifest.json') if (BASE/'references'/'manifest.json').exists() else {}
items=manifest.get('assets',manifest.get('references',manifest.get('images',manifest.get('items',[])))) if isinstance(manifest,dict) else manifest
if isinstance(items,dict):items=[dict(id=k,**v) for k,v in items.items()]
indexed={x['id']:x for x in items}
bindings={}
for key,cid in mapping.items():
    if cid not in indexed:continue
    item=indexed[cid]
    bindings[key]=dict(centralId=cid,path=item['path'],purpose=item.get('use',cid),sha256=item['sha256'],ready=item.get('ready',manifest.get('ready',False)))
    if key=='camp_night':bindings[key]['purpose']='仅继承营地木车、粮棚、帐布的材质与空间风格；夜间光线及营道构图按本镜设计，不复制仓内视点'
old=ROOT/'video'/'production'/'LI01-slip-remake-20261022'/'参考图-按序上传'
p=BASE/'references'/'source-frames'/'gouan-talk.png'
bindings['gouan_talk_frame']=dict(path=str(p),purpose='现片苟安灰麻衣、黑巾、短须与同一伤帐榻边视角；半侧卧撑前臂，唯一首帧，保持同脸同帐',sha256=hashlib.sha256(p.read_bytes()).hexdigest(),ready=bool(manifest.get('ready')),centralId='existing-gouan-talk-authorized')
for key,name,purpose in [('rescue_gouan','02-图片2-队长身份.png','仅锁LI01苟安未受伤身份、黑巾与旧甲；不复制背景他人'),('mountain_road','01-图片1-崎岖山道与扶车.png','锁山道、木车、麻袋、岩壁与崖侧方向；不复制原图动作'),('rescue_grip','04-图片4-崖下抓前臂关系.png','锁仰望握前臂的接触与空间；不增加背景帮手，动作必须持续承重')]:
    p=old/name
    bindings[key]=dict(path=str(p),purpose=purpose,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),ready=bool(manifest),centralId='existing-LI01-authorized')
(OUT/'reference-bindings.json').write_text(json.dumps(bindings,ensure_ascii=False,indent=2),encoding='utf-8')
runpy.run_path(str(OUT/'build_plan.py'),run_name='__main__')
