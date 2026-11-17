from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import json,re
OUT=Path(__file__).parent.resolve()
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(OUT),**kwargs)
    def log_message(self,*args):pass
    def do_POST(self):
        if self.path!='/audit':self.send_error(404);return
        length=int(self.headers.get('Content-Length','0'))
        if length>8192:self.send_error(413);return
        r=json.loads(self.rfile.read(length));r={k:r[k] for k in ['id','sha256','event','start','end','duration','time']}
        assert re.fullmatch('[0-9a-f]{64}',r['sha256'])
        with (OUT/'review/picture-recheck-playback.ndjson').open('a',encoding='utf-8') as f:f.write(json.dumps(r,ensure_ascii=False)+'\n')
        self.send_response(204);self.end_headers()
if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',8893),Handler).serve_forever()
