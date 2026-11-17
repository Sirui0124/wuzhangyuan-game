from pathlib import Path
import subprocess,imageio_ffmpeg as io,json
r=Path(__file__).resolve().parent;ff=io.get_ffmpeg_exe()
v=r.parent/'PV-regrets-20261117-v7/逆转五丈原-PV-v7-完整纯文字结尾版.mp4'
m=Path(r'C:\Users\zhousirui\Downloads\用户5806 - 止戈.mp3')
out=r/'逆转五丈原-PV-止戈配乐试剪A.mp4'
g="[1:a]atrim=start=180:end=238,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=3,afade=t=out:st=53:d=5,volume='if(between(t,26,39),0.25,0.5)':eval=frame,apad=whole_dur=70[body];[1:a]atrim=start=285:end=292,asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=0.25,afade=t=out:st=3.5:d=3.5,volume=0.55,adelay=63000:all=1[logo];[0:a]volume=0.7[fx];[fx][body][logo]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.94:level=false[a]"
p=subprocess.run([ff,'-y','-v','error','-i',str(v),'-i',str(m),'-filter_complex',g,'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','256k','-t','70','-movflags','+faststart',str(out)],capture_output=True)
if p.returncode:raise RuntimeError(p.stderr.decode('utf8','replace'))
p=subprocess.run([ff,'-v','error','-i',str(out),'-f','null','-'],capture_output=True,check=True)
reader=io.read_frames(str(out));meta=next(reader);reader.close()
(r/'试剪说明.md').write_text('''# 《止戈》配乐试剪 A

2026-11-17；供听审，未替换游戏正式 PV。

原曲 312.63 秒；画面沿用完整 v7，70 秒，不改变镜头。

| PV时间 | 配乐处理 |
|---|---|
| 0—58秒 | 原曲180—238秒，开头3秒渐入；26—39秒降低音乐以突出马谡动作；53—58秒渐出 |
| 58—63秒 | 楷体结语留静，保持原版声音 |
| 63—70秒 | 原曲285—292秒，Logo进入时起乐，末尾3.5秒淡出 |

原影片声轨保留为70%音量；音乐主体50%，马谡段25%，Logo段55%；混合后限峰。以上为线性增益，并非响度测量值。

这是一版基于音量结构制作的候选，不把音量峰值当成已确认的音乐高潮或节拍；尚未完成逐句人声、乐句衔接及完整人工听审。正式游戏继续使用原v7，视频期间游戏BGM保持关闭。若采用配乐版，应将音乐混入PV自身声轨，不能同时启动游戏BGM。

技术检查：输出完整解码通过；画面流直接复制，不重新压缩；输出时长70秒。
''','utf8')
print(json.dumps({'output':str(out),'duration':meta['duration'],'decode':'pass'},ensure_ascii=False))
