from pathlib import Path
import json
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
a=read(OUT/'assignment.json');p=read(OUT/'plan.json')
original={l['node']:l['text'] for c in a['clips'] for l in c['lines']}
planned={l['node']:l['text'] for c in p['clips'] for l in c['sourceLines']}
assert original==planned,dict(missing=set(original)-set(planned),extra=set(planned)-set(original),changed=[n for n in original.keys()&planned.keys() if original[n]!=planned[n]])
assert len(p['clips'])==35 and len(p['parents'])==12
assert set(c['id'] for c in p['clips'])==set(i for c in p['parents'] for i in c['children'])
result=dict(sourceNodes=len(original),sourceTextExact=True,requests=len(p['clips']),logicalSegments=len(p['parents']),allChildrenMapped=True)
(OUT/'review/source-coverage.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
