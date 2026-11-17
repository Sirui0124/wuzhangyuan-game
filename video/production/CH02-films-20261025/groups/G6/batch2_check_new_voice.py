from pathlib import Path
import json,hashlib,wave
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'user-review-batch2'
s=json.loads((OUT/'CH2-E4-LATE-002-R1-seed-audio-state.json').read_text(encoding='utf-8'))
assert s['status']=='succeeded' and s['model']=='seed-audio-1.0' and s['referenceUploaded'] and s['noClone'] and s['noPresetSpeaker']
p=Path(s['file']);assert hashlib.sha256(p.read_bytes()).hexdigest()==s['sha256']
with wave.open(str(p)) as w:dur=w.getnframes()/w.getframerate();rate=w.getframerate();channels=w.getnchannels()
assert rate==48000 and abs(dur-4.5)<.1
rows=[dict(node=s['node'],path=str(p),sha256=s['sha256'],duration=dur)]
(OUT/'new-voice-manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(duration=dur,rate=rate,channels=channels,referenceUploaded=True,sha256=s['sha256'],subtitle=s.get('subtitle')),ensure_ascii=False))
