from pathlib import Path
import json,sys
sys.path.insert(0,str(Path(__file__).parent))
from importlib.machinery import SourceFileLoader
a=SourceFileLoader('voice_audit',str(Path(__file__).with_name('player-voice-audit-20261027.py'))).load_module()

audit=a.read(a.OUT/'audit.json');jobs={};occ=[]
for film in audit['results']:
    for hit in film['presetMatches']:
        # B-03/B-04 and the existing Chapter 2 narrator were deliberately cast in
        # the old player preset, and belong to this voice-consistency repair too.
        h={**hit,'filmId':film['id'],'filmSrc':film['src'],'filmSha256':film['sha256']}
        h['cueIndices']=[i for i,c in enumerate(film['cues']) if a.norm(c['text']) in a.norm(hit['text']) or a.norm(hit['text']) in a.norm(c['text'])]
        h['kind']='thought-or-heavy' if '心声' in hit['speaker'] or hit['speaker']=='旁白' or hit['node'] in ['B-03','B-04'] else 'regular-dialogue'
        prior=[c['end'] for i,c in enumerate(film['cues']) if i not in h['cueIndices'] and c['end']<=hit['speechStart']+.05]
        after=[c['start'] for i,c in enumerate(film['cues']) if i not in h['cueIndices'] and c['start']>=hit['speechEnd']-.05]
        h['window']=[max(0,hit['speechStart']-.22,max(prior,default=-.04)+.04),min(film['duration']-.015,min(after,default=film['duration'])-.04,hit['speechEnd']+.7)]
        h['targetSeconds']=round(h['window'][1]-h['window'][0]-.12,2)
        assert h['targetSeconds']>.35,h
        occ.append(h)
        j=jobs.setdefault(h['id'],dict(id=h['id'],node=h['node'],text=h['text'],kind=h['kind'],chapter=h['chapter'],oldVoice=h['file'],oldVoiceSha256=h['sha256'],targets=[]))
        j['targets'].append(dict(filmId=h['filmId'],targetSeconds=h['targetSeconds']))
for j in jobs.values():
    j['targetSeconds']=min(r['targetSeconds'] for r in j['targets'])
    j['referenceFiles']=([r['file'] for r in a.read(a.OUT/'approved-references.json')['samples'] if r['id'].startswith(('03','04'))] if j['kind']=='regular-dialogue' else [r['file'] for r in a.read(a.OUT/'approved-references.json')['samples'] if r['id'].startswith(('01','02'))])
    j['context']='对眼前的人自然说话，语气随问句、请求或解释变化，克制而清楚，有胸腔厚度。' if j['kind']=='regular-dialogue' else '这是同一个人的内心独白或沉重叙述，声音稍近，低沉、克制，有思考停顿，不哭喊。'
    if j['node'].startswith('CH2-LY02') and j['kind']=='regular-dialogue':j['context']+='正在伤帐里和救过自己的人交谈，关切但不卖弄，不端着讲道理。'
    if j['node'].startswith('CH2-LY04'):j['context']+='正在核查粮食交接，认真询问或说出下一步想法，不像播音员读报告。'
a.save(a.OUT/'plan.json',dict(jobs=list(jobs.values()),occurrences=occ,films=[{k:v for k,v in f.items() if k not in ['presetMatches','unmatchedTextCandidates']} for f in audit['results'] if f['presetMatches']],newGenerationUserApproved=False,authorizedBy='2026-10-27 用户确认四段参考及场景用途，并授权review和替换错误玩家音频'))
print(json.dumps(dict(uniqueLines=len(jobs),occurrences=len(occ),films=len(set(h['filmId'] for h in occ)),chapters={str(ch):sum(j['chapter']==ch for j in jobs.values()) for ch in [1,2]})))
