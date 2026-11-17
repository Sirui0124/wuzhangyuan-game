from pathlib import Path
import json,hashlib,sys
R=Path(__file__).resolve().parent
spec=json.loads(Path(sys.argv[1]).read_text('utf-8'));id=spec['id'];d=R/id;d.mkdir(exist_ok=True)
assert not (d/'state.json').exists(),'Already started; do not mutate active request'
prompt=spec.pop('prompt');(d/'prompt.txt').write_text(prompt+'\n','utf-8');(d/'references.json').write_text(json.dumps(spec['reference_paths'],ensure_ascii=False,indent=2),'utf-8')
spec.update(version='v2.3',edit_duration=spec['duration'],depends_on=spec.get('depends_on'),prompt_sha256=hashlib.sha256((d/'prompt.txt').read_bytes()).hexdigest())
p=R/'production-plan.json';v=json.loads(p.read_text('utf-8'));assert id not in [u['id'] for u in v['units']];v['units'].append(spec);p.write_text(json.dumps(v,ensure_ascii=False,indent=2),'utf-8')

