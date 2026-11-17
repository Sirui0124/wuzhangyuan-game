"""Aggregate current-file visual acceptance; never infer it from decode success."""
from pathlib import Path
import hashlib, html, json, time, urllib.parse

ROOT = Path(__file__).resolve().parents[1]
def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path, value):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(path)

index = read(ROOT / 'deliveries/当前候选索引.json')
production_path = ROOT / 'deliveries/生产交付状态.json'
required_policy = read(production_path).get('requiredPictureReviewPolicy') if production_path.exists() else None
dest = ROOT / 'audit/picture-usability'
dest.mkdir(exist_ok=True)
prior = {}
if (dest / 'current.json').exists():
    prior = {x['id']: x for x in read(dest / 'current.json')['clips']}
reports = {}
root_findings = {}
if (dest / 'root-findings.json').exists():
    root_findings = {x['id']:x for x in read(dest/'root-findings.json').get('clips',[])}
for group in ('G1', 'G2', 'G3', 'G4', 'G5', 'G6'):
    path = ROOT / 'groups' / group / 'review/picture-usability.json'
    if path.exists():
        reports[group] = {x['id']: x for x in read(path).get('clips', [])}
clips = []
for slot in index['slots']:
    row = dict(slot, reviewState='pending', pictureUsability=None,
               integrationConditions=[], issues=[], userApproved=False)
    path = Path(slot['file']) if slot.get('file') else None
    if path and path.exists():
        stat = path.stat()
        stamp = [stat.st_size, stat.st_mtime_ns]
        old = prior.get(slot['id'], {})
        if old.get('file') == str(path) and old.get('stamp') == stamp:
            sha = old.get('sha256')
        else:
            with path.open('rb') as stream:
                sha = hashlib.file_digest(stream, 'sha256').hexdigest()
        row.update(sha256=sha, stamp=stamp, mtimeNs=str(stat.st_mtime_ns))
        report = reports.get(slot['owner'], {}).get(slot['id'])
        if report:
            row['ownerReport'] = report
            same = report.get('sha256', '').lower() == sha
            row['ownerReportMatchesCurrentSha'] = same
            state = report.get('pictureUsability')
            if same and report.get('reviewState') != 'pending' and state in ('usable', 'usable-with-integration-condition', 'needs-repair'):
                row.update(reviewState='reviewed', pictureUsability=state,
                           integrationConditions=report.get('integrationConditions', []),
                           issues=report.get('issues', []))
                # Batch two explicitly retains the no-card/no-box picture rules
                # and adds speech/duration checks. Accept that named successor,
                # without accepting arbitrary later or missing policy values.
                accepted_policies = {required_policy}
                if required_policy == '20261025-no-meta-no-cards-no-boxes':
                    accepted_policies.add('20261025-batch2-clean-speech-and-duration')
                if required_policy and report.get('reviewPolicy') not in accepted_policies:
                    row.update(reviewState='pending-current-user-policy', pictureUsability=None,
                               priorProductionAssessment=state, requiredReviewPolicy=required_policy)
            elif not same:
                row['reviewState'] = 'stale-owner-report'
        finding = root_findings.get(slot['id'])
        if finding and finding.get('sha256') == sha and finding.get('pictureUsability') == 'needs-repair':
            row.update(reviewState='root-confirmed-issue', pictureUsability='needs-repair',
                       rootFinding=finding, issues=row['issues']+finding.get('issues',[]))
    clips.append(row)
counts = {k: sum(x['pictureUsability'] == k for x in clips) for k in ('usable', 'usable-with-integration-condition', 'needs-repair')}
counts['pending'] = sum(x['pictureUsability'] is None for x in clips)
out = dict(updated=time.strftime('%Y-%m-%d %H:%M:%S'), scope='Current SHA owning-group picture usability; not audio approval, user approval, or game integration', counts=counts, clips=clips, userApproved=False, allReviewed=counts['pending']==0, unresolvedRepairs=counts['needs-repair'])
write(dest / 'current.json', out)
write(dest / 'repair-queue.json', {'updated':out['updated'], 'confirmedRepairs':[x for x in clips if x['pictureUsability']=='needs-repair'], 'pendingReview':[x['id'] for x in clips if x['pictureUsability'] is None]})
status_path = ROOT / 'deliveries/生产交付状态.json'
if status_path.exists():
    production = read(status_path)
    production.update(updated=out['updated'], pictureUsabilityCounts=counts,
                      pictureUsabilityReport=str(dest/'current.json'))
    write(status_path, production)
labels = {None:'待复核', 'usable':'画面可用', 'usable-with-integration-condition':'有接入条件', 'needs-repair':'需返修'}
rows = []
for x in clips:
    detail = json.dumps({'conditions':x['integrationConditions'],'issues':x['issues']},ensure_ascii=False)
    link = '../../' + urllib.parse.quote(Path(x['file']).relative_to(ROOT).as_posix()) if x.get('file') else '#'
    rows.append(f"<tr><td>{x['owner']}</td><td><a href='{html.escape(link)}'>{x['id']} {html.escape(x['name'])}</a></td><td>{labels[x['pictureUsability']]}</td><td>{html.escape(detail)}</td></tr>")
page = "<!doctype html><meta charset='utf-8'><title>第二章画面可用性复核</title><style>body{font:16px system-ui;margin:30px;line-height:1.6}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:10px;text-align:left}th{background:#eee}td:nth-child(3){white-space:nowrap}</style><h1>第二章画面可用性复核</h1><p>" + html.escape(out['updated']) + " · 音画按本轮意见返修；此表仅记录画面复核，声音听审和用户复审单独保留。</p><p>" + html.escape(json.dumps(counts,ensure_ascii=False)) + "</p><table><tr><th>组</th><th>当前视频</th><th>画面结论</th><th>接入条件 / 问题</th></tr>" + ''.join(rows) + '</table>'
(dest / 'review.html').write_text(page, encoding='utf-8')
print(json.dumps({'counts':counts,'report':str(dest/'current.json')},ensure_ascii=False))

