from pathlib import Path
import json,hashlib,html
R=Path(__file__).resolve().parent
meta=json.loads((R/'final-technical.json').read_text('utf-8'));timeline=json.loads((R/'edit-timeline.json').read_text('utf-8'))
plan=json.loads((R/'production-plan.json').read_text('utf-8'));selected={'L01','L02S','L03','L04R','L05','A01'}
records=[]
for u in plan['units']:
 d=R/u['id'];src=d/'source.mp4';prompt=d/'prompt.txt'
 u.update(selected_for_edit=u['id'] in selected,prompt_status='待review',video_status='待review' if u['id'] in selected else '待更新',current_video=str(src) if src.exists() else None)
 u['request_prompt_sha256']=hashlib.sha256(prompt.read_bytes()).hexdigest()
 u['reference_records']=[dict(path=p,sha256=hashlib.sha256(Path(p).read_bytes()).hexdigest()) for p in u['reference_paths']]
 tasks=list(d.glob('api/**/task.json'));ids={json.loads(p.read_text('utf-8-sig'))['task_id'] for p in tasks};assert len(ids)==1
 u['task_id']=next(iter(ids));records.append(dict(id=u['id'],task_id=u['task_id'],selected=u['selected_for_edit']))
 state=d/'state.json'
 if state.exists():s=json.loads(state.read_text('utf-8'));s['version']='v2.15';state.write_text(json.dumps(s,ensure_ascii=False,indent=2),'utf-8')
plan.update(current_film=meta['file'],film_sha256=meta['sha256'],film_status='待review',tasks=records)
(R/'production-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
buttons=''.join(f'<button data-time="{s["timeline_in"]:.3f}">{html.escape(s["id"])} · {s["timeline_in"]:.1f}s</button>' for s in timeline['shots'])
refs=''.join(f'<figure><img loading="lazy" src="references/{p.name}"><figcaption>{html.escape(p.stem)}</figcaption></figure>' for p in sorted((R/'references').glob('*.png')))
links=''.join(f'<li><a href="{u["id"]}/视频生成Prompt.md">{u["id"]} {html.escape(u["title"])}</a> · {"选用" if u["id"] in selected else "停用"}</li>' for u in plan['units'])
page=f'''<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>撤离与认印托付 · v2.15</title><style>body{{margin:0;background:#f5f4f0;color:#252525;font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif}}main{{max-width:1120px;margin:auto;padding:24px}}h1{{font-size:27px}}video{{width:100%;background:#111;border-radius:8px}}button{{padding:8px 12px;border:1px solid #ccc;background:white;border-radius:6px;margin:4px;cursor:pointer}}a{{color:#245c88;overflow-wrap:anywhere}}.refs{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}}figure{{margin:0}}img{{width:100%;border-radius:6px}}.note{{padding:14px;background:#e8eef3;border-radius:6px}}@media(max-width:600px){{main{{padding:12px}}h1{{font-size:22px}}}}</style><main><h1>夷陵撤离与认印托付 · v2.15</h1><p>待用户review · {meta['duration']:.2f}秒 · 1280×720 / 24fps · 无BGM，保留人物对白及环境音</p><video controls preload="metadata" src="{Path(meta['file']).name}"></video><nav>{buttons}</nav><p class="note">前39.42秒沿用v2.14。续段为印文揭示、刘备倾听、认印与传令，结尾转入现用夷陵地图画面。本次没有修改游戏任务逻辑。抽帧、ASR、声音分类与浏览器检查分别记录，不代表用户通过或完整人工听审。</p><p><a href="{Path(meta['file']).name}">打开完整MP4</a> · <a href="交付说明.md">交付与检查说明</a> · <a href="research/印文依据与制作边界.md">印文来源</a> · <a href="production-plan.json">制作台账</a></p><h2>参考图</h2><div class="refs">{refs}</div><h2>各镜完整生成Prompt</h2><ul>{links}</ul></main><script>document.querySelectorAll('button[data-time]').forEach(b=>b.onclick=()=>{{let v=document.querySelector('video');v.currentTime=Number(b.dataset.time);v.pause()}})</script></html>'''
(R/'成片审阅-v2.15.html').write_text(page,'utf-8')
doc=f'''# 夷陵撤离与认印托付PV v2.15

2026-11-17，待用户review。

完整成片：{meta['file']}

时长{meta['duration']:.3f}秒，1280×720，24fps，{meta['frames']}帧，AAC双声道。H3原生素材为1344×768，剪辑中心裁为16:9后缩至720p；不称为原生1080p。前39.42秒取自v2.14，保留原人物声音与画面顺序。

## 实施

- 原撤离PV尾部暗场衔接火光中的铜印反刻印文；再拉开到旧绢、红褐绦带和托印双手。
- 玩家画外对白与刘备倾听画面分开制作，避免刘备承担玩家口型。第一轮L02/L02R错误文书和口型已停用。
- 刘备认印时保留短暂停顿、看印与“士元”，随后收住情绪传令接应。L04原版额外台词及字幕已停用。
- 不采用生成素材中的制作说明朗读；印章、军图段改配干净环境与布料声，认印仅保留所需原句及相邻呼吸。无新增BGM。
- 结尾军图转入现行主流程的夷陵地图图像。这里只完成影片衔接，没有修改游戏的播放节点、兵力与权限。

## 印文

依据教育部《異體字字典》所载《说文》龐、統篆形，采用实体印底镜像、阴文凹刻的道具设计；不使用现代简体、绢上红印或发光显字。字形来源、首版镜像修订与局限见research/印文依据与制作边界.md。这是有时代字形依据的剧情道具，不是庞统实物复原，尚无专业古文字学鉴定。

## 检查边界

完整解码、帧数、音视频时长与SHA256已核验；参考图与源片联系表做过目视检查。对白使用ASR辅助定位，背景音乐使用音频事件分类筛查，这些不能替代完整人工听审。浏览器播放及最终声音筛查另见对应JSON记录；仅在记录存在且为pass时代表已执行。成片未取得用户审核通过。

SHA256：{meta['sha256']}

## 交付文件

- 成片审阅-v2.15.html：播放、镜头定位、参考图与Prompt链接。
- production-plan.json：各镜正文、真实参考顺序、哈希、任务ID与状态。
- 各镜/视频生成Prompt.md及prompt.txt：独立请求正文与实际提交文本。
- references/：本轮内置image_gen制作的项目参考图。
- assemble.py、edit-timeline.json、audio-provenance.json：剪辑与声音来源。
- 各镜/source.mp4与api/：原片及生成记录。所有有ID的恢复仅查询原任务，没有未知结果自动重投。
'''
(R/'交付说明.md').write_text(doc,'utf-8')
print('Delivery documents written')
