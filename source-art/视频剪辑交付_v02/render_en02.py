#!/usr/bin/env python3
"""Reproduce only the new morning EN02; other delivered media remain unchanged."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
ORIGINAL = Path(os.environ.get('EN02_SOURCE_FILE', str(HERE / '原片/EN02_次日清晨魏延问罪_用户新版.mp4')))
SOURCE = HERE / '原片/EN02_次日清晨魏延问罪_用户新版.mp4'
OUTPUT = ROOT / 'GameStarter/web-demo/public/video'
NAME = 'wuzhang-blame-v02.mp4'
# 24 fps frame 189: final spoken syllable ends before this frame.
CUTS = [(0, 7.875), (10, 15.083333333333334)]

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(1048576), b''):
            h.update(b)
    return h.hexdigest()

def probe(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error',
        '-show_streams', '-show_format', '-of', 'json', str(path)]))

def main():
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    if not SOURCE.exists():
        shutil.copy2(ORIGINAL, SOURCE)
    source_hash = digest(SOURCE)
    if ORIGINAL.exists():
        assert digest(ORIGINAL) == source_hash
    manifest_path = OUTPUT / 'media-manifest.json'
    archive = HERE / '旧版剪辑清单.json'
    if not archive.exists():
        shutil.copy2(manifest_path, archive)
    old = json.loads(archive.read_text())
    unchanged = {c['file']: digest(OUTPUT / c['file']) for c in old['clips']}
    filters, labels, timeline = [], [], []
    cursor = 0
    for n, (start, end) in enumerate(CUTS):
        duration = end - start
        filters.append(f'[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS,'
                       f'fps=24,setsar=1,format=yuv420p[v{n}]')
        filters.append(f'[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,'
                       f'aresample=48000,apad=whole_dur={duration},atrim=duration={duration},'
                       f'afade=t=in:st=0:d=0.008,afade=t=out:st={duration-.008}:d=0.008[a{n}]')
        labels.append(f'[v{n}][a{n}]')
        timeline.append(dict(source='EN02', sourceStart=start, sourceEnd=end, speed=1,
                             outputStart=cursor, outputEnd=cursor + duration))
        cursor += duration
    filters.append(''.join(labels) + 'concat=n=2:v=1:a=1[v][a]')
    target = OUTPUT / NAME
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', '-i', str(SOURCE),
        '-filter_complex', ';'.join(filters), '-map', '[v]', '-map', '[a]',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-threads', '4',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
        '-movflags', '+faststart', '-metadata', 'title=EN02 次日清晨问罪与小卒被架走',
        str(target)], check=True)
    info = probe(target)
    video = next(s for s in info['streams'] if s['codec_type'] == 'video')
    clip = dict(file=NAME, url='/video/' + NAME, duration=cursor,
                containerDuration=float(info['format']['duration']), width=video['width'],
                height=video['height'], fps=video['avg_frame_rate'], videoCodec=video['codec_name'],
                bytes=target.stat().st_size, sha256=digest(target), timeline=timeline)
    manifest = json.loads(json.dumps(old))
    manifest['version'] = 2
    manifest['sources']['EN02'] = dict(path=str(SOURCE), originalPath=str(ORIGINAL),
        sha256=source_hash, videoDuration=float(next(s for s in probe(SOURCE)['streams']
                                                   if s['codec_type'] == 'video')['duration']))
    manifest['clips'] = [clip if c['file'] == 'wuzhang-blame-v01.mp4' else c
                         for c in manifest['clips']]
    manifest['notes'] = [n for n in manifest['notes'] if not n.startswith('EN02 uses')]
    manifest['notes'].append('New EN02 keeps [0,7.875) and [10,15.0833333333) at normal speed; removes mistaken guard contact with Wei Yan after his last line. Native 1344x768 framing retained.')
    data = json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
    manifest_path.write_text(data)
    (HERE / '剪辑清单.json').write_text(data)
    assert digest(SOURCE) == source_hash
    assert all(digest(OUTPUT / n) == h for n, h in unchanged.items())
    print(json.dumps(clip, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
