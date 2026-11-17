"""Read-only coverage review against SHA-bound ASR; recognition is not a listening approval."""
from pathlib import Path
import json,re,difflib,hashlib
from pypinyin import lazy_pinyin

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'outputs/subtitle-review-20261026'
OUT.mkdir(parents=True,exist_ok=True)
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
clean=lambda s:''.join(re.findall('[\u4e00-\u9fffA-Za-z0-9]',s))
def stamp(s):
    a=s.split(':');return float(a[0])*3600+float(a[1])*60+float(a[2])
def cues(p):
    result=[]
    for b in p.read_text(encoding='utf-8-sig').strip().split('\n\n'):
        lines=b.splitlines()
        for i,line in enumerate(lines):
            if '-->' in line:
                a,z=line.split(' --> ');result.append(dict(start=stamp(a),end=stamp(z.split()[0]),text=''.join(lines[i+1:])))
    return result
results=[]
for e in read(ROOT/'video/subtitles/catalog.json')['entries']:
    film=ROOT/'video/current'/Path(e['video']).name
    sub=ROOT/'GameStarter/web-demo/public'/e['subtitles'].lstrip('/')
    cs=cues(sub)
    evidence=ROOT/'outputs/video-integration-20261025/subtitle-audit'/(film.stem+'-asr.json')
    fresh=OUT/'asr'/(e['id']+'.json')
    if fresh.exists() and read(fresh).get('sha256')==e['videoSha256']:evidence=fresh
    data=read(evidence) if evidence.exists() else {}
    current=hashlib.sha256(film.read_bytes()).hexdigest()
    matched=data.get('sha256')==current
    segments=data.get('segments',[]) if matched else []
    checked=[]
    for c in cs:
        nearby=''.join(s['text'] for s in segments if s['end']>c['start']-.2 and s['start']<c['end']+.2)
        a=lazy_pinyin(clean(c['text']));b=lazy_pinyin(clean(nearby))
        matches=sum(x.size for x in difflib.SequenceMatcher(None,a,b,autojunk=False).get_matching_blocks())
        checked.append({**c,'nearbyAsr':nearby,'phoneticCoverage':round(matches/max(1,len(a)),3)})
    uncovered=[]
    for s in segments:
        words=s.get('words') or [dict(word=s['text'],start=s['start'],end=s['end'])]
        missing=[w for w in words if not any(c['start']-.25<=(w['start']+w['end'])/2<=c['end']+.25 for c in cs)]
        if len(clean(''.join(w.get('word',w.get('text','')) for w in missing)))>=3:uncovered.extend(missing)
    results.append(dict(id=e['id'],video=e['video'],sha256=current,manifestMatches=current==e['videoSha256'],duration=e['duration'],subtitles=e['subtitles'],asrEvidence=str(evidence.relative_to(ROOT)) if matched else None,cueCount=len(cs),cues=checked,uncoveredWords=uncovered,humanListeningReview=False))
(OUT/'audio-comparison.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print('Total',len(results),'empty',sum(not x['cueCount'] for x in results),'without matching ASR',sum(not x['asrEvidence'] for x in results))
for x in results:
    weak=[c for c in x['cues'] if c['phoneticCoverage']<.68]
    if weak or x['uncoveredWords'] or not x['cueCount']:
        print(json.dumps(dict(id=x['id'],cues=x['cueCount'],weak=weak,uncovered=''.join(w.get('word',w.get('text','')) for w in x['uncoveredWords'])),ensure_ascii=False))
