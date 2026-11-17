import render_film as m
from pathlib import Path
import json
R=Path(__file__).resolve().parent
shots=[s for s in json.loads((R/'final-edit.json').read_text('utf-8'))['shots'] if s['id'] in ('V14','V15','V17')]
parts=[m.part(s) for s in shots];m.concat([p[0] for p in parts],R/'edit/masu-picture.mp4');m.concat([p[1] for p in parts],R/'edit/masu-mix.wav')
m.run([m.FF,'-v','error','-y','-i',R/'edit/masu-picture.mp4','-i',R/'edit/masu-mix.wav','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',R/'马谡诸葛亮-声音与衔接检查片.mp4'])
print('Ma Su continuity excerpt rendered')
