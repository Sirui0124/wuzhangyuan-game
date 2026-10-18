# -*- coding: utf-8 -*-
from pathlib import Path
import base64
import hashlib
import html
import json
import subprocess
import wave
import zipfile

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'audio-design-manifest.json').read_text())
prompt_cards = []
for n, track in enumerate(manifest['bgm']['tracks'], 1):
    prompt = (root / track['prompt']).read_text().strip()
    prompt_cards.append(f'''<article class="prompt"><small>BGM {n}</small>
    <h2>{html.escape(track['title'])}</h2><textarea readonly aria-label="完整prompt">{html.escape(prompt)}</textarea>
    <button class="copy" type="button">复制完整 Prompt</button><p class="status" role="status"></p></article>''')
sound_cards = []
for item in manifest['assets']:
    encoded = base64.b64encode((root / item['file']).read_bytes()).decode()
    src = 'data:audio/wav;base64,' + encoded
    sound_cards.append(f'''<article class="sound"><h3>{html.escape(item['description'])}</h3>
    <p>{item['id']} · {round(item['durationMs'])}ms</p>
    <audio controls preload="none" src="{src}" aria-label="{html.escape(item['description'])}试听"></audio>
    <a href="{src}" download="{item['id']}.wav">下载 WAV</a></article>''')
head = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>五丈原 · 声音设计与试听</title><style>
:root{color-scheme:light;--paper:#f4efe5;--ink:#26322f;--red:#853c30;--line:#d5cbbb}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.8 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}
main{max-width:1120px;margin:auto;padding:48px 28px 72px}header{border-top:4px solid var(--red);padding-top:24px;margin-bottom:30px}
small{font-size:12px;letter-spacing:2px;color:var(--red)}h1{font-family:"Songti SC",serif;font-size:36px;margin:8px 0}
h2{font-size:23px;font-family:"Songti SC",serif;margin:12px 0}p{margin:8px 0}a{color:var(--red)}
.note{padding:18px 22px;border-left:3px solid var(--red);background:#e9e2d5;margin:20px 0 28px}
.prompts{display:grid;grid-template-columns:1fr;gap:22px}.prompt,.sound{background:#fffcf5;border:1px solid var(--line);border-radius:8px;padding:24px}
textarea{width:100%;height:270px;resize:vertical;border:1px solid var(--line);background:#f9f5ec;padding:15px;font-family:inherit;font-size:15px;line-height:1.9;color:var(--ink)}
button{margin-top:12px;padding:10px 18px;border:0;border-radius:5px;background:var(--red);color:#fff;font:inherit;cursor:pointer}
button:focus-visible,a:focus-visible{outline:3px solid #756c3c;outline-offset:3px}.status{font-size:13px;min-height:20px;margin-bottom:0}
.section-label{margin:42px 0 18px;padding-top:22px;border-top:1px solid var(--line);font-size:25px;font-family:"Songti SC",serif}
.sounds{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.sound{padding:18px}h3{margin:0;font-size:16px}
.sound p{font-size:12px;color:#706b63}audio{width:100%;height:40px;margin:9px 0}.sound a{font-size:13px}
footer{font-size:13px;margin-top:30px;color:#69665f}.volume{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding-bottom:16px}
.volume input{width:180px}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:13px;color:#736254}@media(max-width:700px){main{padding:28px 16px}.sounds{grid-template-columns:1fr}.prompt{padding:18px}h1{font-size:29px}textarea{height:330px}table{font-size:14px}}
</style></head><body><main><header><small>五丈原 / 声音设计 V01 / 2026.10.11</small><h1>低声守住这一夜</h1>
<p>三段克制、可循环的游戏背景音乐，与轻扣、翻纸构成的触点反馈。</p></header>
<div class="note"><strong>交付状态：</strong>三首 BGM 尚未生成。下方为可复制的 HappyShrimp 纯音乐描述，以及十二个已处理的音效候选。
音效已检查解码、时长和电平，听感与游戏内混音仍待确认。</div>
<table><thead><tr><th>第一轮 · 初到军营</th><th>第二轮 · 重返灯前</th><th>魏延 · 帐前一言</th></tr></thead><tbody><tr>
<td>陌生、夜色、轻微不安<br>无鼓，稀疏古琴与低音箫</td><td>沉着、审慎、微弱希望<br>相同动机，稍温暖</td>
<td>严肃、有压力，能静心写字<br>交谈 → 举证 → 输入 → 等待连续播放</td></tr></tbody></table>
<p>在 <a href="https://www.happyshrimp.ai/" target="_blank" rel="noopener">HappyShrimp</a> 选择 <strong>Instrumental</strong>，分别复制以下描述。
64 BPM、约120秒/32小节是作曲目标；成片循环接缝仍需剪辑和试听。</p><div class="prompts">'''
middle = '''</div><h2 class="section-label">触点音效 · 点播试听</h2>
<p>音效较轻，建议先用适中设备音量。每次只播放一个候选；没有人声、打字逐字声或悬停音。</p>
<div class="volume"><label for="volume">试听音量</label><input id="volume" type="range" min="0" max="1" step="0.05" value="0.65">
<output id="volume-value" for="volume">65%</output></div><div class="sounds">'''
tail = '''</div><div class="note">同一次操作优先播放专用反馈，避免点击、翻纸、提示叠成一串。
第三首在玩家输入与等待时平滑降低约3dB；视频播放时BGM静音；结局淡出约2.5秒。输入多久，音乐都不加速。</div>
<footer>素材来源：<a href="https://kenney.nl/assets/interface-sounds">Kenney Interface Sounds</a>、
<a href="https://kenney.nl/assets/rpg-audio">Kenney RPG Audio</a>，CC0。获得证据的三音阶音体由项目合成，使用轻微的 Kenney 拨弦触感层。处理版保留来源与许可证。此页音频内嵌，可离线使用；没有调用音乐生成服务。</footer>
</main><script>
const audios=[...document.querySelectorAll('audio')];const volume=document.getElementById('volume');const readout=document.getElementById('volume-value');
const syncVolume=()=>{for(const a of audios)a.volume=Number(volume.value);readout.value=Math.round(Number(volume.value)*100)+'%'};
syncVolume();volume.addEventListener('input',syncVolume);
for(const a of audios)a.addEventListener('play',()=>{for(const b of audios)if(b!==a){b.pause();b.currentTime=0}});
for(const button of document.querySelectorAll('.copy'))button.addEventListener('click',async()=>{
 const area=button.parentElement.querySelector('textarea');const status=button.parentElement.querySelector('.status');
 try{if(!navigator.clipboard)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(area.value);status.textContent='已复制完整 Prompt。'}
 catch{area.focus();area.select();status.textContent='已选中完整文本，请按 ⌘C / Ctrl+C 复制。'}
});
</script></body></html>'''
page = head + ''.join(prompt_cards) + middle + ''.join(sound_cards) + tail
(root / '声音设计与试听.html').write_text(page)
checks = []
for item in manifest['assets']:
    path = root / item['file']
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True)
    with wave.open(str(path), 'rb') as w:
        data = w.readframes(w.getnframes())
        checks.append({'id': item['id'], 'decodes': True, 'durationMs': item['durationMs'], 'peakDbfs': item['wavPeakDbfs'],
                       'firstSampleZero': data[:2] == b'\x00\x00', 'lastSampleZero': data[-2:] == b'\x00\x00',
                       'sha256Matches': hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256']})
assert len(checks) == 12 and all(c['firstSampleZero'] and c['lastSampleZero'] and c['sha256Matches'] for c in checks)
assert page.count('<audio ') == 12 and page.count('<textarea ') == 3
report = {'status': 'passed', 'date': '2026-10-11', 'format': 'PCM WAV 48000Hz 16bit mono',
          'audioCount': len(checks), 'htmlInlineAudioCount': 12, 'promptCount': 3,
          'bgmGenerated': False, 'gameCodeModified': False, 'gameListeningTestPerformed': False,
          'subjectiveListeningReviewPerformed': False, 'assets': checks}
(root / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
zip_path = root / '五丈原_音乐Prompt与触点音效包_v01.zip'
files = [root / name for name in ['README.md', '声音设计与试听.html', 'audio-design-manifest.json', 'verification.json']]
files += sorted((root / 'prompts').glob('*.txt')) + sorted((root / 'sfx').glob('*.wav'))
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for path in files:
        z.write(path, str(path.relative_to(root)))
    for pack in ['kenney_interface-sounds', 'kenney_rpg-audio']:
        z.write(root / 'originals' / pack / 'License.txt', 'licenses/' + pack + '_License.txt')
print(json.dumps({'preview': str((root / '声音设计与试听.html').resolve()), 'zipBytes': zip_path.stat().st_size,
                  'promptChars': {t['id']: len((root / t['prompt']).read_text()) for t in manifest['bgm']['tracks']},
                  'verification': report['status']}, ensure_ascii=False))
