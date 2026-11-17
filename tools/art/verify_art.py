"""Validate bound image files and export alpha review evidence without editing art."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'source-art/visuals'
OUT = ROOT / 'docs/art/review-20261022'
OUT.mkdir(parents=True, exist_ok=True)
manifest = json.loads((ROOT / 'GameStarter/web-demo/visual-assets.json').read_text(encoding='utf-8-sig'))
checks, errors, unique = [], [], {}
for kind in ('characters', 'scenes', 'cinematics', 'ui'):
    for asset_id, relative in manifest[kind].items():
        path = SOURCE / relative
        if not path.is_file():
            errors.append(f'Missing {kind}/{asset_id}: {relative}')
            continue
        if path.suffix == '.svg':
            continue
        with Image.open(path) as im:
            im.load()
            record = {'kind': kind, 'id': asset_id, 'source': relative, 'width': im.width, 'height': im.height, 'mode': im.mode, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
            if kind == 'characters':
                if 'A' not in im.getbands():
                    errors.append(f'Character has no alpha: {asset_id}')
                else:
                    alpha = im.getchannel('A')
                    hist = alpha.histogram()
                    record['transparentFraction'] = sum(hist[:5]) / (im.width * im.height)
                    record['opaqueFraction'] = sum(hist[250:]) / (im.width * im.height)
                    record['alphaRange'] = alpha.getextrema()
                    record['alphaBounds'] = alpha.getbbox()
                    if record['transparentFraction'] < .1 or record['opaqueFraction'] < .2:
                        errors.append(f'Implausible cutout alpha: {asset_id}')
                unique.setdefault(relative, (asset_id, path))
            checks.append(record)
for role, moods in manifest.get('characterExpressions', {}).items():
    if len(moods) < 2:
        errors.append(f'Insufficient expressions: {role}')
    for mood, asset_id in moods.items():
        if asset_id not in manifest['characters']:
            errors.append(f'Expression missing binding: {role}/{mood}')

width, height, cols = 300, 470, 4
rows = (len(unique) + cols - 1) // cols
sheet = Image.new('RGB', (cols * width, rows * height), '#b7b4a9')
draw = ImageDraw.Draw(sheet)
for i, (asset_id, path) in enumerate(unique.values()):
    x, y = i % cols * width, i // cols * height
    draw.rectangle((x, y, x + width / 2, y + height - 26), fill='#ebe7dc')
    draw.rectangle((x + width / 2, y, x + width, y + height - 26), fill='#15201f')
    im = Image.open(path).convert('RGBA')
    im.thumbnail((width - 16, height - 40))
    sheet.paste(im, (x + (width - im.width) // 2, y + 4), im)
    draw.text((x + 8, y + height - 22), asset_id, fill='#162320')
sheet.save(OUT / 'characters-alpha.jpg', quality=92)
report = {'passed': not errors, 'version': manifest['version'], 'checks': checks, 'errors': errors, 'note': 'Pixel alpha and binding validation only; human visual approval remains pending.'}
(OUT / 'image-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': not errors, 'imagesChecked': len(checks), 'uniqueCharacterImages': len(unique), 'errors': errors}))
if errors:
    raise SystemExit(1)
