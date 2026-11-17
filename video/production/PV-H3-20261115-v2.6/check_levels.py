from pathlib import Path
import soundfile as sf,numpy as np,json
R=Path(__file__).resolve().parent
rows=[]
for p in sorted((R/'edit').glob('V*-sound.wav')):
 a,sr=sf.read(p);rms=np.sqrt(np.mean(a*a));peak=np.max(np.abs(a))
 rows.append({'id':p.stem,'rms_db':round(20*np.log10(max(1e-9,rms)),2),'peak_db':round(20*np.log10(max(1e-9,peak)),2)})
(R/'sound-levels.json').write_text(json.dumps(rows,indent=2),'utf-8');print(json.dumps(rows))



