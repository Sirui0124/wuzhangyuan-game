from pathlib import Path
import json,sys
OUT=Path(__file__).resolve().parent
p=json.loads((OUT/'plan.json').read_text(encoding='utf-8'))
edited=len(sys.argv)>1 and sys.argv[1]=='edited'
assembled=len(sys.argv)>1 and sys.argv[1]=='assembled'
clips=[]
if assembled:
    for s in json.loads((OUT/'delivery.json').read_text(encoding='utf-8'))['clips']:
        cs=[c for c in p['clips'] if c['slot']==s['id']]
        clips.append(dict(id=s['id'],slot=s['id'],src=Path(s['file']).relative_to(OUT).as_posix(),expected=' / '.join(l['text'] for c in cs for l in c['lines']),silent=s['id']=='L02'))
else:
    holds=json.loads((OUT/'review/selection.json').read_text(encoding='utf-8')) if (OUT/'review/selection.json').exists() else {}
    raw_clips=p['clips']
    if not edited and (OUT/'retake-plan.json').exists():raw_clips+=json.loads((OUT/'retake-plan.json').read_text(encoding='utf-8'))['clips']
    for c in raw_clips:
        if edited and holds.get(c['id'],{}).get('hold'):continue
        f=OUT/'edited'/f"{c['id']}.mp4" if edited else OUT/'generated'/f"{c['id']}-16x9.mp4"
        if f.exists():clips.append(dict(id=c['id'],slot=c['slot'],src=f.relative_to(OUT).as_posix(),expected=' / '.join(l['text'] for l in c['lines']),silent=c['silent']))
html='''<!doctype html><meta charset="utf-8"><title>G4 逐片审阅</title><style>body{background:#151719;color:#eee;font:16px sans-serif;margin:20px}video{width:min(880px,95vw);height:auto;background:#000}button,select{padding:10px;margin:5px}#note{max-width:1100px;line-height:1.8}</style><h2>G4 制作自查｜待用户 review</h2><select id="clips"></select><button id="play">从头播放</button><button id="next">下一条</button><button id="queue">逐条播放（审片）</button><span id="state"></span><br><video id="film" controls preload="metadata"></video><p id="note"></p><p id="history"></p><script>
const data=DATA;
const s=document.querySelector('#clips'),v=document.querySelector('#film');let idx=0;
let queue=false;const history=JSON.parse(localStorage.getItem(location.pathname+'-played')||'[]');document.querySelector('#history').textContent='已完整播放：'+history.join('、');
for(const c of data){const o=document.createElement('option');o.value=c.id;o.textContent=c.id;s.append(o)}
function choose(i){idx=i;const c=data[i];s.value=c.id;v.src=c.src;document.querySelector('#note').textContent=(c.silent?'无固定人声｜':'原对白｜')+c.expected;}
s.onchange=()=>choose(data.findIndex(c=>c.id===s.value));document.querySelector('#play').onclick=()=>{v.currentTime=0;v.play()};document.querySelector('#next').onclick=()=>{choose((idx+1)%data.length);v.play()};document.querySelector('#queue').onclick=()=>{queue=true;const n=data.findIndex(c=>!history.includes(c.id));if(n>=0){choose(n);v.play()}};
v.onended=()=>{const id=data[idx].id;if(!history.includes(id))history.push(id);localStorage.setItem(location.pathname+'-played',JSON.stringify(history));document.querySelector('#history').textContent='已完整播放：'+history.join('、');if(queue){const n=data.findIndex(c=>!history.includes(c.id));if(n>=0){choose(n);v.play()}else{queue=false}}};
v.ontimeupdate=()=>document.querySelector('#state').textContent=data[idx].id+' ｜ '+v.currentTime.toFixed(2)+' / '+v.duration.toFixed(2)+' 秒 ｜ '+(v.paused?'暂停':'播放中');if(data.length)choose(0);
</script>'''.replace('DATA',json.dumps(clips,ensure_ascii=False))
(OUT/('review-assembled.html' if assembled else 'review-edited.html' if edited else 'review.html')).write_text(html,encoding='utf-8')
print(len(clips))
