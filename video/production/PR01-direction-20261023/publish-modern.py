from pathlib import Path
import sys,json,re,html,xml.etree.ElementTree as ET
sys.path.insert(0,'tools/video-history/202610')
from recheck_video_feedback_20261022 import call,COMMON
ROOT=Path.cwd();base=ROOT/'video/production/PR01-direction-20261023';out=base/'cloud'
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf8')
def table(name):
 p=out/name;call(['sheets','+cells-get',*COMMON,'--range','A1:K8','--include','value,formula,data_validation','--output-path',p.relative_to(ROOT).as_posix()]);return json.loads(p.read_text(encoding='utf8'))['ranges'][0]
b=table('tracker-before-retry.json');h=[c.get('value') for c in b['cells'][0]];writes=[]
for i,r in enumerate(b['cells'][1:],1):
 if r[0].get('value') not in ['PR01-A','PR01-B','PR01-C','PR01-D/E/F']:continue
 for label in ['prompt状态','当前状态']:writes.append({'range':f'{b["col_indices"][h.index(label)]}{b["row_indices"][i]}','cells':[[{'value':'待更新'}]]})
assert table('tracker-guard.json')==b
save(out/'status-writes.json',writes);call(['sheets','+cells-set',*COMMON,'--writes','@'+(out/'status-writes.json').relative_to(ROOT).as_posix()]);table('tracker-pending.json')

def xml_from_md(s,images=False):
 blocks=[]
 for part in s.strip().split('\n\n'):
  if not part.strip():continue
  if part.startswith('#'):
   n=len(part)-len(part.lstrip('#'));blocks.append(f'<h{min(n,3)}>'+html.escape(part.lstrip('#').strip())+f'</h{min(n,3)}>')
  else:
   blocks.append('<p>'+html.escape(part.replace('`','')).replace('\n','<br/>')+'</p>')
   if images and part.startswith('本地路径：'):
    p=Path(re.search(r'`([^`]+)`',part)[1]);blocks.append(f'<img path="@./{html.escape(p.relative_to(ROOT).as_posix(),quote=True)}" caption="图片{sum(x.startswith("<img") for x in blocks)+1}｜按上传顺序"/>')
 return ''.join(blocks)
for row in json.loads((base/'production.json').read_text(encoding='utf8')):
 key=row['id'].replace('PR01-','');
 if key!='DEF':continue
 token=row['cloud_prompt'];local=(ROOT/row['prompt']).read_text(encoding='utf8')
 initial=json.loads((out/(key+'-before.json')).read_text(encoding='utf8')) if key!='DEF' else json.loads((out/'DEF-before-envelope.json').read_text(encoding='utf-8-sig'))['data']
 fresh=call(['docs','+fetch','--doc',token,'--detail','full']);assert fresh['document']['content']==initial['document']['content'],key+' concurrent content change'
 s=fresh['document']['content'];elements=list(ET.fromstring('<root>'+s+'</root>'))
 if key=='DEF':first=next(x for x in elements if x.tag!='title');payload=xml_from_md(local,True)
 else:first=next(x for x in elements if ''.join(x.itertext())=='视频生成 Prompt');payload=xml_from_md('## 视频生成 Prompt\n\n'+local.split('## 视频生成 Prompt\n\n',1)[1])
 last=elements[-1];p=out/(key+'-patch.xml');p.write_text(payload,encoding='utf8')
 r=call(['docs','+update','--doc',token,'--command','overwrite','--revision-id',str(fresh['document']['revision_id']),'--content','@'+p.relative_to(ROOT).as_posix()]);assert r.get('result')=='success',r;save(out/(key+'-publish.json'),r)
 if key=='A':
  fresh=call(['docs','+fetch','--doc',token,'--detail','full']);els=list(ET.fromstring('<root>'+fresh['document']['content']+'</root>'));p=next(x for x in els if x.tag=='p' and ''.join(x.itertext()).startswith('尺寸：'))
  call(['docs','+update','--doc',token,'--command','block_replace','--block-id',p.attrib['id'],'--revision-id',str(fresh['document']['revision_id']),'--content','<p>尺寸：16:9<br/>模型：seedance2.5<br/>声音：有声音<br/>时长：9秒</p>'])
 fresh=call(['docs','+fetch','--doc',token,'--detail','full']);save(out/(key+'-after.json'),fresh)
 els=list(ET.fromstring('<root>'+fresh['document']['content']+'</root>'));title=els[0];oldtitle=''.join(title.itertext());newtitle=f'{row["id"]} {Path(row["prompt"]).stem.split("-",2)[2]}｜20261023镜头重构待review'
 call(['docs','+update','--doc',token,'--command','str_replace','--pattern',oldtitle,'--content',newtitle,'--revision-id',str(fresh['document']['revision_id'])])
 final=call(['docs','+fetch','--doc',token,'--detail','full']);save(out/(key+'-final.json'),final)
 parsed=list(ET.fromstring('<root>'+final['document']['content']+'</root>'));cloudtext=''.join(''.join(x.itertext()) for x in parsed if x.tag not in ['title','img'])
 expected=re.sub(r'^#+\s*','',local,flags=re.M).replace('`','');norm=lambda x:re.sub(r'\s+','',x)
 assert norm(cloudtext)==norm(expected),key+' text mismatch'
 imgs=[x.attrib for x in parsed if x.tag=='img'];assert len(imgs)==len(row['reference_paths'])
 if key!='DEF':assert [x['src'] for x in imgs]==[x.attrib['src'] for x in elements if x.tag=='img']
 save(out/(key+'-verification.json'),dict(textEqual=True,seconds=row['seconds'],images=imgs,reference_paths=row['reference_paths'],revision=final['document']['revision_id']))
 print(key,'published and text/image order verified',flush=True)
