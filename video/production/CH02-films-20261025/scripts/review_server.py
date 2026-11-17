from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import json,urllib.parse,mimetypes,re,collections,time
from review_store import ReviewStore
ROOT=Path(__file__).resolve().parents[1]
REVIEWS=ReviewStore(ROOT)
VALID_REVIEW_IDS={c['id'] for c in json.loads((ROOT/'sources/CHAPTER-TWO-VIDEO-SEGMENTS.json').read_text(encoding='utf-8-sig'))['clips']}
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def data():
 dispatch=load(ROOT/'dispatch.json');source=load(ROOT/'sources/CHAPTER-TWO-VIDEO-SEGMENTS.json');byid={c['id']:c for c in source['clips']};groups=[]
 # A registered file may still fail video-track coverage even when audio and
 # container duration look valid. Quarantine only the exact audited version.
 invalid={}
 try:
  for row in load(ROOT/'audit/video-track-coverage.json').get('clips',[]):
   if row.get('status')=='needs-investigation':invalid[row['file']]=row
 except (ValueError,OSError,KeyError):pass
 for g in dispatch['groups']:
  directory=ROOT/'groups'/g['group'];status=collections.Counter()
  for p in (directory/'tasks').glob('*.json'):
   try:
    t=load(p)
    if 'status' in t:status[t['status']]+=1
   except (ValueError,OSError):pass
  # Only show explicitly registered candidates, never an older edit or a file
  # which is still being written by a production worker.
  registered={}
  try:
   delivery=load(directory/'delivery.json')
   for key in ('clips','logicalClips','assembled','films'):
    for item in delivery.get(key,[]):
     if isinstance(item,dict) and item.get('id'):
      filename=item.get('file') or item.get('path')
      if filename:
       candidate=Path(filename)
       if not candidate.is_absolute():candidate=directory/candidate
       candidate=candidate.resolve()
       if candidate.is_relative_to(directory.resolve()) and candidate.is_file() and candidate.stat().st_size>10000:
        registered[item['id']]=candidate
  except (ValueError,OSError,TypeError):pass
  clips=[]
  for id in g['clips']:
   candidate=registered.get(id)
   repair=False
   if candidate and str(candidate) in invalid:
    st=candidate.stat()
    if invalid[str(candidate)].get('stamp')==[st.st_size,st.st_mtime_ns]:candidate=None;repair=True
   url=(urllib.parse.quote(candidate.relative_to(ROOT).as_posix())+'?v='+str(candidate.stat().st_mtime_ns)) if candidate else None
   c=byid[id];clips.append({'id':id,'name':c['name'],'file':url,'lines':[{'speaker':l['speaker'],'text':l['text']} for l in c['lines']],'note':'配音待统一；画面为制作候选，待审阅','entry':c['entry']})
   if repair:clips[-1]['note']='画面拼接修复中：当前版本的视频轨未覆盖完整时长，暂不提供播放。'
  groups.append({**g,'clips':clips,'status':dict(status)})
 return {'updated':time.strftime('%H:%M:%S'),'groups':groups,'ready':sum(bool(c['file']) for g in groups for c in g['clips']),'total':len(byid)}
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*a):pass
 def reply_json(self,code,value):
  b=json.dumps(value,ensure_ascii=False).encode();self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
 def do_POST(self):
  if self.path!='/api/reviews':self.send_error(404);return
  if self.headers.get('Origin') not in (None,'http://127.0.0.1:8894','http://localhost:8894'):self.send_error(403);return
  if not self.headers.get('Content-Type','').startswith('application/json'):self.send_error(415);return
  try:
   size=int(self.headers.get('Content-Length',0))
   if not 0<size<2000000:raise ValueError('invalid size')
   body=json.loads(self.rfile.read(size))
   if body['id'] not in VALID_REVIEW_IDS or not isinstance(body['note'],str) or not isinstance(body['approvals'],dict) or not isinstance(body['reviewedVersions'],dict):raise ValueError('invalid record')
   code,result=REVIEWS.update(body);self.reply_json(code,result)
  except (ValueError,KeyError,TypeError):self.send_error(400)
 def do_GET(self):
  route=urllib.parse.urlsplit(self.path).path
  if route=='/api/reviews':self.reply_json(200,REVIEWS.read());return
  if route=='/data.json':
   b=json.dumps(data(),ensure_ascii=False).encode();self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b);return
  if route=='/':self.path='/审片台.html'
  p=Path(self.translate_path(self.path)).resolve()
  if not p.is_relative_to(ROOT.resolve()):self.send_error(403);return
  if p.suffix=='.mp4' and p.is_file():
   size=p.stat().st_size;r=self.headers.get('Range');start=0;end=size-1
   if r:
    m=re.fullmatch(r'bytes=(\d+)-(\d*)',r)
    if not m:self.send_error(416);return
    start=int(m[1]);end=min(int(m[2]) if m[2] else size-1,size-1)
    if start>end:self.send_error(416);return
   self.send_response(206 if r else 200);self.send_header('Content-Type','video/mp4');self.send_header('Cache-Control','no-store');self.send_header('Accept-Ranges','bytes');self.send_header('Content-Length',str(end-start+1))
   if r:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
   self.end_headers()
   try:
    with p.open('rb') as f:
     f.seek(start);left=end-start+1
     while left:
      b=f.read(min(left,1024*1024))
      if not b:break
      self.wfile.write(b);left-=len(b)
   except (ConnectionAbortedError,ConnectionResetError,BrokenPipeError):pass
   return
  super().do_GET()
if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',8894),Handler).serve_forever()
