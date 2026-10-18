#!/usr/bin/env python3
"""Reproduce the approved trims without changing any generated source clip."""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import os
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(os.environ['WUZHANG_LEGACY_VIDEO_SOURCE'])
OUTPUT = ROOT / 'GameStarter/web-demo/public/video'
FILES = {
    'SC01': 'SC01_秋营疾风与魏延掀帘灯灭_seedance2.5_720p_20261011-1445.mp4',
    'SC02': 'SC02_手机观看与愤怒许愿_seedance2.5_720p_20261011-1441.mp4',
    'SC03': 'SC03_穿越成为普通小卒_seedance2.5_720p_20261011-1443.mp4',
    'EN01': 'EN01_守灯成功七日期满_seedance2.5_720p_20261011-1443.mp4',
    'EN02': 'EN02_魏延出帐与小卒被架走_20261011_144343.mp4',
    'EN03': 'EN03-北伐停滞与半月后病重_seedance2.5_16s_16x9_720p_20261011-144255.mp4',
    'EN04': 'EN04_姜维感叹与主角回溯回应_seedance2.5_720p_20261011-1444.mp4',
}
# (source, source start/end in seconds, baked-in speed). Boundaries use 24fps frames.
EDITS = {
    'wuzhang-opening-v01.mp4': [('SC01', 0, 18.875, 1), ('SC02', 0, 9, 1),
                               ('SC03', 0, 1, 1), ('SC03', 2.5, 8, 1)],
    'wuzhang-success-common-v01.mp4': [('EN01', 0, 12, 1)],
    'wuzhang-blame-v01.mp4': [('EN02', 0, 9, 1), ('EN02', 11, 16, 2)],
    'wuzhang-safe-future-v01.mp4': [('EN03', 0, 16, 1), ('EN04', 0, 18, 1)],
}

def probe(path):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def render(item):
    name, cuts = item
    ids = list(dict.fromkeys(cut[0] for cut in cuts))
    args = ['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y']
    for id_ in ids:
        args += ['-i', str(SOURCE / FILES[id_])]
    filters, labels = [], []
    timeline, cursor = [], 0
    for n, (id_, start, end, speed) in enumerate(cuts):
        i = ids.index(id_)
        duration = (end - start) / speed
        filters.append(f'[{i}:v]trim=start={start}:end={end},setpts=(PTS-STARTPTS)/{speed},'
                       f'fps=24,setsar=1,format=yuv420p[v{n}]')
        audio = (f'[{i}:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,'
                 'aresample=48000')
        if speed != 1:
            audio += f',atempo={speed}'
        # Short sample fades remove edit clicks; do not overlap or shorten dialogue.
        audio += (f',afade=t=in:st=0:d=0.008,'
                  f'afade=t=out:st={duration - 0.008}:d=0.008[a{n}]')
        filters.append(audio)
        labels.append(f'[v{n}][a{n}]')
        timeline.append({'source': id_, 'sourceStart': start, 'sourceEnd': end,
                         'speed': speed, 'outputStart': cursor, 'outputEnd': cursor + duration})
        cursor += duration
    filters.append(''.join(labels) + f'concat=n={len(cuts)}:v=1:a=1[v][a]')
    args += ['-filter_complex', ';'.join(filters), '-map', '[v]', '-map', '[a]',
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-threads', '4',
             '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
             '-movflags', '+faststart', '-metadata', 'title=' + name.removesuffix('.mp4'),
             str(OUTPUT / name)]
    subprocess.run(args, check=True)
    result = probe(OUTPUT / name)
    video = next(s for s in result['streams'] if s['codec_type'] == 'video')
    print(f'{name}: {cursor:.3f}s, {int(result["format"]["size"]):,} bytes', flush=True)
    return {'file': name, 'url': '/video/' + name, 'duration': cursor,
            'containerDuration': float(result['format']['duration']),
            'width': video['width'], 'height': video['height'], 'fps': video['avg_frame_rate'],
            'videoCodec': video['codec_name'], 'bytes': int(result['format']['size']),
            'sha256': digest(OUTPUT / name), 'timeline': timeline}

if __name__ == '__main__':
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sources = {id_: {'path': str(SOURCE / filename), 'sha256': digest(SOURCE / filename),
                     'videoDuration': float(next(s for s in probe(SOURCE / filename)['streams']
                                                 if s['codec_type'] == 'video')['duration'])}
               for id_, filename in FILES.items()}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        clips = list(pool.map(render, EDITS.items()))
    assert all(digest(Path(s['path'])) == s['sha256'] for s in sources.values())
    manifest = {'version': 1, 'sources': sources, 'clips': clips,
                'notes': ['SC01 removes the duplicate camp tail starting at 18.875s.',
                          'SC03 removes silent black frames from 1.0 to 2.5s; all voices retained.',
                          'EN02 uses [0,9) then [11,16) at 2x, per user instruction.',
                          'EN03 and EN04 are the latest user-supplied generated clips.',
                          'Player speed choices multiply the already edited speed.']}
    data = json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
    (OUTPUT / 'media-manifest.json').write_text(data)
    (Path(__file__).parent / '剪辑清单.json').write_text(data)
