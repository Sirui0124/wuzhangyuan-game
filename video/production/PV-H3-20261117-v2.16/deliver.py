from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;m=json.loads((R/'final-technical.json').read_text('utf-8'));name=Path(m['file']).name
page=f'''<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第四章地图衔接 v2.16</title><style>body{{margin:0;background:#f6f5f1;color:#242424;font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif}}main{{max-width:1100px;margin:auto;padding:24px}}video,img{{width:100%;border-radius:6px}}video{{background:#111}}button{{padding:8px 14px;margin:5px;border:1px solid #bbb;background:white;border-radius:6px;cursor:pointer}}a{{color:#285f88;overflow-wrap:anywhere}}.grid{{display:grid;grid-template-columns:1fr 1fr;gap:18px}}figure{{margin:0}}@media(max-width:600px){{main{{padding:12px}}.grid{{grid-template-columns:1fr}}}}</style><main><h1>第四章地图衔接 · v2.16</h1><p>75.83秒 · 1280×720 / 24fps · 待review</p><video controls preload="metadata" src="{name}"></video><p><button data-time="0">从头播放</button><button data-time="69">查看结尾衔接</button><button data-time="71.6667">新地图镜头</button></p><p>修改71.67—75.83秒，改用第四章「前线军令」实际地形：横向江面、南岸山谷及营地区域。前1720帧和完整音轨已做解码哈希对比，均与v2.15一致。</p><p><a href="{name}">完整成片</a> · <a href="修订说明.md">修订说明</a> · <a href="G01/视频生成Prompt.md">本镜完整Prompt</a> · <a href="../PV-H3-20261117-v2.15/夷陵撤离与认印托付-PV-v2.15.mp4">上一版</a></p><div class="grid"><figure><img src="references/G01-第四章同地形绢图.png"><figcaption>新绢帛参考图</figcaption></figure><figure><img src="references/第四章前线军令-实际地图.png"><figcaption>游戏实际地形源图</figcaption></figure></div></main><script>document.querySelectorAll('button').forEach(b=>b.onclick=()=>{{let v=document.querySelector('video');v.currentTime=Number(b.dataset.time);v.play()}})</script></html>'''
(R/'成片审阅-v2.16.html').write_text(page,'utf-8')
doc=f'''# v2.16 片尾地图修订

用户意见：“结尾的地图这一幕最后3-4s请你修改下。效果很好。但是请你让地图与第四章游戏更一致”。

本轮修改71.667—75.833秒，共4.167秒。前1720帧与整条音轨经解码SHA256对比均相同，保留之前的对白、环境声和无BGM方案。完整输出仍为1820帧，1280×720、24fps。

## 地图依据

上一版采用旧九路“夷陵归路”的yiling-retreat-map-v1.png。本轮按目前迭代的“前线军令”三路版本重做：其server.mjs、publish.mjs和public/index.html实际引用demos/yiling-radio-lab-v6/public/terrain-night-v1.png。两种入口目前在游戏中并存，本轮对齐的是前线军令入口（/?chapter=yiling&playtest=command）。

新参考图以该图的横向江面、南岸谷地、左右山脊和营地空地作绢图，H3生成一次4秒近景。剪辑取前2.667秒，最后0.5秒转入实际游戏地图图像，并留1.5秒完整地图。画面中的地理绘制属于游戏设计，不当作夷陵考古地图。没有新增兵力、任务完成状态或交互界面。

## 交付与检查

完整片：{m['file']}

SHA256：{m['sha256']}

完整解码、1820帧核验通过。前段画面解码哈希一致：{m['prefix_1720_frames_hash_equal']}；全音轨解码哈希一致：{m['audio_hash_equal']}。新镜头原音未进入成片。抽帧与浏览器片尾播放检查另见review.json、browser-verification.json；没有新增人工听审或用户通过结论。

参考图由内置image_gen生成，原游戏地图另存来源副本。视频沿用指定MiniMax-H3流程、768P与真实参考图校验；原片、Prompt、请求和任务ID保存于G01。完整制作依据见production-plan.json，剪辑脚本reedit.py可重现。未修改游戏程序或地图资产本体。
'''
(R/'修订说明.md').write_text(doc,'utf-8')
print(name)
