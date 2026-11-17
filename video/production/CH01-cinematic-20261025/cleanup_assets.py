from pathlib import Path
import json,hashlib,re
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent
core=ROOT/'source-art/core';manifest=json.loads((core/'assets.json').read_text(encoding='utf-8'))
text='# 核心人物与场景资产\n\n2026-10-25。后续视频制作从本目录选参考，图片的具体用途见表。运行时依旧读取 `GameStarter/web-demo/visual-assets.json`。人物源图和现片帧的来源、提取时间与哈希记录于 assets.json；整理不等于用户审核通过。\n\n| 资产 | 用途 |\n| --- | --- |\n'
for a in manifest['assets']:text+=f'| [{a["id"]}](<{a["path"]}>) | {a["use"]} |\n'
(core/'README.md').write_text(text,encoding='utf-8')
html='<!doctype html><meta charset="utf-8"><title>逆转五丈原 · 核心资产</title><style>body{background:#141716;color:#eee;font:16px system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px}figure{margin:0;background:#222725;padding:16px}img{width:100%;height:260px;object-fit:contain}p{line-height:1.6;color:#bdc5c0}h1{font-weight:500}</style><h1>核心人物与场景</h1><p>每个身份和空间只给一个入口。图片为现用来源的整理，待review。</p><main>'
for a in manifest['assets']:html+=f'<figure><img src="{Path(a["path"]).name}"><h2>{a["id"]}</h2><p>{a["use"]}</p></figure>'
(core/'资产面板.html').write_text(html+'</main>',encoding='utf-8')
movies=json.loads((ROOT/'GameStarter/web-demo/public/cinematics.json').read_text(encoding='utf-8'))
active={str((ROOT/f['src'].lstrip('/')).resolve()).lower() for group in movies.values() if isinstance(group,list) for f in group if isinstance(f,dict) and f.get('src')}
for path in [ROOT/'GameStarter/web-demo/public/ending-video.json']:
    if path.exists():active.add(str((ROOT/json.loads(path.read_text(encoding='utf-8'))['src'].lstrip('/')).resolve()).lower())
# Only superseded intermediate dialogue cuts and the known failed opening repairs.
# Keep all raw source, selected historical versions, sounds, .meta, and user files.
candidates=[]
for p in (ROOT/'video/current').glob('*.mp4'):
    resolved=p.resolve();assert resolved.parent== (ROOT/'video/current').resolve()
    if str(resolved).lower() in active:continue
    if not (re.match(r'C1T\d+-\d+-cut-',p.name) or p.name in ['PR01-B-bridge-20261024-7048256b.mp4','PR01-B-bridge-20261024-single-entry-9895e228.mp4','PR01-C-20261024-1dbbcc7b.mp4','PR01-C-20261024-single-entry-b5c742a7.mp4']):continue
    candidates.append(dict(path=str(resolved),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),reason='已被当前绑定替代的中间剪辑；源片仍保留在video/raw，回收站可恢复'))
out={'intendedDirectory':str((ROOT/'video/current').resolve()),'protectedRuntime':len(active),'files':candidates,'bytes':sum(x['bytes'] for x in candidates)}
(OUT/'audit/cleanup-plan.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'coreAssets':len(manifest['assets']),'obsoleteCuts':len(candidates),'MiB':round(out['bytes']/1048576,2)},ensure_ascii=False))
