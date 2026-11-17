from pathlib import Path
import json
OUT=Path(__file__).parent
plan=json.loads((OUT/'plan.json').read_text(encoding='utf-8'))
html='''<meta charset="utf-8"><title>G2逐片动态审片</title><style>body{margin:0;background:#101516;color:#eee;font:18px sans-serif}header{padding:12px}video{width:100vw;height:85vh}select{font-size:18px;max-width:800px}</style><header><select id="pick" onchange="play(this.value)">'''
html+=''.join(f'<option value="{c["id"]}">{c["id"]} {c["name"]}</option>' for c in plan['clips'])
html+='''</select> <button onclick="v.play()">播放</button> <button onclick="v.pause()">暂停</button><button id="auto" onclick="startAuto()">连续检查已到片段</button><span id="t"></span></header><video id="v" controls muted></video><pre id="audit" style="white-space:pre-wrap;font-size:13px"></pre><script>
let automatic=false;const completed=new Set();let current='';
function play(id){current=id;pick.value=id;v.src="generated/"+id+"-raw.mp4";v.play()}
function log(s){audit.textContent+=s+'\\n'}
v.ontimeupdate=()=>t.textContent=v.currentTime.toFixed(2)+" / "+v.duration.toFixed(2);
v.onended=()=>{completed.add(current);log(JSON.stringify({id:current,event:'ended',duration:v.duration,time:new Date().toISOString()}));if(automatic)nextAuto()};
v.onerror=()=>{if(automatic)setTimeout(nextAuto,2000)};
async function startAuto(){automatic=true;await nextAuto()}
async function nextAuto(){
 if(!automatic)return;
 for(const o of pick.options){if(completed.has(o.value))continue;const r=await fetch('generated/'+o.value+'-technical.json',{cache:'no-store'});if(r.ok){play(o.value);return}}
 if(completed.size<pick.options.length)setTimeout(nextAuto,3000);else{log('全部已到片段完成自然速度播放；声音静音，不能作为听审。');automatic=false}
}
play(pick.value)</script>'''
(OUT/'动态审片.html').write_text(html,encoding='utf-8')
