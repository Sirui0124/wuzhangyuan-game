"""Strict image-data-URI transport for existing video_api module instances.

No calls or submissions on import/install. Does not change shared source files,
credentials, task guards, polling, prompts, or image bytes. Coordinated release
requires the sole V04-01-R2 recovery probe to succeed first.
Official schema: https://platform.minimax.io/docs/api-reference/video-generation-v2-create
"""
from pathlib import Path
import base64,copy,hashlib,io,json
from PIL import Image

MIMES={'image/png':'PNG','image/jpeg':'JPEG','image/webp':'WEBP'}
MAX_IMAGE=30*1024*1024
MAX_BODY=64*1024*1024

def inspect_bytes(data,mime=None):
    if not 0<len(data)<=MAX_IMAGE:raise ValueError('Image size must be 1 byte to 30 MiB')
    with Image.open(io.BytesIO(data)) as im:
        actual=next((m for m,f in MIMES.items() if im.format==f),None)
        w,h=im.size
        if actual is None or mime is not None and actual!=mime:raise ValueError('Image type mismatch')
        if not 256<=w<=5760 or not 256<=h<=5760 or not 0.4<=w/h<=2.5:raise ValueError('Image dimensions outside MiniMax limits')
        im.verify()
    return {'content_type':actual,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'width':w,'height':h,'transport':'data-uri'}

def inspect_uri(url):
    if not isinstance(url,str):raise ValueError('Image URL must be a string')
    prefix,sep,encoded=url.partition(',')
    mime=prefix.removeprefix('data:').removesuffix(';base64')
    if not sep or prefix!='data:'+mime+';base64' or mime not in MIMES:raise ValueError('Only PNG/JPEG/WEBP base64 data URIs supported')
    if len(encoded)>4*((MAX_IMAGE+2)//3):raise ValueError('Encoded image too large')
    data=base64.b64decode(encoded,validate=True)
    return inspect_bytes(data,mime)

def install(api):
    if getattr(api,'_ch2_inline_transport',False):return
    original_validate=api.validate_payload
    original_verify=api.verify_image_url
    original_prepare=api.prepare_request

    def validate(body):
        sanitized=copy.deepcopy(body)
        for item in sanitized.get('content',[]):
            if item.get('type')=='image_url':
                url=item.get('image_url',{}).get('url')
                if isinstance(url,str) and url.startswith('data:'):
                    inspect_uri(url)
                    item['image_url']['url']='https://validation.example/reference.png'
        original_validate(sanitized)
        if len(json.dumps(body,ensure_ascii=False,separators=(',',':')).encode('utf8'))>MAX_BODY:
            raise ValueError('Request exceeds 64 MiB')

    def verify(url,expected_sha=None):
        if isinstance(url,str) and url.startswith('data:'):
            info=inspect_uri(url)
            if expected_sha and info['sha256']!=expected_sha:raise ValueError('Embedded image hash mismatch')
            return info
        return original_verify(url,expected_sha)

    def embed(path):
        p=Path(path).resolve(strict=True);data=p.read_bytes();info=inspect_bytes(data)
        uri='data:'+info['content_type']+';base64,'+base64.b64encode(data).decode('ascii')
        return {**info,'provider':'inline-original-bytes','path':str(p),'url':uri,'verification':info}

    def prepare(template,base_dir,uploader=None):
        if uploader is not None:raise ValueError('Inline transport cannot use a remote uploader')
        # Reuse the established role/model/duration checks and local-path mapping.
        # Unchanged remote inputs remain HTTPS-validated; callers should rebuild
        # failed requests from original local_path templates to avoid the outage.
        return original_prepare(template,base_dir,uploader=embed)

    api.validate_payload=validate
    api.verify_image_url=verify
    api.prepare_request=prepare
    api._ch2_inline_transport=True
