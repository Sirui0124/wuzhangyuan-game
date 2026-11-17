from pathlib import Path
import json,hashlib
OUT=Path(__file__).parent;p=OUT/'delivery.json';d=json.loads(p.read_text(encoding='utf-8-sig'))
for c in d['clips']:
    actual=hashlib.sha256(Path(c['file']).read_bytes()).hexdigest()
    assert actual==c['technical']['sha256'],c['id']
    c['assemblySha256']=hashlib.sha256(Path(c['assemblySource']).read_bytes()).hexdigest()
    c['sha256']=actual
p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
r=OUT/'review/final-validation.json';v=json.loads(r.read_text(encoding='utf-8-sig'));v['allDeliveryHashesMatchActualFiles']=True;v['filenameSuffixMeaning']='拼接源SHA前8位；实际交付文件SHA在clips[].sha256及technical.sha256，两处一致。';r.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
print('12 root sha256 and technical.sha256 match actual delivered files; no media changed')
