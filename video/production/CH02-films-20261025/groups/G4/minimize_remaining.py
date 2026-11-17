"""Use short literal shots; keep detailed source tracing in the independent MD."""
from pathlib import Path
import json
OUT=Path(__file__).resolve().parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,v):
    q=p.with_suffix(p.suffix+'.tmp');q.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8');q.replace(p)
clips=read(OUT/'plan.json')['clips']+read(OUT/'retake-plan.json')['clips'];changed=[]
for c in clips:
    cid=c['id']
    if (OUT/'tasks'/f'{cid}.json').exists():continue
    body=read(OUT/'requests'/f'{cid}.local.json')
    if c.get('textOverlay'):
        text='A single continuous locked-off eye-level view of this exact empty wooden desk and its blank paper, matching the supplied first frame throughout. Everything remains in place. Gentle natural light changes only. The paper stays completely blank. No people or hands enter. Silent scene with soft tent ambience only. No speech, no music, no writing, no subtitles, no montage.'
    elif cid=='V26-02-R2':
        text='Single continuous first-person view across this desk at the same military clerk in the supplied first frame. One closed, tied bundle of bamboo slips is already resting at the near edge of the desk. The clerk gently slides that bundle toward himself with one hand, then rests his hand. The bundle remains closed and tied. Camera remains stationary, no other person enters the frame. Soft cloth and wood contact sounds only. No speech, no music, no writing or subtitles.'
    else:
        place='Gou An resting on his rope bed' if c['refset']=='gou' else 'the military clerk seated at this desk'
        speech='He listens silently with lips gently closed throughout. Only quiet breathing and a natural blink.' if c['silent'] or c.get('audioOverlay') else 'He looks toward the camera and speaks Mandarin naturally, once: “'+c['lines'][0]['text']+'” Then his lips close.'
        text=f'A single locked-off first-person shot of {place}, exactly matching the supplied first frame: same face, clothes, pose, lighting and location. Only this one man remains in the frame throughout. His arms stay resting in their starting position. {speech} Keep the original composition for the entire shot, with subtle breathing and small eye movements. No other person enters, no new objects enter, no cuts, no camera movement, no subtitles, no music. Soft tent ambience only apart from the specified dialogue.'
    body['content'][0]['text']=text
    save(OUT/'requests'/f'{cid}.local.json',body)
    prepared=OUT/'requests'/f'{cid}.json'
    if prepared.exists() and not (OUT/'tasks'/f'{cid}.json').exists():prepared.unlink()
    changed.append(cid)
save(OUT/'review/api-minimization.json',dict(reason='首帧版仍被负向文书/肩背术语诱发额外纸页与越肩人影；改短正向实际镜头，原台词仍逐字保留，详细设计留MD',clips=changed))
print(changed)
