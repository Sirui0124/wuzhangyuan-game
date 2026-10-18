"""Build a quiet UI candidate pack from the preserved Kenney CC0 originals."""
from pathlib import Path
import array
import hashlib
import json
import math
import subprocess
import wave

ROOT = Path(__file__).resolve().parent
SOURCES = {
    "interface": ("kenney_interface-sounds", "https://kenney.nl/assets/interface-sounds"),
    "rpg": ("kenney_rpg-audio", "https://kenney.nl/assets/rpg-audio"),
}
# id, pack, source file, low-pass Hz, maximum seconds, peak dBFS, description
ITEMS = [
    ("ui_click_a", "interface", "click_001", 3000, .16, -14, "普通按钮：短促、柔化的点击候选A"),
    ("ui_click_b", "interface", "click_001", 2400, .16, -15, "普通按钮：更暗、更轻的点击候选B"),
    ("dialogue_next", "interface", "tick_001", 2200, .08, -20, "逐句推进：很轻的短点"),
    ("panel_open", "rpg", "bookOpen", 4000, .25, -16, "打开证据或记录：开册短音"),
    ("panel_close", "rpg", "bookClose", 3200, .30, -17, "关闭面板：轻合册"),
    ("paper_turn", "rpg", "bookFlip2", 4600, .50, -17, "证据详情、页签：短翻纸"),
    ("evidence_select", "interface", "select_001", 2600, .10, -17, "选择一项证据：轻扣候选"),
    ("evidence_present", "rpg", "bookPlace1", 3400, .35, -14, "实际出示证据：册页落案候选"),
    ("evidence_gain", "interface", "pluck_002", 3000, .70, -13, "首次获得证据：古琴感三音阶轻拨弦（D4–F4–A4）"),
    ("submit", "rpg", "bookPlace2", 2800, .42, -15, "实际提交文字：低沉落案候选"),
    ("ui_warning", "rpg", "bookPlace3", 1600, .32, -19, "空白提交、操作不足或服务错误：暗短扣"),
    ("response_ready", "interface", "pluck_001", 2600, .20, -19, "回应到达：中性短提示候选"),
]

def evidence_phrase(pick):
    """A restrained ascending phrase: damped string harmonics, no bell flourish.

    Kenney's original contributes only the quiet pick texture; the pitched body
    is synthesized here. Each note loses its upper harmonics before its body.
    """
    rate = 48000
    values = array.array("f", [0.0]) * int(.70 * rate)
    pick_peak = max(abs(v) for v in pick)
    for onset, frequency, strength in [(0, 293.6648, .86), (.14, 349.2282, .94), (.29, 440.0, 1.0)]:
        offset = round(onset * rate)
        for i in range(min(round(.41 * rate), len(values) - offset)):
            t = i / rate
            attack = min(1, t / .003)
            body = sum(
                math.sin(2 * math.pi * frequency * h * t)
                * math.exp(-t * (10 + 3.5 * (h - 1))) / h ** 1.35
                for h in range(1, 9)
            )
            # A faint, filtered pluck transient gives the notes a tactile edge.
            texture = .045 * pick[i] / pick_peak * math.exp(-t * 30) if i < len(pick) else 0
            tail = min(1, (.41 - t) / .03)
            values[offset + i] += strength * attack * tail * (body + texture)
    return values

def make_item(row):
    ident, pack, basename, cutoff, limit, target, description = row
    pack_dir, url = SOURCES[pack]
    source = ROOT / "originals" / pack_dir / "Audio" / (basename + ".ogg")
    raw = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(source), "-af",
        f"highpass=f=90,lowpass=f={cutoff}", "-ac", "1", "-ar", "48000",
        "-f", "f32le", "pipe:1",
    ])
    samples = array.array("f", raw)
    peak = max(abs(v) for v in samples)
    threshold = max(10 ** (-65 / 20), peak * 10 ** (-45 / 20))
    active = [i for i, v in enumerate(samples) if abs(v) > threshold]
    start = max(0, active[0] - 240)
    end = min(len(samples), active[-1] + 481, start + int(limit * 48000))
    values = samples[start:end]
    if ident == "evidence_gain":
        values = evidence_phrase(values)
    fade_in = min(96, max(1, len(values) // 8))
    fade_out = min(384, max(1, len(values) // 6))
    for i in range(fade_in):
        values[i] *= i / fade_in
    for i in range(fade_out):
        values[-1-i] *= i / fade_out
    gain = 10 ** (target / 20) / max(abs(v) for v in values)
    pcm = array.array("h", [round(max(-1, min(1, v * gain)) * 32767) for v in values])
    wav_path = ROOT / "sfx" / (ident + ".wav")
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(wav_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(48000)
        w.writeframes(pcm.tobytes())
    measured_peak = max(abs(v) for v in pcm) / 32768
    rms = math.sqrt(sum((v / 32768) ** 2 for v in pcm) / len(pcm))
    item = {
        "id": ident, "file": str(wav_path.relative_to(ROOT)),
        "wav": str(wav_path.relative_to(ROOT)), "description": description,
        "durationMs": round(len(pcm) / 48, 1), "sampleRate": 48000,
        "channels": 1, "wavPeakDbfs": round(20 * math.log10(measured_peak), 2),
        "wavRmsDbfs": round(20 * math.log10(rms), 2),
        "source": str(source.relative_to(ROOT)), "sourceUrl": url,
        "license": "CC0-1.0", "author": "Kenney",
        "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "sha256": hashlib.sha256(wav_path.read_bytes()).hexdigest(),
        "processing": {"highpassHz": 90, "lowpassHz": cutoff, "trimSilence": True,
                       "fadeInMs": round(fade_in / 48, 2), "fadeOutMs": round(fade_out / 48, 2),
                       "targetPeakDbfs": target, "mono": True},
        "review": "已做解码、时长和电平检查；听感由试听页确认，尚未游戏内混音验收",
    }
    if ident == "evidence_gain":
        item["author"] = "项目合成拨弦音体；Kenney 拨弦触感层"
        item["processing"].update({
            "phraseNotes": ["D4", "F4", "A4"], "noteOnsetsMs": [0, 140, 290],
            "synthesis": "damped plucked-string harmonics with quiet CC0 pick texture",
            "synthesisScript": "prepare-sfx.py", "tailFadeMs": 30,
        })
    return item

assets = [make_item(row) for row in ITEMS]
manifest = {
    "version": 1, "date": "2026-10-11", "status": "design-and-preview-only",
    "assets": assets,
    "mix": {"sfxMasterGain": .65, "maxConcurrentVoices": 3,
            "sameEventCooldownMs": 90, "uiBusMono": True,
            "typingSounds": False, "hoverSounds": False,
            "suppressGenericClickWhenSemanticSoundPlays": True},
    "events": {
        "generic_button": {"sounds": ["ui_click_a", "ui_click_b"], "variant": "alternate", "priority": 1},
        "confirmed_dialogue_advance": {"sound": "dialogue_next", "priority": 1, "guard": "实际推进一句对白；鼠标、空格、Enter统一"},
        "panel_open": {"sound": "panel_open", "priority": 2, "actions": ["evidence", "browse-evidence", "records", "help", "save", "settings", "retry-ending", "ending-collection"]},
        "panel_close": {"sound": "panel_close", "priority": 2, "guard": "面板实际关闭；含Esc和遮罩"},
        "evidence_detail_change": {"sound": "paper_turn", "priority": 2, "actions": ["tab", "inspect-evidence"], "guard": "实际变化时播放"},
        "evidence_selection_change": {"sound": "evidence_select", "priority": 2, "actions": ["toggle-evidence"]},
        "evidence_presented": {"sound": "evidence_present", "priority": 3, "actions": ["present"], "guard": "选择恰好一项并实际出示；不表示证据正确"},
        "evidence_newly_acquired": {"sound": "evidence_gain", "priority": 4, "guard": "新增证据且出现获得提示；同批只响一次，重读、载入不播放"},
        "free_input_submitted": {"sound": "submit", "priority": 3, "actions": ["submit"], "guard": "非空，提交被接受且进入pending；不表示判定成功"},
        "recoverable_warning": {"sound": "ui_warning", "priority": 4, "guard": "空白提交、没有选够证据或技术错误；不用于NPC驳回，不是死亡提示"},
        "current_response_ready": {"sound": "response_ready", "priority": 3, "guard": "当前有效请求得到结果并显示对白；取消后的迟到结果不播放"},
        "location_changed": {"sound": "paper_turn", "gain": .7, "priority": 2, "actions": ["scene"], "guard": "实际换地点一次；不用每次点击都播脚步"},
    },
    "bgm": {
        "assetsPending": True,
        "tracks": [
            {"id": "round_1", "title": "第六夜·初到军营", "prompt": "prompts/01_第一轮_第六夜初到军营.txt"},
            {"id": "round_2", "title": "重返灯前", "prompt": "prompts/02_第二轮_重返灯前.txt"},
            {"id": "weiyan", "title": "帐前一言", "prompt": "prompts/03_魏延交涉_帐前一言.txt"},
        ],
        "selectionPriority": ["有声视频：BGM静音", "结局：BGM淡出", "当前交谈对象weiyan：第三首", "已完成教学：第二首", "其余调查：第一首"],
        "roundFlag": "progress.tutorial_completed", "actorId": "weiyan",
        "crossfadeMs": 1800, "sameTrackNoRestart": True,
        "duringFreeInputGainDb": -3, "duringAwaitingResponseGainDb": -3,
        "endingFadeOutMs": 2500, "hiddenPageFadeOutMs": 250,
        "notes": "为未来接入提供设计映射，不是已启用的运行配置；BGM文件尚未生成。",
    },
}
(ROOT / "audio-design-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"assets": len(assets), "durationsMs": {a['id']: a['durationMs'] for a in assets}}, ensure_ascii=False))
