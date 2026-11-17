"""Bind received-film audio locators and frame sheets to the original file hash."""
from pathlib import Path
import hashlib, json, subprocess
import numpy as np
from PIL import Image, ImageDraw
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'outputs/subtitle-review-20261026/received'
OUT.mkdir(parents=True, exist_ok=True)
FF = 'C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
receipt = json.loads((ROOT / 'outputs/video-prompts-20261026/1026新视频接收记录.json').read_text(encoding='utf-8-sig'))
model = WhisperModel('small', device='cpu', compute_type='int8', local_files_only=True, cpu_threads=6)
for row in receipt['received']:
    source = Path(row['videoPath'])
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    assert digest == row['sha256']
    result = OUT / (row['id'] + '.json')
    if result.exists() and json.loads(result.read_text(encoding='utf-8'))['sha256'] == digest:
        continue
    subprocess.run([FF, '-v', 'error', '-i', str(source), '-f', 'null', '-'], check=True)
    frames = OUT / (row['id'] + '-frames')
    frames.mkdir(exist_ok=True)
    subprocess.run([FF, '-v', 'error', '-i', str(source), '-vf', 'fps=1,scale=384:216', '-y', str(frames / '%03d.jpg')], check=True)
    files = sorted(frames.glob('*.jpg'))
    sheet = Image.new('RGB', (384 * 4, 240 * ((len(files) + 3) // 4)), '#202020')
    draw = ImageDraw.Draw(sheet)
    for i, path in enumerate(files):
        x, y = (i % 4) * 384, (i // 4) * 240
        sheet.paste(Image.open(path), (x, y))
        draw.text((x + 8, y + 219), f'{i + .5:.1f}s', fill='white')
    sheet.save(OUT / (row['id'] + '-contact.jpg'))
    raw = subprocess.run([FF, '-v', 'error', '-i', str(source), '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], check=True, capture_output=True).stdout
    segments, info = model.transcribe(np.frombuffer(raw, dtype=np.float32), language='zh', beam_size=5, word_timestamps=True, vad_filter=False, condition_on_previous_text=False)
    segments = [dict(start=s.start, end=s.end, text=s.text, noSpeechProbability=s.no_speech_prob, words=[dict(start=w.start, end=w.end, word=w.word) for w in s.words or []]) for s in segments]
    data = dict(id=row['id'], video=str(source), sha256=digest, fullDecodePassed=True, method='faster-whisper-small, no prompt, VAD off; frame sheet at 1fps', humanListeningReview=False, userApproved=False, segments=segments)
    result.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(dict(id=row['id'], segments=[(s['start'], s['end'], s['text'], round(s['noSpeechProbability'], 3)) for s in segments]), ensure_ascii=False), flush=True)
