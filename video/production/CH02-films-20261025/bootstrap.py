from pathlib import Path
import json, shutil, subprocess, hashlib, concurrent.futures
ROOT=Path(__file__).resolve().parents[3]; OUT=Path(__file__).parent
for name in ['sources','references','groups','audit','scripts','deliveries']:(OUT/name).mkdir(exist_ok=True)
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
for name in ['CHAPTER-TWO-VIDEO-SEGMENTS.json']:
 shutil.copy2(ROOT/'docs/video'/name,OUT/'sources'/name)
shutil.copy2(ROOT/'docs/design/chapter-two-flow.review.json',OUT/'sources/chapter-two-flow.review.json')
def fetch(pair):
 name,token=pair
 p=subprocess.run(['lark-cli','docs','+fetch','--doc',token,'--as','user','--detail','full'],shell=True,capture_output=True,encoding='utf-8')
 data=json.loads(p.stdout);assert p.returncode==0 and data.get('ok'),name
 save(OUT/'sources'/f'{name}.json',data)
 return name,data['data']['document']['revision_id']
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 print(list(pool.map(fetch,[('review-live','N6zrdpuSboQEIdx2AxncXGvDnkc'),('dialogue-live','JwQ1dxg6OodzsxxzzlZcxbf8n7b'),('principles-live','MSdZd2H8IoWkXyxpkpNcgxRKn0b')])))
clips=json.loads((OUT/'sources/CHAPTER-TWO-VIDEO-SEGMENTS.json').read_text(encoding='utf-8'))['clips']
groups=[
 ('G1','伤帐初识与第一次交谈',lambda x:x in ['V01','V02','V03A','V03B','V04','V05','V06','V07','V08A','V08B','V09','V10','L01','V11T','V11D','V11R','V11A','V11N','V12']),
 ('G2','查粮取证与三种判断',lambda x:x in ['V13','V14','V15','V16A','V16B','V16C','V17','V18','V19A','V19B','V19C','V20']),
 ('G3','揭穿与访村夜谈',lambda x:x in ['V21','V22','V23','V24','V25']),
 ('G4','军情与第二次交谈',lambda x:x in ['V26','V27','V28A','V28B','V28C','V29','V30','L02','V31T','V31D','V31R','V31A','V31N','V32R']),
 ('G5','共同补救与归途',lambda x:x in ['V32A','V33','V34','V35','V36','V37','V42']),
 ('G6','救人交案与放行结局',lambda x:x in ['V38','V39','V40','V41E','V41L','V43'])]
assign=[]
for gid,title,pred in groups:
 cs=[c for c in clips if pred(c['id'])]; d=OUT/'groups'/gid;d.mkdir(exist_ok=True)
 save(d/'assignment.json',{'group':gid,'title':title,'clips':cs,'contract':'../../制作总控.md','referenceManifest':'../../references/manifest.json'})
 assign.append({'group':gid,'title':title,'clips':[c['id'] for c in cs]})
ids=[x for g in assign for x in g['clips']];assert len(ids)==len(set(ids))==len(clips)
save(OUT/'dispatch.json',{'status':'planning','groups':assign,'threads':[]})
print('frozen clips',len(ids),'groups',len(groups))
