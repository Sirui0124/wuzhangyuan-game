from pathlib import Path
import json,hashlib,uuid,av
from PIL import Image,ImageDraw,ImageChops,ImageStat
OUT=Path(__file__).resolve().parent;BASE=OUT.parents[1]
ROOT=OUT/'user-review-20261025';ROOT.mkdir(exist_ok=True)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):
    t=p.with_name(p.name+'.'+uuid.uuid4().hex+'.tmp');t.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');t.replace(p)
delivery=read(OUT/'delivery.json');snapshot=read(BASE/'reviews/user-20261025-1549/version-snapshot.json')
rows=[]
for f in delivery['films']:
    p=Path(f['path']);sha=hashlib.sha256(p.read_bytes()).hexdigest();s=next(x for x in snapshot['clips'] if x['id']==f['id'])
    assert sha==f['sha256']==s['sha256'] and str(p)==s['file']
    rows.append(dict(id=f['id'],name=f['name'],oldFile=str(p),oldSha256=sha,snapshotSha256=s['sha256'],snapshotMatches=True,userComment=s['note'],observedPictureApproved=s['observedPictureApproved'],problemClassification='global-new-standard-scan',reviewState='pending',treatment='retain-if-no-document-card-or-visible-mask-hit',oldRanges=[[0,f['duration']]],newFile=None,newSha256=None,evidence=[],unresolved=[],audioReview='只标记，未逐字听审，不新增TTS',userApproved=False))
save(OUT/'user-review-repair.json',dict(group='G6',status='new-standard-scan-in-progress',requestSource=str(BASE/'reviews/user-20261025-1549/返修要求.md'),commentsSource=str(BASE/'reviews/user-20261025-1549/comments.json'),versionSnapshot=str(BASE/'reviews/user-20261025-1549/version-snapshot.json'),policyPriority='user-20261025-1549 overrides prior production usability',clips=rows,oldFilesPreserved=True,newVideoRequests=0,newTTSRequests=0,userApproved=False))
for r in rows:
    p=Path(r['oldFile']);frames=[];nextt=0;lastSmall=None;cuts=[]
    with av.open(str(p)) as c:
        for f in c.decode(video=0):
            t=float(f.pts*f.time_base);im=f.to_image()
            small=im.resize((64,36)).convert('L')
            if lastSmall is not None:
                delta=ImageStat.Stat(ImageChops.difference(small,lastSmall)).mean[0]
                if delta>26:cuts.append(t)
            lastSmall=small
            if t+.001>=nextt:
                im.thumbnail((400,225));frames.append((t,im));nextt+=.5
    sheets=[]
    for page in range((len(frames)+23)//24):
        subset=frames[page*24:page*24+24];sheet=Image.new('RGB',(1600,((len(subset)+3)//4)*250),'#161616');d=ImageDraw.Draw(sheet)
        for i,(t,im) in enumerate(subset):
            x=i%4*400;y=i//4*250;sheet.paste(im,(x,y));d.text((x+5,y+228),r['id']+f' NEW-STANDARD {t:.3f}s',fill='white')
        dest=ROOT/f'{r["id"]}-scan-{page+1:02d}.jpg';sheet.save(dest);sheets.append(str(dest))
    save(ROOT/f'{r["id"]}-scan-evidence.json',dict(file=str(p),sha256=r['oldSha256'],sampling='2fps ordered full-video auxiliary frames; every frame decoded for cut-candidate detection; not continuous human frame-by-frame review',frameTimes=[x[0] for x in frames],sheets=sheets,cutCandidates=cuts,sha256After=hashlib.sha256(p.read_bytes()).hexdigest()))
save(ROOT/'scan-manifest.json',rows)
print(json.dumps(dict(clips=len(rows),allSnapshotShaMatch=True),ensure_ascii=False))
