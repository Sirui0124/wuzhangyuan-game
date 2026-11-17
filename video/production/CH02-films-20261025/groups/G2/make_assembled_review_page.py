from pathlib import Path
import json,html,sys
OUT=Path(__file__).parent
rows=[c for c in json.loads((OUT/'review/prepared-candidates.json').read_text(encoding='utf-8')) if c.get('file')]
finalV20='--final-v20' in sys.argv
if finalV20:rows=[c for c in json.loads((OUT/'delivery.json').read_text(encoding='utf-8'))['clips'] if c['id']=='V20']
options=''.join(f'<option value="{html.escape(Path(c["file"]).name)}" data-id="{c["id"]}">{c["id"]} {html.escape(c["name"])}</option>' for c in rows)
page='''<!doctype html><meta charset="utf-8"><title>G2 成片动态检查</title><style>body{background:#141a19;color:#eee;margin:0;font:17px sans-serif}header{padding:10px}video{width:100%;height:84vh}pre{font-size:12px;white-space:pre-wrap}</style><header><select id="pick" onchange="play(pick.selectedIndex)">'''+options+'''</select><button onclick="v.play()">播放</button><button id="auto" onclick="automatic=true;play(0)">顺序检查成片</button><span id="time"></span></header><video id="v" controls muted></video><pre id="audit"></pre><script>
let automatic=false,index=0;
function play(i){index=i;pick.selectedIndex=i;v.src='assembled/'+pick.options[i].value;v.play()}
v.ontimeupdate=()=>time.textContent=v.currentTime.toFixed(2)+' / '+v.duration.toFixed(2);
v.onended=()=>{audit.textContent+=JSON.stringify({id:pick.options[index].dataset.id,file:pick.options[index].value,event:'ended',duration:v.duration,time:new Date().toISOString()})+'\\n';if(automatic&&index+1<pick.options.length)play(index+1);else if(automatic)audit.textContent+='本页全部成片已完成自然速度静音播放。\\n'};
play(0)</script>'''
(OUT/('签认成片最终检查.html' if finalV20 else '成片动态检查.html')).write_text(page,encoding='utf-8')
print('Prepared assembled playback page:',len(rows))
