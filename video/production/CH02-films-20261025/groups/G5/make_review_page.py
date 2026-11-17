from pathlib import Path
import json,html
OUT=Path(__file__).parent
plan=json.loads((OUT/'plan.json').read_text(encoding='utf-8'))
if (OUT/'repair-plan.json').exists():plan['clips']+=json.loads((OUT/'repair-plan.json').read_text(encoding='utf-8'))['clips']
rows=[]
for c in plan['clips']:
    path=OUT/'edited'/f'{c["id"]}-final.mp4'
    if not path.exists():path=OUT/'generated'/f'{c["id"]}-16x9.mp4'
    if path.exists():rows.append(dict(id=c['id'],src=path.relative_to(OUT).as_posix(),duration=c['duration'],action=c['action'],lines=c['sourceLines']))
c1=OUT/'edited/sources/V35-01-C1-return-handoff.mp4'
if c1.exists():rows.append(dict(id='V35-01-C1',src=c1.relative_to(OUT).as_posix(),duration=6,action='剪辑修复候选：信使从布囊取卷并递回我手，来源V33指定区间倒放画面；声音另列待统一。',lines=next(c for c in plan['clips'] if c['id']=='V35-01')['sourceLines']))
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>G5 共同补救与归途 · 审片</title><style>
body{margin:0;background:#151a1b;color:#e1d9c9;font:16px/1.6 sans-serif}main{max-width:1200px;margin:auto;padding:20px}nav{display:flex;gap:6px;flex-wrap:wrap}button{background:#293236;color:#e1d9c9;border:1px solid #536064;padding:6px 10px;cursor:pointer}button[aria-current=true]{background:#66523c}video{display:block;width:100%;max-height:70vh;background:#000;margin:14px 0}p{margin:8px 0}details{margin:12px 0}#clock{font-variant-numeric:tabular-nums}</style><main><nav id="nav"></nav><video id="video" controls playsinline preload="metadata"></video><button id="play">从头播放</button> <button id="queue">从当前连续播放</button> <span id="clock"></span><p id="title"></p><p id="played"></p><details><summary>对应逐句源</summary><div id="source"></div></details><p id="note">制作候选，待review。未完成逐字听审。</p></main><script>
const rows=ROWS;let active,queued=false;const played=[];const v=document.querySelector('video');for(const c of rows){const b=document.createElement('button');b.textContent=c.id;b.onclick=()=>{queued=false;load(c)};document.querySelector('nav').append(b)}function load(c){active=c;v.src=c.src;document.querySelector('#title').textContent=c.id+'｜'+c.action;document.querySelector('#source').replaceChildren(...c.lines.map(x=>{let p=document.createElement('p');p.textContent=x.node+'｜'+x.speaker+'：'+x.text;return p}));document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-current',b.textContent===c.id))}document.querySelector('#play').onclick=()=>{v.currentTime=0;v.play()};document.querySelector('#queue').onclick=()=>{queued=true;v.currentTime=0;v.play()};v.ontimeupdate=()=>document.querySelector('#clock').textContent=v.currentTime.toFixed(2)+' / '+v.duration.toFixed(2)+' s';v.onended=()=>{const logs=JSON.parse(localStorage.getItem('g5-playback')||'[]');logs.push({id:active.id,src:active.src,ended:new Date().toISOString(),duration:v.duration});localStorage.setItem('g5-playback',JSON.stringify(logs));played.push(active.id);document.querySelector('#played').textContent='本轮已从头播放至尾：'+played.join('、');const next=rows[rows.indexOf(active)+1];if(queued&&next){load(next);v.play()}};if(rows.length)load(rows[0]);</script></html>'''.replace('ROWS',json.dumps(rows,ensure_ascii=False))
(OUT/'审片.html').write_text(page,encoding='utf-8')
print(f'{len(rows)} clips in review page')
