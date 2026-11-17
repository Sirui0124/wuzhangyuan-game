"""Replace the obsolete tent ending with the received original, preserving its audio."""
from pathlib import Path
import hashlib, json, subprocess
import av

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'GameStarter/web-demo/public'
OUT = ROOT / 'outputs/subtitle-review-20261026'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
write = lambda p, data: p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source = ROOT / 'video/raw/1026视频更新/01_偷听被处斩_帐后有刀_20261026200944.mp4'
assert sha(source) == '1ff1bd33b1fd6bb9c3c121b75efab366f47bc65b50b4a2d9548bd3cada923a43'
destination = ROOT / 'video/current/C1END-TENT-20261026-1ff1bd33-h264.mp4'
ff = 'C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
if not destination.exists():
    subprocess.run([ff, '-v', 'error', '-i', str(source), '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', str(destination)], check=True)
subprocess.run([ff, '-v', 'error', '-i', str(destination), '-f', 'null', '-'], check=True)
# The compatibility encode must not change the soundtrack or frame count.
audio_hashes = []
metadata = []
for path in (source, destination):
    decoded = subprocess.run([ff, '-v', 'error', '-i', str(path), '-vn', '-f', 's16le', 'pipe:1'], check=True, capture_output=True).stdout
    audio_hashes.append(hashlib.sha256(decoded).hexdigest())
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        metadata.append(dict(duration=float(stream.duration * stream.time_base), containerDuration=container.duration / 1_000_000, width=stream.width, height=stream.height, fps=str(stream.average_rate), frames=stream.frames, videoCodec=stream.codec_context.name))
assert audio_hashes[0] == audio_hashes[1]
assert metadata[0]['frames'] == metadata[1]['frames']
config_path = PUBLIC / 'cinematics.json'
media_path = PUBLIC / 'video/media-manifest.json'
config, media = read(config_path), read(media_path)
clip = next(c for c in config['chapterEndings'] if c['id'] == 'C1END-TENT')
old = dict(clip)
new_url = '/video/current/' + destination.name
subtitle_url = '/video/subtitles/' + destination.stem + '.vtt'
subtitle = PUBLIC / subtitle_url.lstrip('/')
subtitle.write_text('WEBVTT\n\nNOTE\nNo dialogue in the production brief; received audio locator detected no speech.\nSource SHA256: ' + sha(source) + '\nVideo SHA256: ' + sha(destination) + '\nHuman listening and user review remain pending.\n', encoding='utf-8')
entry = dict(file='current/' + destination.name, url=new_url, source='../../video/current/' + destination.name, **metadata[1], bytes=destination.stat().st_size, sha256=sha(destination), status='integrated-awaiting-human-review', fullDecodePassed=True, originalSource=str(source.relative_to(ROOT)).replace('\\', '/'), originalSha256=sha(source), audioUnchanged=True, humanListeningReview=False, userApproved=False)
if clip['src'] != new_url:
    media['clips'] = [m for m in media['clips'] if m['url'] != clip['src']]
    media['clips'].append(entry)
    media['version'] += 1
    clip.update(src=new_url, subtitles=subtitle_url)
    write(media_path, media)
    write(config_path, config)
    write(OUT / 'tent-replacement.json', dict(previous=old, current=dict(clip), sourceSha256=sha(source), gameSha256=sha(destination), conversion='HEVC to H.264 for browser playback; original audio copied; no cuts', decodedAudioSha256=audio_hashes[0], frameCount=metadata[1]['frames'], humanListeningReview=False, userApproved=False))
# Audio locator remains valid because decoded audio is byte-identical.
evidence = read(OUT / 'received/01.json')
evidence.update(id='C1END-TENT', video=new_url, sha256=sha(destination), sourceSha256=sha(source), decodedAudioSha256=audio_hashes[0])
write(OUT / 'asr/C1END-TENT.json', evidence)
print(json.dumps(dict(clip=clip, videoSha256=sha(destination), audioUnchanged=True, frames=metadata[1]['frames']), ensure_ascii=False))
