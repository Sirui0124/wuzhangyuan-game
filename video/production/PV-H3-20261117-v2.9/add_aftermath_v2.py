from pathlib import Path
import json,subprocess,sys
R=Path(__file__).resolve().parent
review={'technical':'pass','motion_review':'rejected','user_review':'待review','selected_for_work_edit':False,'method':'2fps entire source contact sheet','notes':['Ignored locked-camera instruction; large rotating pan invents road layout','Additional orange flames visible in purported fully extinguished camp','Do not use A21 picture; new A22 request with simplified motion control']}
(R/'A21/review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2),'utf-8')
s=dict(id='A22',title='同机位雨后空营-固定机位修正版',duration=9,reference_paths=[str(R/'references/A21.png')],prompt='9秒，16:9，真人历史电影实拍质感。严格固定三脚架机位。画面从第一帧到最后一帧保持参考图原有构图，所有木柱、帐篷顶点、道路、车轮、木箱和树林的位置完全不变。雨后烧毁的空军营，所有火早已彻底熄灭。唯一可见运动：木梁上几颗水滴缓缓滴落，湿黑布条在微风里轻轻摆动，淡薄的灰烟缓慢上升。镜头始终静止，环境微动；景别始终为参考图的完整大全景。空无一人，保持灰色阴天自然光、湿木炭、粗麻、旧木的真实细节。声音只保留稀疏滴水、轻微湿布声与低声风声，没有人物声音，没有对白，没有旁白，没有音乐，没有配乐，没有BGM。画面无文字、无字幕、不淡出。')
p=R/'A22-spec.json';p.write_text(json.dumps(s,ensure_ascii=False,indent=2),'utf-8');subprocess.run([sys.executable,str(R/'add_one_unit.py'),str(p)],check=True)
for fn in ['prepare_edit.py','build_sound.py']:
 p=R/fn;p.write_text(p.read_text('utf-8').replace("R/'A21/source.mp4'","R/'A22/source.mp4'").replace("clip('A21'","clip('A22'"),'utf-8')
