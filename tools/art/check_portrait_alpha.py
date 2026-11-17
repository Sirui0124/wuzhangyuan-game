"""Inspect source alpha and make black/white review contact sheets; never edits source PNGs."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
paths = [ROOT / f"source-art/visuals/runtime/characters/{name}/neutral-v3.png" for name in ("guard", "relay")]
target = ROOT / "docs/art"
sheet = Image.new("RGB", (1600, 1280), "#d5cbb8")
draw = ImageDraw.Draw(sheet)
records = []
for index, path in enumerate(paths):
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    width, height = image.size
    records.append({"path": path.relative_to(ROOT).as_posix(), "size": [width, height], "alphaRange": list(alpha.getextrema()), "transparentRatio": histogram[0] / (width * height), "partialRatio": sum(histogram[1:255]) / (width * height), "nearlyOpaqueRatio": sum(histogram[250:]) / (width * height), "cornerAlpha": [alpha.getpixel(point) for point in [(0,0),(width-1,0),(0,height-1),(width-1,height-1)]], "review": "black and white composite; source pixels unchanged"})
    for side, background in enumerate(("white", "black")):
        panel = Image.new("RGBA", image.size, background)
        panel.alpha_composite(image)
        panel.thumbnail((760, 590))
        x, y = side * 800 + (800 - panel.width) // 2, index * 640 + 40
        sheet.paste(panel.convert("RGB"), (x, y))
        draw.text((side * 800 + 20, index * 640 + 12), f"{path.parent.name} / {background} / real alpha", fill="black")
sheet.save(target / "npc-alpha-proof-20261022.jpg", quality=92)
(target / "npc-alpha-proof-20261022.json").write_text(json.dumps(records, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
print(json.dumps(records, ensure_ascii=False))
