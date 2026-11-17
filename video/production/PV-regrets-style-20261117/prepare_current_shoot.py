from pathlib import Path
import json,hashlib,copy
R=Path(__file__).resolve().parent;P=R.parent
old=json.loads((P/'PV-regrets-20261117-v4/production-plan.json').read_text('utf-8'))
units=copy.deepcopy(old['units'])
ref=R/'references/A01R-雨中谷地-实拍质感参考-v1.png'
units[0]['reference_paths']=[str(ref)]
units[0]['prompt']='''8秒连续单镜头，16:9满幅真人历史电影实拍质感。参考图是本镜唯一场景构图与材质依据，精确保留左侧倒塌麻布帐篷、右侧残帐、散落贴地烧损支柱、中央营道与后方山谷的位置和尺度。正常透视，摄影机固定，前景木料与泥土清楚，中景残帐可读，远山对比自然降低；不加近景浓雾。保留木头不均匀炭化、真实纤维断口、残布重量和物体接触阴影，不变成规整篝火、塑料圆木或镜面地面。
0—2秒：保持参考图现状，细雨落下，右侧残篷内现有低火轻轻跳动。2—6秒：雨水沿已有沟槽流动，形成小水纹，原火焰逐步压低，细烟从原火源随风散开。6—8秒：火势继续减弱，只剩极低余焰，保持残木、帐布、营道不变。不重新燃起大火，不倒塌新帐篷，不出现爆炸、人群、城池或新道具。
阴天天光有明确方向，中性自然色温；真实暖火光只影响原火源邻近布木。阴影保留纹理，柔和高光过渡，轻微胶片颗粒，避免游戏CG、整体黄偏、过锐HDR及整屏蓝橙染色。雨和积水属于上方谷剧情，保留但不夸张成洪水。全程自然速度，不慢动作、不自动剪切、不生成转场。
唯一允许发声的原句：无。无人声、对白、旁白、音乐或低频铺底；不得朗读导演说明。声音仅自然雨、细水流及微弱燃烧声。画面无文字、字幕、水印。'''
units[1]['prompt']+='\n摄影质感补充：保留E07真实夕照方位，脸部肤色自然，粗布、绳纤维、旧铁刀反光各自可辨；暗部不过黑，背景不过度虚化，脸、膝盖与额头触地点必须可读。单次完整叩首按自然速度完成，不能用定格、慢放或突然趴倒代替。'
rows=[]
for u in units:
 f=R/(u['id']+'-当前补拍Prompt.md')
 refs='\n'.join(f'{i+1}. `{p}`：'+('锁定场景、构图、材质。' if u['id']=='A01R' else 'E07锁定人物身份、四人站位、低刀及相机角度。') for i,p in enumerate(u['reference_paths']))
 f.write_text(f"# {u['id']} 当前补拍稿\n\n2026-11-17；MiniMax-H3；768P；16:9；{u['duration']}秒。用户本轮明确授权微调后生成并剪辑；文稿待review，不冒称用户已审核具体版本。当前未提交，视频待生成。\n\n## 参考图顺序\n\n{refs}\n\n## Prompt\n\n{u['prompt']}\n",'utf-8')
 for p in u['reference_paths']:assert Path(p).is_file()
 u.update(prompt_path=str(f),prompt_sha256=hashlib.sha256(f.read_bytes()).hexdigest(),reference_sha256=[hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in u['reference_paths']],prompt状态='待review',当前状态='待生成')
 rows.append(u)
plan=dict(date='2026-11-17',authorization='用户本轮要求稍微调整Prompt风格后生成视频片段并剪辑。',units=rows,submission_count=0,blocker='原H3入口与配置未找到，指定DPAPI凭据不存在；未提交生成。',output_target='65.25秒，1280x720，24fps；待实际素材核对',edit_operations=[dict(action='replace',v3_interval=[1.25,9.25],shot='A01R',duration=8),dict(action='replace',v3_interval=[26,27.5],shot='C01K',duration=7),dict(action='remove',v3_interval=[35.5,37],shot='C03',reason='叩首后不能突然昂首复位')],sound='无对白、无BGM；新音轨逐条检查，不能沿用含人声或音乐的生成原声。',review='未生成，未进行新片视听审核。')
(R/'当前补拍与剪辑清单.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),'utf-8')
print('Prepared 2 reference-bound prompts; hashes verified; no generation submitted.')
