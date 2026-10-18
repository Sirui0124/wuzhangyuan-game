"""Preserve source songs; prepare lossless, level-matched periodic game loops."""
from pathlib import Path
import array
import hashlib
import json
import math
import shutil
import subprocess
import wave

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT.parents[1] / 'GameStarter/web-demo/public/audio/bgm'
RATE = 44100
CROSSFADE = 4.0
TRACKS = [
    ('home', '五声余韵', '用户5806 - 五声余韵.mp3'),
    ('round1', '七星灯未灭', '用户5806 - 七星灯未灭.mp3'),
    ('round2', '再查此夜', '用户5806 - 再查此夜.mp3'),
    ('weiyan', '帐前未决', '用户8163 - 帐前未决.mp3'),
]

def run(args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y', *args], check=True, capture_output=True)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def prepare(ident, title, filename):
    source = ROOT / 'originals' / filename
    # 100 ms energy windows remove only near-silent edges, including MP3 padding.
    mono = array.array('f', run(['-v', 'error', '-i', str(source), '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', 'pipe:1']).stdout)
    block = 800
    energy = [math.sqrt(sum(v*v for v in mono[i:i+block]) / len(mono[i:i+block])) for i in range(0, len(mono), block)]
    threshold = max(10 ** (-45 / 20), math.sqrt(sum(v*v for v in mono) / len(mono)) * 10 ** (-20 / 20))
    active = [i for i, e in enumerate(energy) if e > threshold]
    start = max(0, (active[0] - 1) * .1)
    end = min(len(mono) / 8000, (active[-1] + 2) * .1)
    # Sample-count arithmetic keeps the final overlap and wrap boundaries exact.
    start_sample, end_sample = round(start * RATE), round(end * RATE)
    size = end_sample - start_sample
    overlap = round(CROSSFADE * RATE)
    assert size > overlap * 3
    preserve_opening = ident == 'home'
    loop_start_frames = overlap if preserve_opening else 0
    loop_frames = size if preserve_opening else size - overlap
    scratch = ROOT / 'prepared' / (ident + '-crossfade.wav')
    output = ROOT / 'prepared' / (ident + '.wav')
    # Middle -> tail/head equal-power overlap -> wrap back to middle. The opening
    # overlap is embedded once per period; never fade the entire loop to silence.
    filters = (
        f'[0:a]aresample={RATE},atrim=start_sample={start_sample}:end_sample={end_sample},asetpts=PTS-STARTPTS,asplit=3[m][t][h];'
        f'[m]atrim=start_sample={0 if preserve_opening else overlap}:end_sample={size-overlap},asetpts=PTS-STARTPTS[middle];'
        f'[t]atrim=start_sample={size-overlap}:end_sample={size},asetpts=PTS-STARTPTS[tail];'
        f'[h]atrim=end_sample={overlap},asetpts=PTS-STARTPTS[head];'
        f'[tail][head]acrossfade=ns={overlap}:c1=qsin:c2=qsin[blend];'
        '[middle][blend]concat=n=2:v=0:a=1[out]'
    )
    run(['-v', 'error', '-i', str(source), '-filter_complex', filters, '-map', '[out]', '-ar', str(RATE), '-ac', '2', '-c:a', 'pcm_f32le', str(scratch)])
    stats = run(['-i', str(scratch), '-af', 'loudnorm=I=-20:TP=-3:LRA=20:print_format=json', '-f', 'null', '-']).stderr.decode()
    measured, _ = json.JSONDecoder().raw_decode(stats[stats.rfind('{'):])
    gain_db = -20 - float(measured['input_i'])
    gain_db = min(gain_db, -3 - float(measured['input_tp']))
    # A constant gain preserves both original dynamics and the periodic join.
    run(['-v', 'error', '-i', str(scratch), '-af', f'volume={gain_db}dB', '-ar', str(RATE), '-ac', '2', '-c:a', 'pcm_s16le', str(output)])
    with wave.open(str(output), 'rb') as w:
        assert w.getframerate() == RATE and w.getnchannels() == 2
        frames = w.getnframes()
        assert frames == loop_frames, (ident, frames, loop_frames)
        pcm_bytes = w.readframes(frames)
    pcm = array.array('h', pcm_bytes)
    # Compare the actual wrap step with normal neighboring waveform steps.
    seam_step = max(abs(pcm[loop_start_frames*2+c] - pcm[-2+c]) for c in range(2)) / 32768
    edge = pcm[-RATE*2:] + pcm[loop_start_frames*2:loop_start_frames*2+RATE*2]
    join = len(edge) // 2
    normal_step = max(abs(edge[i] - edge[i-2]) for i in range(2, len(edge)) if i not in (join, join+1)) / 32768
    peak = max(abs(v) for v in pcm) / 32768
    assert peak < 1 and seam_step < max(.01, normal_step * 1.2)
    rms = lambda data: math.sqrt(sum((v/32768)**2 for v in data) / len(data))
    seam_rms = [20*math.log10(max(1e-9, rms(edge[i:i+RATE]))) for i in range(0, len(edge), RATE)]
    assert min(seam_rms) > -55, (ident, seam_rms)
    preview = ROOT / 'previews' / (ident + '-循环接缝.wav')
    with wave.open(str(preview), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(pcm_bytes[-overlap*4:] + pcm_bytes[loop_start_frames*4:(loop_start_frames+overlap)*4])
    shutil.copy2(output, PUBLIC / output.name)
    scratch.unlink()
    return {
        'id': ident, 'title': title, 'source': 'originals/' + filename,
        'sourceSha256': sha(source), 'sourceDecodedSeconds': len(mono)/8000,
        'trimStartSeconds': start_sample/RATE, 'trimEndSeconds': end_sample/RATE,
        'loopCrossfadeSeconds': CROSSFADE, 'crossfadeCurve': 'equal-power quarter-sine',
        'loopFrames': frames, 'durationSeconds': frames/RATE,
        'loopStartSeconds': loop_start_frames/RATE, 'loopEndSeconds': frames/RATE,
        'preservedOpening': preserve_opening,
        'sampleRate': RATE, 'channels': 2, 'format': 'lossless PCM16 WAV',
        'inputIntegratedLufs': float(measured['input_i']), 'gainDb': gain_db,
        'estimatedOutputLufs': float(measured['input_i']) + gain_db,
        'peakDbfs': 20*math.log10(peak), 'wrapStep': seam_step,
        'maxNeighborStep': normal_step, 'seamHalfSecondRmsDbfs': seam_rms,
        'file': 'prepared/' + output.name, 'sha256': sha(output),
        'preview': 'previews/' + preview.name,
    }

for folder in [ROOT / 'prepared', ROOT / 'previews', PUBLIC]:
    folder.mkdir(parents=True, exist_ok=True)
assets = [prepare(*track) for track in TRACKS]
report = {'date': '2026-10-11', 'tracks': assets, 'gameFadeSeconds': 2.5,
          'subjectiveListening': False, 'checks': 'decode, sample-exact duration, no clipping, continuous wrap, no silent seam'}
(ROOT / 'processing.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
