from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent;P=R.parent
v2={u['id']:u for u in json.loads((P/'PV-regrets-20261117-v2/production-plan.json').read_text('utf-8'))['units']}
v4={u['id']:u for u in json.loads((P/'PV-regrets-20261117-v4/production-plan.json').read_text('utf-8'))['units']}
research=Path('D:/Projects/Game/江山北望-影像风格研究-20261117')
styles={k:str(research/'精选抽帧'/folder/file) for k,folder,file in [('A','A-开篇宫殿','001.50s.jpg'),('B','B-序章街巷','058.00s.jpg'),('C','C-终章山河','354.00s.jpg'),('D','D-结尾人物','012.00s.jpg')]}
specs=[
('A01R',8,'必需补拍',v4['A01R'], 'C', '''空间与尺度：前景湿泥、水沟、细炭屑；中景散落营帐支柱与残布，营道通向远坡；远景山坡降低对比，山体不重塑成城池。没有新增人物，帐篷和支柱提供尺度，木料不占据整个前景。近处保持清楚，薄雾仅在远谷，湿木不是镜面。
光线：阴天天光，中性自然色温；局部余火只照亮贴近的木头底面，不把整个营地染橙。
单一运镜：固定机位，替代v4的20厘米前推。以雨压火完成变化，不用推镜制造虚假的规模。
0—2秒：雨已经落下，散落木头贴地承重，一小簇遮雨处余火可见。2—6秒：雨水沿泥沟汇集，低火渐弱，薄烟随风散开。6—8秒：余火接近熄灭，保持同一营道和木料形态，接雨中诸葛亮。'''),
('C01K',7,'必需补拍',v4['C01K'],'D', '''空间与尺度：保留E07原画幅；左前刀斧手与低位刑刀形成前景，居中跪地马谡是表演主体，后景两卫兵、栅栏和帐篷保持原尺度。不得为纵深增加人群或移刀。
光线：原夕照方向不变，局部暖色只留在受光处，阴影与皮肤保持自然色，不复制研究D的室内窗光和灯具。
单一运镜：固定。动作按原速完成，不以慢动作或定格延长。脸、绳索、膝盖和触地点都须可辨。额头触地后切反打，后续不再接原昂首C03。'''),
('C02',8,'条件补拍：现有反打连续性不合格时',v2['C02'],'D', '''空间与尺度：以E10锁定监斩台、同一诸葛亮与案桌。前景案沿，中景人物上身，后景营帐；人物是主体，不改成宫殿轴线远景。马谡在左下画外。
光线：保持与E07一致的夕照方向，中性肤色与蓝灰袍，局部暖侧光克制，不加室内窗格或新灯。
主动作：0—2秒向左下方看已经叩首的马谡，嘴唇闭合，低位羽扇不动。2—6秒手臂自然举起原羽扇，连续遮住眼睛。6—8秒停住，保持浅呼吸，不放下扇、不重复举扇。
单一运镜：固定机位，表演负责变化。保持同轴反打；不水平翻转，不新增台词或流泪特效。'''),
('D01',8,'条件补拍：恢复帐内空间而不暴露落手错误',v2['D01'],'C', '''空间与尺度：只用N05原夜帐及人物，不增加城池、骑者、山河或新帐门。前景原木案边缘与地图，中景诸葛亮上身，后景原帐布褶皱及支撑结构；用明暗和遮挡分出三层。人物脸仍清楚，手和纸的间隙可见。研究C仅借空间递进，不复制山河构图；原图没有帐口就不造门框。
光线：原右侧油灯为唯一局部暖光来源，帐内暗部保留布纹；已有环境填光较冷但不额外造月光束，不让人脸全黄，不添加帐内雾。
0—2秒：同一诸葛亮坐于原案前，右手停在纸上方，灯仍燃烧。2—6秒：只发生一口浅呼吸和极小向地图的视线变化，右手始终不触纸。6—8秒：保持悬手和灯焰，接实际悬手特写D03R。嘴唇闭合，不写字、不抬扇。
单一运镜：固定中景，正常透视。不靠推近裁掉手来隐瞒接触错误，不伪称现有裁切版已呈现此空间。'''),
('B02',4,'条件补拍：既有落刀后结果停留不足时',v2['B02'],'C', '''空间与尺度：E06锁定已落地的完整长柄刀、红缨、湿泥与远处原军列。前景泥地和刀，中景芦苇与空处，远景原军列保持模糊小尺度。借C的尺度递进，不新增山脉或城池。人物不回画面，刀不重新回到手中。
光线：原自然夕照与湿地色彩不变，局部金属反光克制，湿泥不变镜面。
0—1秒：刀已完整落地，红缨末端轻轻贴下泥面。1—4秒：刀始终静止，水纹渐散，芦苇随风微动。不得再次落刀、抬刀、反弹、消失或变形。
单一运镜：固定低机位，保持真实原速。与前镜松手之间采用省略落地过程的结果切，不把此已落地镜头称作完成坠落动作。''')]
rows=[]
for id,duration,priority,u,style,body in specs:
 refs=u['reference_paths']; base=u['prompt'] if id in ('A01R','C01K') else ''
 if id=='A01R':base=base.replace('相机缓慢前推20厘米','摄影机固定')
 doc=f'# {id}｜20261117风格优化独立Prompt\n\n平台：MiniMax-H3；请求参数设计：768P、16:9、{duration}秒。未提交；prompt状态：待review；视频状态：待生成。{priority}。不采用Seedance接口或假定首尾帧锁定。\n\n## 实际参考图顺序与用途\n\n'
 doc+=('\n'.join(f'{i+1}. `{x}`：唯一身份、服装、道具及场景依据。' for i,x in enumerate(refs)) if refs else '无图，文字生成。被否定的柴火截图不作为生成参考；场景延续性须待生成后核对。')
 doc+=f'\n\n研究风格帧：`{styles[style]}`，仅供导演阅读，不上传生成，不替代本作身份或场景。\n\n## 镜头执行\n\n{body}\n\n{base}\n\n## 声音与连续性\n\n唯一允许发声的原句：无。禁止人声、对白、旁白、歌词、音乐及低频铺底；角色名、编号、时段和导演说明不得朗读。只留与画面同步的雨水或营地风、呼吸、衣料接触声。无字幕、水印或工作文字。16:9满幅真人实拍质感、自然肤色和中性自然色温，关键脸手道具清晰；无整体黄滤镜、无游戏CG、无额外人物或新剧情。单镜内不切换场景、不生成转场。参考图仅为reference_image，不承诺像素级首帧锁定。\n\n验收待办：完整动作与接触关系、人物轴线、道具重量、材质、实际声音及前后切点逐项核对。Prompt未测试，文稿检查不等于视听通过。\n'
 f=R/f'{id}-风格优化Prompt.md';f.write_text(doc,'utf-8')
 rows.append(dict(id=id,name=u['name'],prompt_path=str(f),prompt状态='待review',当前状态='待生成',duration=duration,priority=priority,reference_paths=refs,style_reference=styles[style],style_upload=False,sha256=hashlib.sha256(f.read_bytes()).hexdigest(),current_video=None,source_version='v4' if id in v4 else 'v2/v3'))
for row in rows:
 for path in row['reference_paths']+[row['style_reference']]:assert Path(path).is_file(),path
 assert hashlib.sha256(Path(row['prompt_path']).read_bytes()).hexdigest()==row['sha256']
(R/'设计台账.json').write_text(json.dumps(dict(date='2026-11-17',scope='仅设计，不生成、不改绑定',units=rows,checks='5份正文回读哈希一致；所有列出图路径存在；未做新视频视听检查'),ensure_ascii=False,indent=2),'utf-8')
print('Validated 5 independent prompt documents and reference paths.')
