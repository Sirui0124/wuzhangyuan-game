"""Assemble immutable review candidates; never mark usability or publish automatically."""
from pathlib import Path
import json,sys,hashlib,subprocess,cv2
from PIL import Image,ImageDraw
import repair_picture as r
O=Path(__file__).parent
def choose(c):
    for folder in ['picture-review-paper-detail','picture-review-npc-tail','picture-review-presentable','picture-review-corrected','picture-review-final']:
        p=O/'edited'/folder/(c['id']+'.json')
        if p.exists():
            d=r.read(p);assert r.digest(d['file'])==d['sha256'];return d
    raise RuntimeError(c['id'])
def main():
    children={c['id']:choose(c) for c in r.PLAN['clips']};selected=sys.argv[1:] or [p['id'] for p in r.PLAN['parents']]
    current=r.read(O/'review/picture-repair-candidates.json');byid={c['id']:c for c in current['clips']}
    for parent in r.PLAN['parents']:
        if parent['id'] not in selected:continue
        old=r.PLAN['parents'];r.PLAN['parents']=[parent]
        r.assemble(list(children.values()));row=r.read(O/'review/picture-repair-candidates.json')['clips'][0];r.PLAN['parents']=old;byid[parent['id']]=row
        r.save(O/'review/picture-repair-candidates.json',dict(version='picture-review-final',userApproved=False,status='pending-visual-review',clips=[byid[p['id']] for p in old],subclips=list(children.values())))
        # Decode-derived dimensions/rate, and all half-second frames with exact file identity.
        cap=cv2.VideoCapture(row['file']);fps=cap.get(cv2.CAP_PROP_FPS);count=cap.get(cv2.CAP_PROP_FRAME_COUNT)
        assert (int(cap.get(3)),int(cap.get(4)),fps)==(1280,720,24)
        folder=O/'review/latest-picture-sequences'/parent['id'];folder.mkdir(parents=True,exist_ok=True)
        frames=[]
        for n in range(0,int(count),12):
            cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,im=cap.read();assert ok
            tile=Image.fromarray(cv2.cvtColor(cv2.resize(im,(448,252)),cv2.COLOR_BGR2RGB));ImageDraw.Draw(tile).text((8,8),f'{parent["id"]} {n/fps:.2f}s',fill='yellow');frames.append(tile)
        cap.release()
        for offset in range(0,len(frames),24):
            sheet=Image.new('RGB',(448*4,252*6),(10,10,10))
            for i,frame in enumerate(frames[offset:offset+24]):sheet.paste(frame,((i%4)*448,(i//4)*252))
            sheet.save(folder/f'sequence-{offset//24+1:02}.jpg',quality=88)
        r.save(folder/'identity.json',dict(file=row['file'],sha256=row['sha256'],fps=fps,frameCount=count,method='all 0.5-second samples; no semantic pass implied'))
        print('READY',parent['id'],row['file'],row['sha256'],flush=True)
    live=[dict(id='NEW-'+c['id'],file=Path(c['file']).relative_to(O).as_posix(),sha256=c['sha256']) for c in byid.values()]
    r.save(O/'review/picture-live-index.json',live)
if __name__=='__main__':main()
