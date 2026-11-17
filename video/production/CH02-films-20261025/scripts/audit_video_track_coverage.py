"""Read-only full video-track coverage check; does not approve visual content."""
from pathlib import Path
import concurrent.futures, importlib.util, json, re, subprocess, time, urllib.parse

ROOT = Path(__file__).resolve().parents[1]
FF = 'C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
spec = importlib.util.spec_from_file_location('review_server', ROOT/'scripts/review_server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)
OUT = ROOT/'audit/video-track-coverage.json'
old = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
cache = {x['file']: x for x in old.get('clips', [])}

def inspect(item):
    group, clip = item
    path = ROOT/urllib.parse.unquote(clip['file'].split('?')[0])
    stat = path.stat()
    stamp = [stat.st_size, stat.st_mtime_ns]
    previous = cache.get(str(path))
    if previous and previous.get('stamp') == stamp:
        return previous
    row = {'id': clip['id'], 'group': group, 'file': str(path), 'stamp': stamp}
    try:
        meta = subprocess.run([FF, '-hide_banner', '-i', str(path)], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30)
        m = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', meta.stderr)
        duration = int(m[1])*3600+int(m[2])*60+float(m[3]) if m else None
        result = subprocess.run([FF, '-v', 'error', '-nostdin', '-i', str(path), '-map', '0:v:0', '-an', '-fps_mode', 'passthrough', '-progress', 'pipe:1', '-nostats', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180)
        progress = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
        frames = int(progress.get('frame', 0))
        end = int(progress.get('out_time_us', 0))/1000000
        covered = frames/24  # Production contract is constant 24fps.
        warnings = []
        if result.returncode or result.stderr.strip(): warnings.append('video_decode_error_or_diagnostic')
        if duration is None: warnings.append('container_duration_unknown')
        elif abs(covered-duration) > 0.6 or abs(end-duration) > 0.6: warnings.append('video_track_duration_or_frame_count_mismatch')
        if [path.stat().st_size, path.stat().st_mtime_ns] != stamp: warnings.append('file_changed_during_check')
        row.update(containerSeconds=duration, decodedFrames=frames, frameSecondsAt24fps=round(covered,3), videoEndSeconds=end, warnings=warnings, stderr=result.stderr[-1200:], status='needs-investigation' if warnings else 'technical-coverage-passed', checkedAt=time.strftime('%Y-%m-%d %H:%M:%S'))
    except Exception as exc:
        row.update(status='check-error', warnings=[type(exc).__name__], error=str(exc)[:500])
    return row

# Inspect the registered media even when the review UI quarantines it. Otherwise
# a failed file disappears from the next report and incorrectly becomes visible.
items = []
for group in server.data()['groups']:
    directory = ROOT/'groups'/group['group']
    registered = {}
    delivery = json.loads((directory/'delivery.json').read_text(encoding='utf-8-sig'))
    for key in ('clips', 'logicalClips', 'assembled', 'films'):
        for entry in delivery.get(key, []):
            if not isinstance(entry, dict): continue
            value = entry.get('file') or entry.get('path')
            if not value: continue
            path = Path(value)
            if not path.is_absolute(): path = directory/path
            path = path.resolve()
            if path.is_relative_to(directory.resolve()) and path.is_file():
                registered[entry.get('id')] = path
    for clip in group['clips']:
        candidate = dict(clip)
        if not candidate['file'] and clip['id'] in registered:
            candidate['file'] = urllib.parse.quote(registered[clip['id']].relative_to(ROOT).as_posix())
        if candidate['file']: items.append((group['group'], candidate))
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    rows = list(pool.map(inspect, items))
output = {'updated':time.strftime('%Y-%m-%d %H:%M:%S'), 'scope':'Video-only decoded frames and end time versus container duration; not visual/audio/user approval', 'clips':rows}
temp = OUT.with_suffix('.tmp')
temp.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
temp.replace(OUT)
print(json.dumps({'checked':len(rows), 'issues':[{k:r.get(k) for k in ('id','group','containerSeconds','decodedFrames','videoEndSeconds','warnings')} for r in rows if r['status']!='technical-coverage-passed']},ensure_ascii=False))
