from pathlib import Path
import json
OUT=Path(__file__).parent;ROOT=OUT.parents[2]
def read(p):return json.loads(p.read_text(encoding='utf-8'))
plan=read(OUT/'production.json');rows={r['id']:r for r in read(ROOT/'content/chapters/wuzhang/chapter-one.script.json')['rows']}
for oldid in ['G09A','G09B','G15A','G15B','G20','G06B1','G06B2']:
    if any(c['id']==oldid+'R2' for c in plan['clips']):continue
    c=next(c for c in plan['clips'] if c['id']==oldid);body=read(OUT/'requests'/(oldid+'.local.json'))
    intro='Create a realistic Chinese historical live-action movie scene. 16:9 full frame, restrained low saturation, natural skin, soft firelight, detailed dark canvas and worn iron armour. The camera is the visitor\'s eyes: no visitor body, shoulder, face, reflection or permanent spear in foreground. Not an over-the-shoulder shot. Audio: ONLY speak the Chinese sentences inside quotation marks below. Never read any directions, names, identifiers, labels or English text. No subtitles, no text, no music. Other sounds: wind, canvas, clothes and steps synchronized to the scene. Keep the same face, costume, camp location and screen direction between shots. All unquoted text is silent direction.\n'
    for i,k in enumerate(c['refs'],1):intro+=f'Picture {i}: {k}, {next(a["use"] for a in plan["assets"] if a["id"]==k)}.\n'
    parts=[]
    for s in c['shots']:
        t=f'{s["start"]}-{s["end"]} seconds. {s["action"]} {s["camera"]}\n'
        for rid in s['rows']:
            row=rows[rid];who=row['speaker'];line=row['text']
            if who=='演出':continue
            if who.startswith('我'):
                t+='While the on-screen listener keeps his lips CLOSED, the unseen visitor says in a young adult male voice: "'+line+'". The voice comes from behind the camera.\n'
            elif who=='旁白':t+='OFF-SCREEN narrator says only: "'+line+'". No visible character speaks.\n'
            else:t+=f'Only the on-screen {who} speaks to the unseen visitor: "'+line+'". Other people stay silent with closed lips.\n'
        if oldid=='G06B1':
            line=rows['A-42']['text'].replace('营门未破。','')
            t+='The guard stays entirely SILENT and listens with CLOSED lips. OFF-CAMERA visitor says: "'+line+'" Then he says: "'+rows['A-43']['text']+'". No other speech.\n'
        parts.append(t)
    body['content'][0]['text']=intro+'\n'.join(parts)+'\nFinish every quoted sentence in order. End with 0.4 seconds of quiet. Do not add any spoken words.'
    id=oldid+'R2';(OUT/'requests'/(id+'.local.json')).write_text(json.dumps(body,ensure_ascii=False,indent=2),encoding='utf-8')
    plan['clips'].append({**c,'id':id,'supersedes':oldid,'requestVersion':'R2 concise performance-only API text; human document retains row provenance'})
(OUT/'production.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
print('Prepared 7 concise dialogue retakes; each request keeps only spoken text in quotes.')
