"""Generation-preparation inventory. Reads originals; writes only this directory.
Run from any directory: python <absolute path to this file>
"""
from pathlib import Path
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from zoneinfo import ZoneInfo
import hashlib
import json
import os
import re
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WEB = ROOT / 'GameStarter/web-demo'
IMAGE_EXT = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.bmp', '.tif', '.tiff'}
VIDEO_EXT = {'.mp4', '.mov', '.webm', '.mkv', '.m4v', '.avi'}
SCAN_ROOTS = ['source-art', 'video', 'GameStarter/web-demo/public', 'GameStarter/assets', 'docs/visual-direction', 'demos']
SKIP = {'node_modules', '.git', '.build', '.cache', 'library', 'temp', 'dist', '__pycache__', 'asset-library'}

def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))

def rel(p):
    return p.resolve().relative_to(ROOT).as_posix()

def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

visuals = read(WEB / 'visual-assets.json')
core = read(ROOT / 'source-art/core/assets.json')['assets']
core_by_path = {rel(Path(a['path'])): a for a in core}
cleanup_log = ROOT / 'outputs/media-cleanup-20261104/recycle-results.jsonl'
recycled_paths = set()
if cleanup_log.exists():
    for line in cleanup_log.read_text(encoding='utf-8-sig').splitlines():
        row = json.loads(line)
        if row.get('status') == 'recycled': recycled_paths.add(row['path'])
bindings = defaultdict(list)
for kind in ['characters', 'scenes', 'cinematics', 'ui']:
    for key, value in visuals.get(kind, {}).items():
        bindings[rel(WEB / visuals['sourceRoot'] / value)].append(f'{kind}/{key}')
clips = read(WEB / 'public/video/media-manifest.json')['clips']
clip_paths = {rel(WEB / c['source']): c for c in clips}
video_uses = defaultdict(list)
def visit(obj):
    if isinstance(obj, dict):
        src = obj.get('src', '')
        if isinstance(src, str) and src.startswith('/video/'):
            video_uses['video/' + src[len('/video/'):]].append({'id': obj.get('id', ''), 'title': obj.get('title', ''), 'subtitles': obj.get('subtitles', '')})
        for value in obj.values(): visit(value)
    elif isinstance(obj, list):
        for value in obj: visit(value)
visit(read(WEB / 'public/cinematics.json'))

names = {
    'zhugeliang': '诸葛亮', 'weiyan': '魏延', 'jiangwei': '姜维',
    'guard': '甲（第一章守卒）', 'relay': '乙（第一章传报兵）', 'scout': '斥候（第一章）',
    'gouan': '苟安', 'liyan': '李严', 'grain-officer': '粮队管事', 'warehouse-clerk': '仓吏',
    'frontline-receiver': '前线接收人', 'local-levy-handler': '地方经手人', 'transport-handler': '仓中经手人',
    'old-woman': '老妇人', 'military-clerk': '军吏（第二章）', 'masu': '马谡', 'wangping': '王平',
    'jieting-scout': '探马（第三章）', 'jieting-clerk': '军吏（第三章）', 'jieting-water': '取水军士',
    'jieting-mover': '搬营军士', 'jieting-messenger': '传令军士（第三章）', 'jieting-leader': '领队军士',
    'jiangwei_guard': '姜维亲兵', 'pangtong': '庞统', 'chenjian': '陈简',
}
core_ids = {'zhugeliang':'诸葛亮', 'weiyan':'魏延', 'jiangwei':'姜维', 'guard':'甲', 'relay':'乙', 'scout':'斥候'}
aliases = {key: key for key in names}
for key, expr in visuals.get('characterExpressions', {}).items():
    for alias in expr.values(): aliases[alias] = key
profile_notes = {
 'zhugeliang': {
    'fixed': '消瘦长脸、灰黑长须。借寿镜头沿用披发、黑袍白襟；戴巾立绘和上方谷服装按各自场景管理。',
    'avoid': '不能用披发或戴巾的变化解释换脸，也不能把场景图中的雨水、悲恸表情带到所有镜头。',
    'review': '已看核心图与现用中性立绘：核心图为披发近景，立绘为戴巾半身。上方谷保留另一任务按用户确认方向完成的最新 v9；本次仅增强火光，未在这里新增人工通过结论。',
    'gaps': '补同一脸的正面、三分之二侧面、侧面近景；将披发借寿、戴巾议事、上方谷雨景分别登记为造型变体。上方谷 v9 的火光调整仍沿用原任务的审核流程。'},
 'weiyan': {
    'fixed': '中年宽脸、黑巾、短浓须、暗朱衣料、细片暗铁札甲。',
    'avoid': '不要继承参考图的怒眉和固定站姿；不要换成大片板甲，或把同框随从当成魏延。',
    'review': '已看核心图与现用中性立绘：宽脸、黑巾、短浓须与暗朱衣甲一致。表情图及所有影片仍需逐项核对。',
    'gaps': '补正面和侧面脸部近景、头巾背面、甲片与系带细节。急报、克制、决断的表情变化保持同一脸。'},
 'jiangwei': {
    'fixed': '青年面容、高束发、蓝灰衣领、浅色交领、深色札甲。面部须发按当前单人图保持，不自行加长须。',
    'avoid': '姜维亲兵是另一个角色；不能因名称含“姜维”而共用姜维的脸。不要复制参考图的固定站姿。',
    'review': '已看核心图与现用中性立绘：青年面容、高束发、蓝灰衣领与札甲一致。旧 EN04 文案写过短胡茬，生成时应核对实际单人图，不能凭旧描述加重须发。',
    'gaps': '补同一脸的正面、侧面及发髻背面近景；将担忧、接报、决断登记为表情变化。'},
}

old = {}
if (HERE / 'inventory.json').exists():
    old = {a['path']: a for a in read(HERE / 'inventory.json').get('assets', [])}
files = []
for base in SCAN_ROOTS:
    for parent, dirs, leaves in os.walk(ROOT / base):
        dirs[:] = sorted(d for d in dirs if d not in SKIP and not (Path(parent)/d).is_symlink())
        for leaf in sorted(leaves):
            p = Path(parent)/leaf
            if p.suffix.lower() in IMAGE_EXT | VIDEO_EXT and not p.is_symlink(): files.append(p)
files = sorted(set(files))

def inspect(p):
    path = rel(p); stat = p.stat(); is_video = p.suffix.lower() in VIDEO_EXT
    cached = old.get(path, {})
    a = {'id': 'A-' + hashlib.sha1(path.encode()).hexdigest()[:12], 'path': path, 'absolutePath': p.as_posix(),
         'name': p.name, 'type': '视频' if is_video else '图片', 'bytes': stat.st_size, 'mtimeNs': str(stat.st_mtime_ns),
         'modifiedAt': datetime.fromtimestamp(stat.st_mtime, ZoneInfo('Asia/Shanghai')).isoformat(),
         'bindings': bindings.get(path, []), 'uses': video_uses.get(path, []), 'characters': [],
         'reviewStatus': '未登记人工通过', 'errors': [], 'width': None, 'height': None, 'duration': None}
    try:
        a['sha256'] = cached['sha256'] if cached.get('bytes') == stat.st_size and cached.get('mtimeNs') == a['mtimeNs'] and cached.get('sha256') else digest(p)
        if not is_video and p.suffix.lower() != '.svg':
            with Image.open(p) as im:
                a.update(width=im.width, height=im.height)
    except Exception as exc: a['errors'].append(str(exc))
    if path in clip_paths:
        c = clip_paths[path]
        a.update(width=c.get('width'), height=c.get('height'), duration=c.get('duration'), metadataSource='游戏视频清单；本轮未重新解码')
        a['sourceStatus'] = c.get('status', '')
        a['manifestHashMatches'] = a.get('sha256') == c.get('sha256') if c.get('sha256') else None
    elif is_video: a['metadataSource'] = '历史视频未逐片探测；时长留空'
    if path in core_by_path:
        c = core_by_path[path]
        a.update(category='核心参考', use=c['use'], reviewStatus=c.get('approval','未登记人工通过'), provenance=c.get('source'), sourceFrame=c.get('frame'))
        a['provenanceExists'] = Path(c['source']).exists() if c.get('source') else None
        a['provenanceRecycled'] = bool(c.get('source') and rel(Path(c['source'])) in recycled_paths)
        a['coreHashMatches'] = a.get('sha256') == c.get('sha256')
    elif path in bindings: a['category'] = '现用人物' if any(b.startswith('characters/') for b in bindings[path]) else '现用美术'
    elif path in clip_paths: a['category'] = '发布视频'
    elif path.startswith('source-art/opening-'): a['category'] = '新场景候选'
    elif '/archive/' in path or 'rejected' in path: a['category'] = '归档或停用'
    elif any(x in path.lower() for x in ['/review/', '/audit/', '/frames/', '/qa/', 'contact-sheet', 'contact_sheet', 'sheet.jpg']): a['category'] = '检查图或截帧'
    elif any(x in path.lower() for x in ['reference', '参考', '/core/']): a['category'] = '制作参考'
    elif path.startswith('docs/visual-direction/'): a['category'] = '风格参考'
    elif is_video: a['category'] = '制作视频或历史版本'
    elif '/characters/' in path: a['category'] = '人物候选或旧版'
    else: a['category'] = '其他图片'
    a['releaseState'] = '发布清单选中' if path in bindings or path in clip_paths else ('公共资源目录（随构建复制）' if path.startswith('GameStarter/web-demo/public/') else '未由两份主清单直接选中')
    for b in a['bindings']:
        if b.startswith('characters/'):
            key = aliases.get(b.split('/')[1]);
            if key: a['characters'].append(key)
    for key, label in core_ids.items():
        if path == f'source-art/core/{label}.png': a['characters'].append(key)
    text = path + ' ' + ' '.join(u['title'] for u in a['uses'])
    inferred = []
    for key in ['zhugeliang','weiyan','jiangwei','gouan','liyan','masu','wangping','pangtong']:
        if names[key] in text or re.search(r'(?:/|\b)' + re.escape(key) + r'(?:/|[._-]|\b)', text, re.I):
            if key == 'jiangwei' and any(t in text for t in ['jiangwei_guard','jiangwei-guard','姜维亲兵']): continue
            if key not in a['characters']: inferred.append(key)
    a['relatedCharacters'] = inferred  # Path/title clue only; never a claim of visible cast.
    a['sidecars'] = [rel(q) for q in [p.with_suffix('.prompt.txt'), p.with_suffix('.json'), p.with_suffix('.md')] if q.exists()]
    return a

print(f'Scanning {len(files)} image/video files...', flush=True)
with ThreadPoolExecutor(max_workers=4) as pool: assets = list(pool.map(inspect, files))
by_path = {a['path']: a for a in assets}
groups = defaultdict(list)
for a in assets:
    if a.get('sha256'): groups[a['sha256']].append(a['path'])
for a in assets: a['duplicateCount'] = len(groups.get(a.get('sha256'), []))

profiles = []
for key, name in names.items():
    primary = rel(WEB / visuals['sourceRoot'] / visuals['characters'][key])
    corepath = f'source-art/core/{core_ids[key]}.png' if key in core_ids else None
    note = profile_notes.get(key, {})
    variants = [rel(WEB / visuals['sourceRoot'] / visuals['characters'][v]) for v in visuals.get('characterExpressions', {}).get(key, {}).values()]
    p = {'id': key, 'name': name, 'reference': corepath, 'runtime': primary, 'variants': list(dict.fromkeys(variants)),
         'status': '沿用现有参考，未新增人工通过', 'fixed': note.get('fixed', core_by_path.get(corepath, {}).get('use', '沿用当前角色 ID 绑定的脸、发式和服装；尚未整理单独的视频身份图。')),
         'avoid': note.get('avoid', '不同章节的普通军士分别保留身份；不能因为职务相同而换用其他人的脸。'),
         'review': note.get('review', '已核对文件和当前绑定；本轮未逐人完成视觉审核。'),
         'gaps': note.get('gaps', '补同一人的正面、侧面、衣装细节与视频参考；需要生成时先核对是否已有可用角度。'),
         'candidates': [a['path'] for a in assets if a['category'] == '新场景候选' and key in a['relatedCharacters']],
         'sources': ['GameStarter/web-demo/visual-assets.json', 'docs/art/CHARACTER-IDENTITY.md'] + (['source-art/core/assets.json'] if corepath else [])}
    profiles.append(p)

missing = [path for path in set(bindings) | set(clip_paths) | set(core_by_path) if not (ROOT/path).exists()]
summary = {'files': len(assets), 'types': dict(Counter(a['type'] for a in assets)), 'categories': dict(Counter(a['category'] for a in assets)),
           'characters': len(profiles), 'coreReferences': len(core), 'selectedArtFiles': len(bindings), 'selectedVideoFiles': len(clip_paths),
           'bytes': sum(a['bytes'] for a in assets), 'uniqueContents': len(groups), 'duplicateGroups': sum(len(g)>1 for g in groups.values()),
           'missingSelectedFiles': missing, 'readErrors': [a['path'] for a in assets if a['errors']],
           'manifestHashMismatches': [a['path'] for a in assets if a.get('manifestHashMatches') is False],
           'coreHashMismatches': [a['path'] for a in assets if a.get('coreHashMatches') is False]}
data = {'schemaVersion': 1, 'generatedAt': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(), 'root': ROOT.as_posix(),
        'purpose': '图片与视频生成准备；不用于游戏运行时', 'scope': SCAN_ROOTS,
        'exclusions': ['outputs/output 中的构建、测试截图、导出副本', 'node_modules、.build、.cache、library、temp、dist', '本资产清单及其预览图', '外部磁盘、飞书附件与未下载素材', '音频文件'],
        'summary': summary, 'characters': profiles, 'assets': assets,
        'packaging': {'directory': rel(HERE), 'runtimeBindingChanged': False,
          'evidence': ['GameStarter/web-demo/build.mjs', 'GameStarter/web-demo/tsconfig.json', 'GameStarter/packaging/windows/stage-payload.mjs'],
          'reason': '清单位于 source-art/asset-library；不在 public 或 Cocos assets，未写入 visual-assets.json 或 media-manifest.json。网页构建只按清单选取原件，Windows 载荷从网页构建及后端白名单复制。'}}
(HERE/'inventory.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
template = (HERE/'template.html').read_text(encoding='utf-8')
(HERE/'素材资产清单.html').write_text(template.replace('__DATA__', json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')), encoding='utf-8')
(HERE/'validation.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
