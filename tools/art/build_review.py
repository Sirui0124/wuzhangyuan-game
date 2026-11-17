"""Build the offline art review page from the authoritative visual manifest.

The screenshot switches are explicit freshness gates: use only after the relevant
agent confirms newly captured page screenshots. No review approval is generated.
"""
from pathlib import Path
import argparse
import datetime as dt
import hashlib
import html
import json
import os
import shutil
from urllib.parse import quote
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
VISUALS = ROOT / "source-art/visuals"
DEST = VISUALS / "review/20261022"
MANIFEST = ROOT / "GameStarter/web-demo/visual-assets.json"
LABELS = {"weiyan": "魏延", "jiangwei": "姜维", "zhugeliang": "诸葛亮", "guard": "守帐卒甲", "relay": "传令卒乙", "scout": "斥候", "jiangwei_guard": "姜维亲兵"}
MOODS = {"neutral": "平静 / 聆听", "alert": "警觉 / 施压", "concerned": "忧虑 / 权衡", "weary": "疲惫 / 病中", "resolved": "决意 / 回应"}
SOURCES = {
    "weiyan": {"frame": "EN02B-A-reference.png", "text": "身份母版实际输入：今日 EN02B-A 视频 4.9 秒抽帧；另外两表情由 neutral-v3.png 编辑。"},
    "jiangwei": {"frame": "EN04-reference.png", "text": "身份母版实际输入：今日 EN04 视频 6.69 秒抽帧；另外两表情由 neutral-v3.png 编辑。"},
    "zhugeliang": {"frame": "EN03-reference.png", "text": "身份母版实际输入：今日 EN03 视频 8.71 秒抽帧；另外两表情由 neutral-v3.png 编辑。"},
    "guard": {"frame": None, "text": "以既有 guard.png 锁定身份和衣甲进行透明化编辑；本图未使用新视频抽帧作为生成输入。"},
    "relay": {"frame": None, "text": "以既有 relay.png 锁定身份、粗麻衣装与文书进行透明化编辑；本图未使用新视频抽帧作为生成输入。"},
    "scout": {"frame": None, "text": "保留既有 scout-transparent-v02.png；已有真实 alpha，本轮未重生成人物。"},
}


def esc(value):
    return html.escape(str(value), quote=True)


def link(path):
    return quote(os.path.relpath(path, DEST).replace("\\", "/"), safe="/.-_")


def path_text(path):
    return path.relative_to(ROOT).as_posix()


def metadata(path):
    item = {"path": path_text(path), "exists": path.is_file()}
    if path.is_file():
        item["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        item["modifiedAt"] = dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone(dt.timedelta(hours=8))).isoformat()
        try:
            with Image.open(path) as im:
                item["size"] = [im.width, im.height]
                item["mode"] = im.mode
                if "A" in im.getbands():
                    a = im.getchannel("A")
                    hist = a.histogram()
                    item["alphaRange"] = a.getextrema()
                    item["transparentRatio"] = hist[0] / (im.width * im.height)
        except (OSError, ValueError):
            pass
    return item


def image_card(path, title, caption="", kind="landscape", badge="待视觉审核"):
    if not path.is_file():
        return f'<article class="asset pending"><h3>{esc(title)}</h3><p>尚未提供</p><code>{esc(path_text(path))}</code></article>'
    m = metadata(path)
    dimensions = " × ".join(map(str, m.get("size", [])))
    alpha = f' · 真透明像素 {m["transparentRatio"]:.1%}' if "transparentRatio" in m else ""
    return f'<article class="asset"><button class="image-open {kind}" data-image="{link(path)}" data-title="{esc(title)}" aria-label="放大查看{esc(title)}"><img loading="lazy" src="{link(path)}" alt="{esc(title)}"></button><div class="asset-copy"><span class="status">{esc(badge)}</span><h3>{esc(title)}</h3><p>{esc(caption)}</p><small>{dimensions}{alpha}</small><a class="file" href="{link(path)}" target="_blank">{esc(path_text(path))}</a></div></article>'


def build_characters(manifest):
    blocks = []
    data = []
    for role in ["weiyan", "jiangwei", "zhugeliang", "guard", "relay", "scout"]:
        mapping = manifest.get("characterExpressions", {}).get(role, {"neutral": role})
        note = "预备资源；第一章没有强插诸葛亮对白。" if role == "zhugeliang" else "当前绑定是技术状态，视觉仍待用户审核。"
        if role == "guard":
            note += " 姜维亲兵暂共用该立绘，身份复用明确保留。"
        cards = []
        group = {"id": role, "name": LABELS[role], "reviewStatus": "待review", "note": note, "source": SOURCES[role], "variants": []}
        for mood, asset_id in mapping.items():
            relative = manifest.get("characters", {}).get(asset_id)
            if not relative:
                cards.append(f'<p class="warning">表情 {esc(mood)} 引用不存在的角色ID：{esc(asset_id)}</p>')
                continue
            path = VISUALS / relative
            group["variants"].append({"mood": mood, "assetId": asset_id, **metadata(path)})
            badge = "预备资源 · 待review" if role == "zhugeliang" else "当前绑定 · 待review"
            cards.append(image_card(path, MOODS.get(mood, mood), f'角色 ID：{asset_id}', "portrait", badge))
        legacy = VISUALS / f"runtime/characters/{role}.png"
        if legacy.is_file():
            cards.append(image_card(legacy, "旧版身份原件", "保留视频制作及历史引用，不覆盖原图。旧底色不具备透明通道。", "portrait legacy", "历史原件"))
        reference = ""
        source = SOURCES[role]
        if source["frame"]:
            refpath = DEST / source["frame"]
            reference = f'<details class="reference"><summary>查看最新视频身份参考与实际输入来源</summary>{image_card(refpath, "视频身份参考", source["text"], "landscape", "来源证据")}</details>'
        blocks.append(f'<section class="character-group"><div class="group-title"><h3>{LABELS[role]}</h3><span>{esc(note)}</span></div><p class="source-note">{esc(source["text"])}</p><div class="asset-grid portraits">{"".join(cards)}</div>{reference}</section>')
        data.append(group)
    return "".join(blocks), data


def build_scenes(manifest):
    groups = []
    data = []
    names = {"camp_gate": "中军帐前", "report_post": "营前传报处", "jiangwei_tent_front": "姜维将军帐前"}
    old = {"camp_gate": "camp_gate.png", "report_post": "report_post.png", "jiangwei_tent_front": "relay_tent.png"}
    evidence = {
        "camp_gate": "视频空间对照：SC03 的闭帘主帐、门侧灯与帐前空地。这里只是对照说明，不把生成底图称为视频精确复建。",
        "report_post": "本轮生成实际输入：preview-report.png 空间样机。低矮开放传报棚在左，中低文书案可见，道路在右；没有将 SC03 主帐帧作为生成输入。",
        "jiangwei_tent_front": "本轮生成实际输入：preview-jiangwei.png 空间样机。独立较小闭帘帐，文书案与单灯在右；不是主帐复制，也不是从帐内朝外看。",
    }
    for ident, name in names.items():
        path = VISUALS / manifest["scenes"][ident]
        new = "camp-v3" in str(path)
        note = "新底图当前绑定，待整体视觉审核。" if new else "旧版当前仍绑定；新版底图尚未接入，不能将旧图标成已重做。"
        cards = image_card(path, name + " · 当前绑定", note, badge="当前绑定 · 待review")
        previous = VISUALS / "runtime/scenes" / old[ident]
        if path != previous:
            cards += image_card(previous, name + " · 旧版", "仅供差异对照，原路径保留给视频制作与历史流程。", badge="历史原件")
        groups.append(f'<section class="scene-group"><h3>{name}</h3><p class="source-note">{esc(evidence[ident])}</p><div class="asset-grid comparison">{cards}</div></section>')
        data.append({"id": ident, "title": name, "reviewStatus": "待review", "newVersionBound": new, "sourceEvidence": evidence[ident], **metadata(path)})
    aliases = '<p class="note">其他 manifest 场景 ID：relay_tent、waiting_area 为保留资源；notice_front 是中军帐前的别名。按当前第一章实际路线审三处主要空间，未绑定的候选不进入本页当前绑定墙。</p>'
    return "".join(groups) + aliases, data


def build_ui(include_ui, include_gameplay):
    data = []
    historical_data = []
    blocks = []
    historical = []

    def add_page(path, title, source, caption, latest=False, history=False):
        if not path.is_file():
            return
        version = "historical" if history else "latest-dialogue" if latest else "current-unchanged-page"
        (historical_data if history else data).append({"source": source, "reviewVersion": version, "reviewStatus": "历史对照" if history else "待review", **metadata(path)})
        badge = "历史版本 · 不作本轮确认" if history else "最新对白稿 · 待review" if latest else "整页待review"
        card = image_card(path, title, caption, "screenshot", badge)
        (historical if history else blocks).append(card)

    if include_ui:
        latest_directory = ROOT / "docs/art/review-20261022/dialogue-light"
        latest = {"awakening": "醒来 · 轻透明对白", "notice": "告示 · 去除底线与补充文案", "scout": "斥候 · 整框继续", "choice": "斥候分支 · 独立选项", "weiyan": "魏延 · 轻透明对白", "tablet": "对白 · 平板视口", "clue-in-flight": "线索 · 短暂飘入思绪"}
        missing = [str(latest_directory / (name + ".png")) for name in latest if not (latest_directory / (name + ".png")).is_file()]
        if missing:
            raise FileNotFoundError("Latest dialogue screenshot set is incomplete: " + ", ".join(missing))
        for name, title in latest.items():
            add_page(latest_directory / (name + ".png"), title, "dialogue-light-latest-confirmed", "本轮最新整页稿；无分支时整框继续，线索短暂飘入思绪。视觉仍待用户审核。", latest=True)

        directory = ROOT / "docs/art/review-20261022/ui"
        labels = {"menu": "开始页", "thoughts": "思绪 · 初始问题", "thoughts-developed": "思绪 · 展开推理", "expression": "表达组织 · 人物显示修复后", "settings": "设置", "save": "存档"}
        # Explicitly confirmed pages only: never promote an arbitrary new PNG or a failed capture.
        for name, title in labels.items():
            add_page(directory / (name + ".png"), title, "ui-art-fresh-confirmed", "本轮保留的整体页面稿；待用户审核。")
        old_labels = {"dialogue": "旧版 · 中军帐前对白", "dialogue-report": "旧版 · 营前传报处对白", "weiyan": "旧版 · 魏延对白", "notice": "旧版 · 告示与重点信息"}
        for name, title in old_labels.items():
            add_page(directory / (name + ".png"), title, "ui-art-historical", "已被本轮轻透明对白截图替代，仅供追溯差异，不作当前页面确认。", history=True)
        add_page(directory / "six-pages-review.jpg", "旧版 · 六页整体对照", "ui-art-overview-historical", "包含旧对白版式，仅作历史对照；本轮以最前方七张新版截图为准。", history=True)
    if include_gameplay:
        directory = ROOT / "outputs/full-game-20261022"
        labels = {"05-thoughts-q1": "思绪 · 第一轮推理", "06-thoughts-q2": "思绪 · 后续推理", "07-expression": "表达组织", "08-player-speech": "玩家发言 · 当前轻薄版", "09-returned-order": "回令交接 · 当前轻薄版", "10-ending": "结章", "12-settings-tablet": "设置 · 窄屏"}
        for name, title in labels.items():
            add_page(directory / (name + ".png"), title, "full-game-fresh-confirmed", "本轮完整流程重新截图；技术记录不代替整体美术通过。")
    wall = '<div class="asset-grid page-grid">' + "".join(blocks) + '</div>' if blocks else '<div class="pending-panel"><h3>整页新稿等待截图</h3><p>旧截图不作本轮整页确认。待轻薄墨绢与规整细线的新页面完成截图后刷新图册；当前不展示已否定的木板版整页。</p></div>'
    if historical:
        wall += '<details class="reference ui-history"><summary>历史对白与六页总览 · 已被新版替代，不作本轮确认</summary><p class="note">原始截图保留，不删除；本轮最新对白、分支与线索动效见本区最前七张。</p><div class="asset-grid page-grid">' + "".join(historical) + '</div></details>'
    materials = ["ui-button-darkwood-v01.png", "ui-panel-hemp-paper-v01.png", "ui-seal-cinnabar-v01.png", "ui-panel-ink-linen-v01.png"]
    rejected = "".join(image_card(VISUALS / "archive/20261022/ui-material-prototypes" / name, name, "用户已反馈木板和页面不协调；样品保留追溯，当前页面不调用。", "sample", "本轮样品未采用，待整体UI审核") for name in materials)
    panel = '<details class="rejected"><summary>未采用样品归档 · 木板 / 朱印 / 纸 / 布料（不列入当前页面稿）</summary><p class="warning">本轮样品未采用，待整体UI审核。停止据此扩产；先审完整页面，再决定是否需要细材质。</p><div class="asset-grid">' + rejected + '</div></details>'
    return wall + panel, data + historical_data


def build_spatial():
    directory = VISUALS / "spatial/camp-v1"
    images = [("camp-plan.png", "军营总平面与人物锚点"), ("main-tent-plan.png", "中军主帐 · 两种布置平面"), ("preview-overview.png", "空间样机 · 营地总览"), ("preview-interior.png", "空间样机 · 主帐内景")]
    cards = "".join(image_card(directory / name, title, "空间连续性样机，待review；不是最终影视精模或成片。", badge="空间样机 · 待review") for name, title in images)
    links = " · ".join(f'<a href="{link(directory/name)}" target="_blank">{esc(title)}</a>' for name, title in [("index.html", "打开可环绕3D样机"), ("camp-exterior.obj", "营地 OBJ"), ("main-tent-ritual.obj", "仪式主帐 OBJ"), ("main-tent-council.obj", "议事主帐 OBJ"), ("camp-layout.json", "人物/场景坐标")])
    return f'<p class="note">先统一平面、人物位置和相机，再校准场景底图。模型的尺度与镜位用于连续性，用户审批状态仍为待review。</p><p class="resource-links">{links}</p><div class="asset-grid comparison">{cards}</div>'


def sync_runtime_map(manifest):
    target = VISUALS / "runtime-map.json"
    archive = VISUALS / "archive/20261022/runtime-map-before.json"
    if not archive.exists():
        archive.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, archive)
    exported = {**manifest, "_generated": {"source": "GameStarter/web-demo/visual-assets.json", "sourceSha256": hashlib.sha256(MANIFEST.read_bytes()).hexdigest(), "generatedBy": "python tools/art/build_review.py", "instruction": "Generated mirror; edit the authoritative source and regenerate. Review approval is never inferred."}}
    target.write_text(json.dumps(exported, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--include-ui", action="store_true")
    parser.add_argument("--include-gameplay", action="store_true")
    args = parser.parse_args()
    DEST.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    sync_runtime_map(manifest)
    characters, character_data = build_characters(manifest)
    scenes, scene_data = build_scenes(manifest)
    ui, ui_data = build_ui(args.include_ui, args.include_gameplay)
    timestamp = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat(timespec="seconds")
    data = {"schemaVersion": 1, "generatedAt": timestamp, "sourceManifest": path_text(MANIFEST), "sourceVersion": manifest["version"], "sourceSha256": hashlib.sha256(MANIFEST.read_bytes()).hexdigest(), "reviewStatus": "待review", "approvalGenerated": False, "characters": character_data, "scenes": scene_data, "uiScreenshots": ui_data, "uiSamplesStatus": "本轮样品未采用，待整体UI审核", "screenshotFreshnessGates": vars(args)}
    (DEST / "review-manifest.json").write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    template = (ROOT / "tools/art/review-template.html").read_text(encoding="utf-8")
    replacements = {"TIMESTAMP": esc(timestamp), "VERSION": esc(manifest["version"]), "UI": ui, "CHARACTERS": characters, "SCENES": scenes, "SPATIAL": build_spatial()}
    for key, value in replacements.items():
        template = template.replace("{{" + key + "}}", value)
    (DEST / "index.html").write_text(template, encoding="utf-8")
    print(json.dumps({"page": path_text(DEST / "index.html"), "characters": len(character_data), "scenes": len(scene_data), "uiScreenshots": len(ui_data), "sourceVersion": manifest["version"], "reviewStatus": "待review"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
