from pathlib import Path
import json,urllib.request,base64,wave
OUT=Path(__file__).parent;ROOT=OUT.parents[2];dest=OUT/'voice';dest.mkdir(exist_ok=True)
rows={r['id']:r for r in json.loads((ROOT/'content/chapters/wuzhang/chapter-one.script.json').read_text(encoding='utf-8'))['rows']}
lines={k:rows[k]['text'] for k in ['D01','D03','D07','J03','A-45','B-03','B-04']}
lines.update({'M01':'就差这一下。','M02':'写了五年代码，天天都在改。','M03':'同学赶上了AI，我还想着再等等。','M04':'英伟达，比特币……也是这么错过的。','M05':'代码能回退，日子怎么就不行呢。','M06':'要是……能时光倒流就好了。','A42-variant':rows['A-42']['text'].replace('营门未破。','')+rows['A-43']['text']})
for id,text in lines.items():
    p=dest/(id+'.wav')
    if p.exists():continue
    req=urllib.request.Request('http://127.0.0.1:8787/api/game/tts',data=json.dumps({'role':'player','text':text}).encode(),headers={'Content-Type':'application/json'})
    pcm=bytearray();done=False
    with urllib.request.urlopen(req,timeout=60) as response:
        for line in response:
            if not line.strip():continue
            event=json.loads(line)
            if event.get('error'):raise RuntimeError(event['error'])
            if event.get('audio'):pcm.extend(base64.b64decode(event['audio']))
            if event.get('done'):done=True
    if not done or not pcm:raise RuntimeError('Incomplete voice stream')
    with wave.open(str(p),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(pcm)
    print(id,round(len(pcm)/48000,3),text,flush=True)
(dest/'manifest.json').write_text(json.dumps({'voice':'ICL_uranus_zh_male_xiaohouye_tob','provider':'existing local /api/game/tts, seed-tts-2.0','lines':lines,'listeningReview':'待review'},ensure_ascii=False,indent=2),encoding='utf-8')
