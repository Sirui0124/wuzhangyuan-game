import render_film as m
from pathlib import Path
import json
R=Path(__file__).resolve().parent;P=R.parent/'PV-H3-20261115-v2.2'
shots=[dict(id='V20',title_name='伸手抓牢',source=str(P/'K01RR/source.mp4'),duration=3.5,gain_db=0),dict(id='V21',title_name='握紧受力',source=str(P/'K03/source.mp4'),**{'in':.25},duration=2.75,gain_db=10,picture_fade_out=.25),dict(id='V22',title_name='片名',title=True,duration=4,audio_source=str(R/'sound/ending-breath-tail.wav'),audio_in=0,audio_speed=1)]
parts=[m.part(s) for s in shots];m.concat([p[0] for p in parts],R/'edit/ending-picture.mp4');m.concat([p[1] for p in parts],R/'edit/ending-mix.wav')
m.run([m.FF,'-v','error','-y','-i',R/'edit/ending-picture.mp4','-i',R/'edit/ending-mix.wav','-c:v','copy','-c:a','aac','-b:a','192k','-t',10.25,'-movflags','+faststart',R/'片尾修订检查片.mp4'])
(R/'ending-shots.json').write_text(json.dumps(shots,ensure_ascii=False,indent=2),'utf-8')
print('Ending preview rendered')
