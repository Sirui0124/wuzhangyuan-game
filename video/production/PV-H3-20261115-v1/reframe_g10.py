from pathlib import Path
import pipeline

OUT=Path(__file__).resolve().parent;d=OUT/'G10';dest=d/'selected-full-frame.mp4'
if not dest.exists():pipeline.run([pipeline.FF,'-v','error','-i',d/'source.mp4','-t','8','-vf','crop=992:558:176:104,scale=1280:720:flags=lanczos,setsar=1,fps=24','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-an','-movflags','+faststart',dest],timeout=180)
pipeline.run([pipeline.FF,'-v','error','-i',dest,'-vf','fps=1,scale=384:216,tile=4x2','-frames:v','1','-update','1',d/'contact-full-frame.jpg'],timeout=50)
s=pipeline.read(d/'state.json');s.update(selected_file=str(dest),selection_recipe=[{'source':str(d/'source.mp4'),'in':0,'out':8,'speed':1,'crop_record':str(d/'reframe-record.json')}],edit_note='模型原片自带上下黑边，已从实际有效画面内重新取16:9构图，保留傅肜脸、持刀与环境。');pipeline.save(d/'state.json',s)
pipeline.save(d/'reframe-record.json',{'native_size':[1344,768],'detected_active_picture':[1344,564,0,102],'crop':[992,558,176,104],'output':[1280,720,24],'source_range':[0,8],'file':dest.name,'source_preserved':True,'reason':s['edit_note'],'quality_note':'从无黑边有效画面重新构图再缩放，不增加原生细节。'})
print('G10 embedded letterboxing removed by editorial reframing')
