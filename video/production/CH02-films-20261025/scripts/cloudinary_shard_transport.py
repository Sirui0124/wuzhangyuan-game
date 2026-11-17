"""Same-byte HTTPS CDN host promotion. No generation or account mutation.

Call after existing prepare_request and before persisting/submitting a NEW request.
Never rewrite requests tied to an accepted or uncertain task. Verified via
V41L-02-R2, task_jx9s9jO6GX0ZEYnz3VhUAqf3xzPG2Uhu (succeeded).
"""
import copy
from urllib.parse import urlsplit,urlunsplit
_verified={}

def promote(api,body,references):
    result=copy.deepcopy(body);records=copy.deepcopy(references)
    images=[x for x in result['content'] if x.get('type')=='image_url']
    if len(records)!=len(images):raise ValueError('One source reference record per image is required')
    for item,record in zip(images,records):
        old=item['image_url']['url'];parts=urlsplit(old)
        if parts.scheme!='https':raise ValueError('Only verified HTTPS input is allowed; inline data transport failed')
        if parts.hostname not in {'res.cloudinary.com','res-1.cloudinary.com'}:
            raise ValueError('Unexpected source host; no automatic host substitution')
        if parts.username or parts.password or parts.port:raise ValueError('Unexpected URL authority')
        expected=record.get('sha256') or record.get('verification',{}).get('sha256')
        if not expected:raise ValueError('Original source image SHA256 required')
        target=urlunsplit(('https','res-1.cloudinary.com',parts.path,parts.query,parts.fragment))
        key=(target,expected)
        if key not in _verified:_verified[key]=api.verify_image_url(target,expected)
        item['image_url']['url']=target
        record.update(originalDeliveryUrl=record.get('originalDeliveryUrl',old),url=target,verification=_verified[key],transport='same-byte-cloudinary-res-1')
    api.validate_payload(result)
    return result,records
