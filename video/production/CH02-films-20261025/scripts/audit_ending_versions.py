"""Verify registered ending identities and decoded video coverage, without editing owner files."""
from pathlib import Path
import concurrent.futures, hashlib, json, re, subprocess, time

ROOT = Path(__file__).resolve().parents[1]
END = ROOT.parent / 'ENDINGS-20261025/chapter-two'
FF = 'C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
OUT = ROOT / 'audit/picture-usability/ending-current-integrity.json'
delivery = json.loads((END/'delivery.json').read_text(encoding='utf-8-sig'))
old = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
cache = {x['file']: x for x in old.get('films', [])}

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def inspect(film):
    path = Path(film['path'])
    stat = path.stat()
    stamp = [stat.st_size, str(stat.st_mtime_ns)]
    prior = cache.get(str(path))
    if prior and prior.get('stamp') == stamp:
        row = dict(prior)
    else:
        row = {'id':film['id'], 'file':str(path), 'stamp':stamp, 'sha256':digest(path)}
        meta = subprocess.run([FF,'-hide_banner','-i',str(path)],capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=30)
        match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',meta.stderr)
        duration = int(match[1])*3600+int(match[2])*60+float(match[3]) if match else None
        run = subprocess.run([FF,'-v','error','-nostdin','-i',str(path),'-map','0:v:0','-an','-fps_mode','passthrough','-progress','pipe:1','-nostats','-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=180)
        progress = dict(line.split('=',1) for line in run.stdout.splitlines() if '=' in line)
        frames = int(progress.get('frame',0)); end = int(progress.get('out_time_us',0))/1000000
        row.update(containerSeconds=duration,decodedFrames=frames,videoEndSeconds=end,decodePassed=run.returncode==0 and not run.stderr.strip(),coveragePassed=duration is not None and abs(frames/24-duration)<0.6 and abs(end-duration)<0.6,unchangedDuringCheck=stamp==[path.stat().st_size,str(path.stat().st_mtime_ns)])
    row['matchesRegisteredSha'] = row['sha256']==film.get('sha256')
    row['ownerVisualAssessment'] = film.get('visualAssessment')
    row['userApproved'] = False
    return row

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    rows = list(pool.map(inspect,delivery['films'] + delivery.get('epilogues', [])))
source_file = END/'review/motion-followup/G6-source-audit.json'
source_rows=[]
if source_file.exists():
    source_audit=json.loads(source_file.read_text(encoding='utf-8-sig'))
    # Match each slot to its current root index; historical paths in delivery must not qualify.
    index=json.loads((ROOT/'deliveries/当前候选索引.json').read_text(encoding='utf-8-sig'))
    slots={x['id']:x for x in index['slots'] if x['owner']=='G6'}
    for item in source_audit['records']:
        sha=item['usedSha256']
        current=slots.get(item['slot'],{}).get('file')
        actual=digest(Path(current)) if current else None
        source_rows.append({'ending':item['ending'],'slot':item['slot'],'sha256':sha,'presentInCurrentG6Delivery':sha==actual,'actualCurrentSha256':actual,'file':current})
result={'checkedAt':time.strftime('%Y-%m-%d %H:%M:%S'),'scope':'Current registered file SHA and complete video-track decode only; not human visual/audio approval','films':rows,'G6Sources':source_rows}
temp=OUT.with_suffix('.tmp');temp.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(OUT)
print(json.dumps({'films':len(rows),'technicalIssues':[r['id'] for r in rows if not all(r.get(k) for k in ('decodePassed','coveragePassed','unchangedDuringCheck','matchesRegisteredSha'))],'sourceMismatches':[r['slot'] for r in source_rows if not r['presentInCurrentG6Delivery']]},ensure_ascii=False))
