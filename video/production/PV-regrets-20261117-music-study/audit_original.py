from pathlib import Path
import imageio_ffmpeg as io
p=Path('video/production/PV-regrets-20261117-v2/audit_music.py').resolve()
s=p.read_text('utf8');s=s.replace("FF=r'D:/AI视频/VJ-1106/motion-runtime/node_modules/ffmpeg-static/ffmpeg.exe'",'FF='+repr(io.get_ffmpeg_exe()))
exec(compile(s,str(p),'exec'),{'__file__':str(p),'__name__':'__main__'})
