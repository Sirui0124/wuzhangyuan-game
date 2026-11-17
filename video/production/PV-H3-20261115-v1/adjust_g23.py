from pathlib import Path
import pipeline

OUT=Path(__file__).resolve().parent;d=OUT/'G23';dest=d/'selected-extinction.mp4'
if not dest.exists():
    pipeline.run([pipeline.FF,'-v','error','-i',d/'source.mp4','-ss','1','-t','3','-vf','crop=1344:756:0:6,scale=1280:720:flags=lanczos,setsar=1,fps=24','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-an','-movflags','+faststart',dest],timeout=150)
pipeline.run([pipeline.FF,'-v','error','-i',dest,'-vf','fps=2,scale=384:216,tile=3x2','-frames:v','1','-update','1',d/'contact-extinction.jpg'],timeout=45)
state=pipeline.read(d/'state.json');state.update(selected_file=str(dest),selection_recipe=[{'source':str(d/'source.mp4'),'in':1,'out':4,'speed':1}],edit_note='依据实际火焰熄灭时间取原片1—4秒，确保工作剪辑包含熄灭和细烟，而不是在火焰尚亮时切走。');pipeline.save(d/'state.json',state)
pipeline.save(d/'selection-adjustment.json',{'source':'source.mp4','in':1,'out':4,'duration':3,'speed':1,'file':dest.name,'reason':state['edit_note'],'original_preserved':True})
print('G23 actual extinction range selected: source 1—4 seconds')
