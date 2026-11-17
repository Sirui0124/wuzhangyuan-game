from pathlib import Path
import json,subprocess,hashlib
import imageio_ffmpeg as io
R=Path(__file__).resolve().parent;p=R/'检查与来源.json';d=json.loads(p.read_text('utf-8'))
assert hashlib.sha256(Path(d['output']).read_bytes()).hexdigest()==d['sha256']
sound=subprocess.run([io.get_ffmpeg_exe(),'-hide_banner','-ss','58.1','-i',d['output'],'-t','4.8','-vn','-af','volumedetect','-f','null','-'],capture_output=True,timeout=30)
assert sound.returncode==0
d['text_audio_check']=[line.strip() for line in sound.stderr.decode('utf-8','replace').splitlines() if 'max_volume:' in line or 'mean_volume:' in line]
d['visual_review']='已查看结语完整单帧与58—70秒2fps联系表，文字原句、楷体、完整显示、淡入淡出与logo顺序正确；未声称完整人工听审或用户通过。'
p.write_text(json.dumps(d,ensure_ascii=False,indent=2),'utf-8')
(R/'完整PV交付说明.md').write_text('''# 逆转五丈原 PV v7

2026-11-17；完整70秒，1280×720，24fps，1680帧。成片待用户视听review，未改正式游戏绑定。

本版整合此前已补拍的上方谷A01R与马谡C01K2，保留关羽松手落刀、诸葛亮反打和五丈原悬手灭灯。继续排除谷地原片开头夸张火球、马谡首版右前新增人物、叩首后昂首复位的旧C03。其余条件补拍未因本轮结尾合成扩大制作；本轮新增生成调用0次。

结尾：58—58.5秒留黑；58.5—59.5秒“若能重来，你想改写哪一段遗憾？”楷体单行渐显；59.5—62秒完整停留；62—62.75秒淡出；63—70秒衔接v15平面金墨书法logo动画。文字使用本机simkai.ttf直接排版，无视频生成、TTS或对白，文字段静音，不新增BGM。logo原有轻微风切音随片尾顺延。

完整视频：逆转五丈原-PV-v7-完整纯文字结尾版.mp4。
结尾预览：结尾预览-灯灭至Logo.mp4，取成片56—70秒。

检查已完成：完整解码、70秒时长及1680帧核验、文件哈希、结语单帧及完整结尾2fps抽帧、纯文字区间音量检查。未声称完成整片人工听审；技术检查与文字方案获用户同意不等于成片已获用户审核通过。来源哈希、结尾时码与检查细项见检查与来源.json。可复现剪辑脚本为finish.py。
''','utf-8')
print(d['text_audio_check'])
