# -*- coding: utf-8 -*-
from pathlib import Path
import json, shutil, hashlib, struct, html
root=Path(__file__).resolve().parents[1]
source=root.parent/'UI与人物整套_v04'
jobs=json.loads((root/'prompts.json').read_text())
names={'C01':'weiyan','C02':'scout','C03':'guard','C04':'relay','C05':'jiangwei','C06':'zhugeliang','S01':'camp_gate','S02':'report_post','S03':'relay_tent','S04':'waiting_area'}
assets=[]
for j in jobs:
    if j['id']=='UI03': continue
    src=source/j['file']
    if not src.exists(): raise FileNotFoundError(src)
    kind='characters' if j['id'].startswith('C') else 'scenes' if j['id'].startswith('S') else 'ui-reference'
    dest=root/(('runtime/'+kind+'/'+names[j['id']]+'.png') if kind!='ui-reference' else 'ui-reference/'+src.name)
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src,dest)
    data=dest.read_bytes(); width,height=struct.unpack('>II',data[16:24])
    item={'id':names.get(j['id'],j['id']),'promptId':j['id'],'kind':kind,'title':src.stem.split('_',1)[-1],'path':dest.relative_to(root).as_posix(),'width':width,'height':height,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'source':src.relative_to(root.parent.parent).as_posix(),'use':'带背景单人镜头，可用于人物卡和交谈镜头；无透明通道依赖' if kind=='characters' else '场景底图，无UI和前景人物' if kind=='scenes' else '视觉参考；界面文字、按钮与状态由程序绘制','status':'approved-baseline' if j['id']=='UI01' else 'implements-approved-change' if j['id']=='UI13' else 'prototype-ready'}
    if j['id']=='UI08': item['implementationNote']='回溯落点是中军帐门，场景高亮以运行状态为准。'
    if j['id']=='UI11': item['implementationNote']='当前试玩仅自动档；图中手动槽位为后续设计预留。'
    if j['id'] in ['C05','C06']: item['implementationNote']='剧情角色，不能任意选择直接交谈。'
    assets.append(item)
for a in json.loads((root/'supplement-v05.json').read_text()):
    data=(root/a['path']).read_bytes()
    a.update(bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),status='visual-restoration-v05')
    assets.append(a)
manifest={'version':'wuzhang-assets-v1.2','date':'2026-10-11','assets':assets,'runtimeCount':sum(a['kind']!='ui-reference' for a in assets),'referenceCount':12,'canonicalUI':['UI01','UI13'],'supersedes':'v04 UI03 full-height drawer','storySource':'content/chapters/wuzhang/chapter.json'}
(root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
mapping={'version':'wuzhang-assets-v1.2','sourceRoot':'../../source-art/五丈原_游戏资产库_v01','characters':{},'scenes':{},'cinematics':{},'ui':{},'fallbackCharacters':{'camp_gate':'guard','report_post':'weiyan','relay_tent':'relay','waiting_area':'weiyan'}}
for a in assets:
    if a['kind'] in ('characters','scenes','cinematics','ui'): mapping[a['kind']][a['id']]=a['path']
(root/'runtime-map.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2))
cards=[]
for a in assets:
    cards.append('<article data-kind="'+a['kind']+'"><a href="'+a['path']+'"><img loading="lazy" src="'+a['path']+'" alt="'+html.escape(a['title'])+'"></a><h2>'+html.escape(a['title'])+'</h2><p>'+a['id']+' · '+str(a['width'])+'×'+str(a['height'])+'</p><p>'+a['use']+'</p></article>')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>五丈原 · 游戏资产库 v1</title><style>body{margin:0;background:#15181b;color:#ede5d5;font:16px/1.65 system-ui}header,main{max-width:1400px;margin:auto;padding:32px}h1{font:32px serif}nav{display:flex;gap:12px;flex-wrap:wrap}button,a{color:inherit}button{background:#303234;border:1px solid #5c554a;padding:9px 18px;cursor:pointer}button.active{background:#813e33}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}article{background:#202225;padding:14px}img{width:100%;height:235px;object-fit:contain;background:#101315}h2{font-size:18px;font-weight:500}p{color:#b8b2a8;font-size:13px}article[hidden]{display:none}header>a{margin-right:20px}</style><header><h1>五丈原 · 游戏资产库 v1</h1><p>20项运行资产：4个场景、6个人物镜头、2个原构图电影镜头、8个无字UI组件。12张核心界面参考。主界面和右上证据浮窗为开发基准。</p><a href="README.md">定稿与使用说明</a><a href="manifest.json">资产清单</a><a href="design-tokens.json">布局参数</a><a href="http://127.0.0.1:8811/" target="_blank">打开本机试玩</a><nav><button class="active" data-filter="all">全部</button><button data-filter="scenes">场景</button><button data-filter="characters">人物</button><button data-filter="cinematics">电影镜头</button><button data-filter="ui">界面组件</button><button data-filter="ui-reference">核心UI</button></nav></header><main>'''+''.join(cards)+'''</main><script>document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('article').forEach(x=>x.hidden=b.dataset.filter!=='all'&&x.dataset.kind!==b.dataset.filter)})</script></html>'''
(root/'index.html').write_text(page)
print(json.dumps({'assets':len(assets),'runtime':sum(a['kind']!='ui-reference' for a in assets),'references':12,'totalMiB':round(sum(a['bytes'] for a in assets)/1048576,1)},ensure_ascii=False))

