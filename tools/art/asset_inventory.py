"""Read-only source-art audit; generated reports live in docs/art.

Run: python tools/art/asset_inventory.py
Requires Pillow. Does not edit or convert images, remove assets, or touch .meta files.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import html
import json
import os
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".avif"}
TEXT_EXT = {".md", ".json", ".ts", ".css", ".html", ".js", ".mjs", ".py", ".scene", ".prefab"}
SKIP = {".git", "node_modules", ".build", "library", "temp", "local", "dist", ".cache", "__pycache__", "outputs"}
ACTIVE_TS = ["game.ts", "thought-workspace-view.ts", "ending-album.ts", "cinematics.ts"]
ACTIVE_CSS = ["game.css", "thought-workspace.css", "cinematics.css", "ending-album.css", "art-review/themes.css", "art-review/mindmap.css"]


def active_stylesheets() -> list[str]:
    index = (ROOT / "GameStarter/web-demo/public/index.html").read_text(encoding="utf-8")
    declared = re.findall(r'href="/([^"?]+\.css)"', index)
    # Album stylesheet is lazy-loaded by the current primary module.
    public = ROOT / "GameStarter/web-demo/public"
    discovered = set(declared + ["ending-album.css"])
    pending = list(discovered)
    while pending:
        name = pending.pop()
        path = public / name
        if not path.is_file():
            continue
        for imported in re.findall(r"@import\s+(?:url\()?['\"]([^'\"]+\.css)['\"]", path.read_text(encoding="utf-8")):
            resolved = public / imported.lstrip("/") if imported.startswith("/") else path.parent / imported
            relative = resolved.resolve().relative_to(public.resolve()).as_posix()
            if relative not in discovered:
                discovered.add(relative)
                pending.append(relative)
    return sorted(discovered)


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def sha(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def walk() -> list[Path]:
    files = []
    for parent, dirs, names in os.walk(ROOT):
        dirs[:] = sorted(d for d in dirs if d not in SKIP)
        files.extend(Path(parent) / name for name in sorted(names))
    return files


def category(path: str) -> str:
    if path.startswith("source-art/visuals/runtime/"):
        return "runtime-source/" + path.split("/")[3]
    if path.startswith("source-art/visuals/archive/"):
        return "archive/history"
    if path.startswith("source-art/visuals/style-tests/"):
        return "reference/user" if "user-atmosphere" in path else "candidate/style"
    if path.startswith("source-art/visuals/review/"):
        return "documentation/art-review"
    if path.startswith("source-art/visuals/spatial/"):
        return "spatial/reference-and-model"
    if path.startswith("source-art/visuals/"):
        return "art-working"
    if path.startswith("GameStarter/web-demo/public/"):
        if "background" in path or "landscape" in path:
            return "runtime-public/scenes"
        return "runtime-public/ui"
    if path.startswith("GameStarter/assets/"):
        return "cocos-source"
    if path.startswith("docs/visual-direction/references/"):
        return "reference/style-research"
    if path.startswith("video/"):
        return "video/reference-and-review"
    if path.startswith("docs/video/"):
        return "documentation/video-review"
    if path.startswith("docs/art/"):
        return "documentation/art-review"
    if "auth" in path.lower() or "draft_" in path:
        return "non-art/operational"
    return "unclassified"


def image_info(path: Path) -> dict:
    record = {"path": rel(path), "bytes": path.stat().st_size, "sha256": sha(path), "category": category(rel(path)), "metaSidecar": path.with_suffix(path.suffix + ".meta").exists()}
    try:
        if path.suffix.lower() == ".svg":
            node = ET.parse(path).getroot()
            record.update(format="SVG", width=node.get("width"), height=node.get("height"), viewBox=node.get("viewBox"), transparency="vector-not-raster-measured")
        else:
            with Image.open(path) as im:
                record.update(format=im.format, width=im.width, height=im.height, mode=im.mode)
                if "A" in im.getbands() or "transparency" in im.info:
                    alpha = im.convert("RGBA").getchannel("A")
                    hist = alpha.histogram()
                    total = im.width * im.height
                    record["alpha"] = {"min": alpha.getextrema()[0], "max": alpha.getextrema()[1], "transparentPixels": hist[0], "partialPixels": sum(hist[1:255]), "opaquePixels": hist[255], "transparentRatio": round(hist[0] / total, 6), "partialRatio": round(sum(hist[1:255]) / total, 6), "cornerAlpha": [alpha.getpixel(p) for p in [(0, 0), (im.width-1, 0), (0, im.height-1), (im.width-1, im.height-1)]]}
                    record["transparency"] = "real-alpha" if alpha.getextrema()[0] < 255 else "opaque-alpha-channel"
                else:
                    record["transparency"] = "opaque-no-alpha"
                im.verify() if not getattr(im, "fp", None) is None and "A" not in im.getbands() else None
        record["readable"] = True
    except Exception as error:
        record.update(readable=False, error=str(error))
    return record


def source_text(files: list[Path]) -> list[tuple[str, str]]:
    result = []
    for file in files:
        name = rel(file)
        if file.suffix.lower() not in TEXT_EXT or file.stat().st_size > 4 * 1024 * 1024:
            continue
        if name.startswith(("docs/art/", "tools/art/", "source-art/visuals/catalog", "source-art/visuals/archive/")):
            continue
        try:
            result.append((name, file.read_text(encoding="utf-8-sig")))
        except (UnicodeError, OSError):
            pass
    return result


def references(records: list[dict], texts: list[tuple[str, str]]) -> None:
    by_name = collections.defaultdict(list)
    for record in records:
        by_name[Path(record["path"]).name].append(record)
        record["references"] = []
    # Filename occurrence is an audit lead, not proof of an active runtime use.
    names = re.compile("|".join(re.escape(n) for n in sorted(by_name, key=len, reverse=True)), re.IGNORECASE)
    lower_names = {k.lower(): v for k, v in by_name.items()}
    for file, content in texts:
        for number, line in enumerate(content.splitlines(), 1):
            matches = {m.group().lower() for m in names.finditer(line)}
            for name in matches:
                for record in lower_names[name]:
                    if file == record["path"]:
                        continue
                    kind = "workspace-path" if record["path"] in line.replace("\\", "/") else "filename-only-needs-context"
                    record["references"].append({"file": file, "line": number, "match": kind})


def control_inventory() -> list[dict]:
    controls = []
    for name in ACTIVE_TS:
        file = ROOT / "GameStarter/web-demo/src" / name
        content = file.read_text(encoding="utf-8")
        for match in re.finditer(r"\bbtn\(\s*['\"]([^'\"]+)['\"]", content):
            controls.append({"file": rel(file), "line": content.count("\n", 0, match.start()) + 1, "tag": "button", "method": "btn-helper", "action": match.group(1), "markup": content[match.start():match.start()+180].split("\n")[0]})
        for match in re.finditer(r"<(button|input|textarea|summary)\b([^>]*?)>", content):
            tag, attrs = match.groups()
            # Helper itself is represented by its call sites above.
            if 'data-action="${action}"' in attrs:
                continue
            controls.append({"file": rel(file), "line": content.count("\n", 0, match.start()) + 1, "tag": tag, "method": "template-markup", "attributes": dict(re.findall(r'([\w-]+)="([^"]*)"', attrs)), "markup": match.group(0)[:420]})
    return controls


def runtime_use(manifest: dict, texts: list[tuple[str, str]]) -> tuple[list[dict], list[dict]]:
    base = ROOT / "GameStarter/web-demo"
    source = (base / manifest["sourceRoot"]).resolve()
    bindings, missing = [], []
    flow = json.loads((ROOT / "content/chapters/wuzhang/chapter-one.flow.json").read_text(encoding="utf-8"))
    active_scenes = {s["id"] for s in flow["scenes"]}
    game_text = (base / "src/game.ts").read_text(encoding="utf-8")
    # Derive mapped dialogue IDs from the personId declaration; retains explicit uncertainty for new patterns.
    mapper = re.search(r"const personId[^\n]+", game_text)
    active_people = set(re.findall(r"\?\s*'([^']+)'", mapper.group() if mapper else ""))
    helper = base / "src/character-art.ts"
    if helper.is_file() and "from './character-art'" in game_text:
        names = re.findall(r"\['([^']+)',\s*'([^']+)'\]", helper.read_text(encoding="utf-8"))
        script = json.loads((ROOT / "content/chapters/wuzhang/chapter-one.script.json").read_text(encoding="utf-8"))
        active_people = {ident for prefix, ident in names if any(row.get("speaker", "").startswith(prefix) for row in script["rows"])}
    expression_roles = {asset_id: role for role, moods in manifest.get("characterExpressions", {}).items() for asset_id in moods.values() if isinstance(asset_id, str)}
    css_text = "\n".join((base / "public" / name).read_text(encoding="utf-8") for name in active_stylesheets())
    for kind in ["characters", "scenes", "cinematics", "ui"]:
        for ident, path in manifest.get(kind, {}).items():
            absolute = (source / path).resolve()
            binding = {"kind": kind, "id": ident, "source": rel(absolute), "exists": absolute.is_file(), "declaredBy": "GameStarter/web-demo/visual-assets.json"}
            if kind == "characters":
                binding["mainGameConsumption"] = "dialogue-mapper" if ident in active_people else "expression-adapter-active-role" if expression_roles.get(ident) in active_people else "reserved-no-current-dialogue"
            elif kind == "scenes":
                binding["mainGameConsumption"] = "chapter-flow" if ident in active_scenes else "not-in-current-flow"
            else:
                binding["mainGameConsumption"] = "namespace-access-present" if re.search(r"media\."+kind+r"\b", game_text) else "namespace-not-read-by-game-ts"
                if f"/media/{kind}-{ident}." in css_text:
                    binding["mainGameConsumption"] = "primary-css-url"
            bindings.append(binding)
            if not binding["exists"]:
                missing.append(binding)
    # Accept nested expression maps without requiring a second manual asset list.
    def expression_paths(node: object, parts: list[str]) -> None:
        if isinstance(node, str) and Path(node).suffix.lower() in IMAGE_EXT:
            absolute = (source / node).resolve()
            binding = {"kind": parts[0], "id": "/".join(parts[1:]), "source": rel(absolute), "exists": absolute.is_file(), "declaredBy": "GameStarter/web-demo/visual-assets.json", "mainGameConsumption": "namespace-access-present" if re.search(r"media\."+parts[0]+r"\b", game_text) else "inspect-expression-adapter"}
            bindings.append(binding)
            if not binding["exists"]:
                missing.append(binding)
        elif isinstance(node, dict):
            for key, value in node.items():
                expression_paths(value, parts + [key])
    for key in ["expressions", "characterExpressions", "characterVariants"]:
        if key in manifest:
            expression_paths(manifest[key], [key])
    return bindings, missing


def primary_public_references() -> list[dict]:
    references = []
    sources = [ROOT / "GameStarter/web-demo/src" / name for name in ACTIVE_TS] + [ROOT / "GameStarter/web-demo/public" / name for name in active_stylesheets()]
    for source in sources:
        content = source.read_text(encoding="utf-8")
        for match in re.finditer(r"[\"'](/[^\"'\s${}]+\.(?:png|jpe?g|webp|svg))[\"']", content):
            url = match.group(1)
            path = ROOT / "GameStarter/web-demo/public" / url.lstrip("/")
            references.append({"file": rel(source), "line": content.count("\n", 0, match.start())+1, "url": url, "source": rel(path), "exists": path.is_file(), "resolution": "generated-media-check-build" if url.startswith("/media/") else "public-file"})
    return references


def expression_bindings(manifest: dict) -> list[dict]:
    result = []
    for role, moods in manifest.get("characterExpressions", {}).items():
        for mood, asset_id in moods.items():
            # This field is an ID lookup, not a file path.
            result.append({"role": role, "mood": mood, "assetId": asset_id, "resolves": asset_id in manifest.get("characters", {}), "source": manifest.get("characters", {}).get(asset_id)})
    return result


def gallery(records: list[dict], output: Path) -> None:
    selected = [r for r in records if r["path"].startswith(("source-art/visuals/", "GameStarter/web-demo/public/"))]
    groups = collections.defaultdict(list)
    for record in selected:
        groups[record["category"]].append(record)
    parts = ['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>美术资产分类索引</title><style>body{margin:32px;background:#e9e3d8;color:#302f29;font:16px/1.6 system-ui}h1{font-family:KaiTi,serif}section{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}article{background:#f9f5ec;padding:12px;border:1px solid #c7baa2}img{width:100%;height:230px;object-fit:contain;background:repeating-conic-gradient(#b7b2a7 0% 25%,#dad4c7 0% 50%) 50% / 18px 18px}code{word-break:break-all;font-size:11px}small{display:block;color:#6a6256}a{color:#713d2c}</style><h1>美术资产分类索引 · 2026-10-22</h1><p>现用、试验、归档分开显示；棋盘格仅用于辨认真实透明通道。未绑定与失效是两回事，未绑定图不自动删除。本页不代表用户视觉审批。</p>']
    for group, rows in sorted(groups.items()):
        parts.append(f'<h2>{html.escape(group)} ({len(rows)})</h2><section>')
        for row in rows:
            url = "../../" + row["path"]
            dimensions = f'{row.get("width", "?")} × {row.get("height", "?")}'
            parts.append(f'<article><a href="{html.escape(url)}"><img loading="lazy" src="{html.escape(url)}" alt="{html.escape(Path(row["path"]).name)}"></a><code>{html.escape(row["path"])}</code><small>{dimensions} · {html.escape(row.get("transparency", "unreadable"))}</small><small>绑定：{html.escape(", ".join(row.get("bindings", []))) or "无运行时 manifest 绑定"}</small></article>')
        parts.append('</section>')
    parts.append('</html>')
    output.write_text("\n".join(parts), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stamp", default="20261022")
    args = parser.parse_args()
    target = ROOT / "docs/art"
    target.mkdir(parents=True, exist_ok=True)
    files = walk()
    records = [image_info(p) for p in files if p.suffix.lower() in IMAGE_EXT]
    texts = source_text(files)
    references(records, texts)
    manifest = json.loads((ROOT / "GameStarter/web-demo/visual-assets.json").read_text(encoding="utf-8"))
    bindings, missing = runtime_use(manifest, texts)
    by_path = {r["path"]: r for r in records}
    for binding in bindings:
        if binding["source"] in by_path:
            by_path[binding["source"]].setdefault("bindings", []).append(binding["kind"] + "/" + binding["id"])
    hashes = collections.defaultdict(list)
    for record in records:
        hashes[record["sha256"]].append(record["path"])
    duplicates = [{"sha256": key, "files": values} for key, values in hashes.items() if len(values) > 1]
    controls = control_inventory()
    public_refs = primary_public_references()
    expressions = expression_bindings(manifest)
    flow = json.loads((ROOT / "content/chapters/wuzhang/chapter-one.flow.json").read_text(encoding="utf-8"))
    script = json.loads((ROOT / "content/chapters/wuzhang/chapter-one.script.json").read_text(encoding="utf-8"))
    aliases = []
    for kind in ["characters", "scenes", "ui", "cinematics"]:
        same = collections.defaultdict(list)
        for ident, path in manifest.get(kind, {}).items():
            same[path].append(ident)
        aliases += [{"kind": kind, "source": path, "ids": ids} for path, ids in same.items() if len(ids) > 1]
    result = {"schemaVersion": 1, "generatedAt": dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat(), "workspace": str(ROOT), "method": {"files": "source files excluding caches, outputs and build directories", "references": "static exact filename/path occurrences; not proof of runtime use", "alpha": "Pillow channel histogram, no image mutation", "controls": "static template control sites in four primary UI modules; instances generated by loops are listed once", "approval": "technical audit only; no user approval inferred"}, "sourceManifestVersion": manifest.get("version"), "summary": {"images": len(records), "bytes": sum(r["bytes"] for r in records), "categories": dict(collections.Counter(r["category"] for r in records)), "missingBindings": len(missing), "unreadableImages": sum(not r["readable"] for r in records), "duplicateGroups": len(duplicates), "primaryControlSites": len(controls), "unresolvedExpressionIds": sum(not item["resolves"] for item in expressions), "missingPrimaryPublicImages": sum(not r["exists"] and r["resolution"] == "public-file" for r in public_refs)}, "bindings": bindings, "aliases": aliases, "missingBindings": missing, "duplicateGroups": duplicates, "primaryScenes": flow["scenes"], "speakerCounts": dict(collections.Counter(r.get("speaker") for r in script["rows"])), "controls": controls, "expressionBindings": expressions, "primaryPublicReferences": public_refs, "images": records}
    report_path = target / f"inventory-{args.stamp}.json"
    report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (target / f"ui-controls-{args.stamp}.json").write_text(json.dumps({"schemaVersion": 1, "method": result["method"]["controls"], "controls": controls}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    gallery(records, target / f"catalog-{args.stamp}.html")
    lines = [f"# 美术资产审计 · {args.stamp}", "", f"生成时间：{result['generatedAt']}。本报告为可重复的技术盘点，不替代视觉审核或用户通过结论。", "", "运行：`python tools/art/asset_inventory.py`。仅写报告，不改图片、配置或 .meta。", "", "## 范围与结果", "", f"- 图片与 SVG：{len(records)} 个；总计 {result['summary']['bytes']/1024/1024:.1f} MiB。", f"- 缺失运行时绑定：{len(missing)}；无法读取的图片：{result['summary']['unreadableImages']}；完全相同 SHA-256 组：{len(duplicates)}。", f"- 主游戏 UI 静态交互定义：{len(controls)} 处（循环实例只列定义；不是屏幕上按钮数量）。", "- 构建与缓存、依赖、输出目录未纳入；视频原件不作图片计数，视频参考图与审片帧保留。", "", "| 类别 | 图片数 |", "| --- | ---: |"]
    lines += [f"| {kind} | {count} |" for kind, count in sorted(result["summary"]["categories"].items())]
    lines += ["", "## 角色透明度与实际绑定", "", "| 原件 | 尺寸 | 真透明像素 | 半透明像素 | 当前绑定 |", "| --- | --- | ---: | ---: | --- |"]
    for row in records:
        if row["category"] != "runtime-source/characters":
            continue
        alpha = row.get("alpha", {})
        lines.append(f"| `{row['path']}` | {row.get('width')} × {row.get('height')} | {alpha.get('transparentRatio', 0):.2%} | {alpha.get('partialRatio', 0):.2%} | {', '.join(row.get('bindings', [])) or '未绑定'} |")
    lines += ["", "透明通道统计只证明文件具有真 alpha；发丝边缘、透明背景残留和身份/影片一致性仍须逐图目检。", "", "## 运行时使用与复用", "", "| 类别 / ID | 源文件 | 主游戏使用证据 |", "| --- | --- | --- |"]
    lines += [f"| {b['kind']}/{b['id']} | `{b['source']}` | {b['mainGameConsumption']} |" for b in bindings]
    lines += ["", "### 同一文件的多名称绑定", ""]
    lines += [f"- {item['kind']}: {', '.join(item['ids'])} → `{item['source']}`" for item in aliases] or ["无。"]
    lines += ["", "## 完全相同的文件", "", "相同 SHA 只说明内容重复；发布副本、视频上传参考包与审片证据常需保留，不自动清理。", ""]
    lines += [f"- `{item['sha256'][:12]}`：" + "；".join(f"`{file}`" for file in item["files"]) for item in duplicates]
    lines += ["", "## UI 组件逐项清单", "", "来源为当前主入口 game.ts、thought-workspace-view.ts、ending-album.ts、cinematics.ts；未将 legacy 和独立 art-review 样张误报为主游戏。", "", "| 来源 | 类型 | 行为 / 标识 |", "| --- | --- | --- |"]
    for item in controls:
        attrs = item.get("attributes", {})
        ident = item.get("action") or ", ".join(f"{key}={value}" for key, value in attrs.items() if key.startswith("data-") or key in {"id", "class", "type"})
        lines.append(f"| `{item['file']}:{item['line']}` | {item['tag']} | {ident.replace('|', '∣')} |")
    lines += ["", "## 技术边界", "", "本次静态扫描不代替浏览器试玩、Cocos 编辑器验证、动画或对比视频审片。每个图片的哈希、alpha、引用位置详见同名 JSON；归档操作另见 source-art/visuals/archive/20261022/manifest.json。未绑定图不等于无效图。", ""]
    (target / f"inventory-{args.stamp}.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
