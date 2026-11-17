from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import re,os
ROOT=Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
    def send_head(self):
        self.byte_range=None
        p=Path(self.translate_path(self.path))
        m=re.fullmatch(r'bytes=(\d+)-(\d*)',self.headers.get('Range',''))
        if not (m and p.is_file()):return super().send_head()
        total=p.stat().st_size;start=int(m[1]);end=min(int(m[2]) if m[2] else total-1,total-1)
        if start>=total or end<start:self.send_error(416);return None
        f=p.open('rb');f.seek(start);self.byte_range=(start,end)
        self.send_response(206);self.send_header('Content-type',self.guess_type(str(p)))
        self.send_header('Accept-Ranges','bytes');self.send_header('Content-Range',f'bytes {start}-{end}/{total}')
        self.send_header('Content-Length',str(end-start+1));self.end_headers();return f
    def copyfile(self,source,outputfile):
        if self.byte_range is None:return super().copyfile(source,outputfile)
        left=self.byte_range[1]-self.byte_range[0]+1
        while left:
            b=source.read(min(left,1024*1024))
            if not b:break
            outputfile.write(b);left-=len(b)
    def log_message(self,*args):pass
ThreadingHTTPServer(('127.0.0.1',8866),Handler).serve_forever()
