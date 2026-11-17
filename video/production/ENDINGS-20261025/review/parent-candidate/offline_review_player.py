"""Local, silent picture review only. No network, media library or system settings."""
from pathlib import Path
import av, tkinter as tk, time, json, hashlib
from PIL import ImageTk
R=Path(__file__).resolve().parent
FILE=R/'C1END-TENT-action-insert-preview.mp4'
frames=[]
with av.open(str(FILE)) as container:
    stream=container.streams.video[0]
    for frame in container.decode(stream):
        frames.append(frame.to_image().resize((960,540)))
fps=24
root=tk.Tk();root.title('离线画面复核 · C1END-TENT 修剪候选');root.configure(bg='#171b1b')
status=tk.StringVar();playing=False;position=0;origin=0;events=json.loads((R/'offline-playback-events.json').read_text(encoding='utf-8'))['events'] if (R/'offline-playback-events.json').exists() else []
label=tk.Label(root,bg='#171b1b');label.pack()
tk.Label(root,textvariable=status,font=('Consolas',13),bg='#171b1b',fg='white').pack(fill='x')
bar=tk.Frame(root,bg='#171b1b');bar.pack(fill='x')
def persist():
    data=dict(path=str(FILE),sha256=hashlib.sha256(FILE.read_bytes()).hexdigest(),videoFrames=len(frames),fps=fps,silent=True,events=events,scope='真实本地播放器事件；事件本身不等于人工目视审核，实际截图/序列观察另记')
    (R/'offline-playback-events.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
def display():
    label.photo=ImageTk.PhotoImage(frames[position]);label.configure(image=label.photo)
    status.set(f'{position/fps:06.3f} / {len(frames)/fps:.3f} s | frame {position+1}/{len(frames)} | '+('PLAYING' if playing else 'PAUSED')+' | 无声画面复核')
def tick():
    global position,playing
    if playing:
        position=min(len(frames)-1,int((time.monotonic()-origin)*fps))
        if position==len(frames)-1:
            playing=False;events.append(dict(event='ended',time=len(frames)/fps,wall=time.time()));persist()
        display()
    root.after(16,tick)
def play():
    global position,playing,origin
    position=0;origin=time.monotonic();playing=True;events.append(dict(event='play-from-start',time=0,wall=time.time()));persist();display()
def pause():
    global playing
    playing=False;events.append(dict(event='pause',time=position/fps,wall=time.time()));persist();display()
def seek(seconds):
    global position,playing,origin
    position=min(len(frames)-1,max(0,int(seconds*fps)));origin=time.monotonic()-position/fps;playing=True;events.append(dict(event='play-from-seek',time=position/fps,wall=time.time()));persist();display()
tk.Button(bar,text='从头播放',command=play,font=('Microsoft YaHei',12)).pack(side='left',padx=8,pady=6)
tk.Button(bar,text='暂停',command=pause,font=('Microsoft YaHei',12)).pack(side='left',padx=8)
for sec in [0,5.25,5.5,8.5,8.625,11.5]:
    tk.Button(bar,text=f'{sec}s',command=lambda s=sec:seek(s)).pack(side='left',padx=6)
display();tick();root.mainloop()
