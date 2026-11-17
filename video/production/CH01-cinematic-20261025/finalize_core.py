from pathlib import Path
import json,shutil,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).parent;CORE=ROOT/'source-art/core'
manifest=json.loads((CORE/'assets.json').read_text(encoding='utf-8'))
for name in ['姜维','魏延']:
    dst=CORE/(name+'.png');prior=OUT/'audit'/(name+'-submitted-reference-frame.png')
    if not prior.exists():shutil.copy2(dst,prior)
    clean=ROOT/'video/production/CH01-full-video-tight-20261023/参考图'/(name+'-单人身份.png');shutil.copy2(clean,dst)
    item=next(a for a in manifest['assets'] if a['id']==name)
    item.update(source=clean.as_posix(),frame=None,sha256=hashlib.sha256(dst.read_bytes()).hexdigest(),use=('单人身份图：只锁青年姜维的脸、高束发、蓝灰领与札甲；不复制表情、背景或站姿' if name=='姜维' else '单人身份图：只锁魏延中年宽脸、黑巾、短浓须、暗朱衣与细片札甲；不复制怒眉、背景或站姿'),submittedPreviousFrame=str(prior.resolve()))
manifest.update(version='20261025-core-v2',note='唯一核心参考入口。魏延、姜维采用单人身份图，避免多人影片帧引入旁人的脸或肩背；先前提交的实际附件由制作目录requests/*.references.json和audit/*submitted-reference-frame.png追溯，不能用当前图片覆盖既有请求事实。')
(CORE/'assets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
text='# 核心人物与场景资产\n\n2026-10-25。六名人物各保留一张当前身份参考：诸葛亮、魏延、姜维、甲、乙、斥候。魏延与姜维已换成单人身份图，避免把旁人及前景背影混入身份。场景、道具、现代工位按用途独立，合计18项。运行时仍以 GameStarter/web-demo/visual-assets.json 为准；整理不等于审核通过。\n\n| 资产 | 明确用途 |\n| --- | --- |\n'
for a in manifest['assets']:text+=f'| [{a["id"]}](<{a["path"]}>) | {a["use"]} |\n'
text+='\n本轮生成时使用的附件顺序、实际上传字节及哈希保存在 video/production/CH01-cinematic-20261025/requests/*.references.json；已提交任务不因本目录后续整理而改变。两张先前提交帧只保留于制作审计目录。\n'
(CORE/'README.md').write_text(text,encoding='utf-8')
html='<!doctype html><meta charset="utf-8"><title>逆转五丈原 · 核心资产</title><style>body{background:#141716;color:#eee;font:16px system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:22px}figure{margin:0;background:#222725;padding:16px}img{width:100%;height:260px;object-fit:contain}p{line-height:1.6;color:#bdc5c0}h1{font-weight:500}</style><h1>核心人物与场景</h1><p>六名人物各一个身份入口；场景与道具单列。18项，待review。</p><main>'
for a in manifest['assets']:html+=f'<figure><img src="{Path(a["path"]).name}"><h2>{a["id"]}</h2><p>{a["use"]}</p></figure>'
(CORE/'资产面板.html').write_text(html+'</main>',encoding='utf-8')
print('Core v2: 18 assets, standalone Jiangwei and Weiyan identity references; actual submitted frames retained separately.')
