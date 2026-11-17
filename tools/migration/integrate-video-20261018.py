"""Reproducible local media preparation. Originals are never overwritten."""
from pathlib import Path
import subprocess, json, hashlib, shutil, os
ROOT = Path(__file__).resolve().parents[2]
FF = Path('C:/Users/zhousirui/AppData/Local/Temp/wuzhang-media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')
OUT = ROOT/'video/current'
HISTORY = ROOT/'video/review/history/20261018-before-integration'
HISTORY.mkdir(parents=True, exist_ok=True)
records=[]
def prepare(id, source, target, end=None, copy=False):
    src=ROOT/source; dst=OUT/target
    if not dst.exists():
        if copy: shutil.copy2(src,dst)
        else:
            cmd=[str(FF),'-v','error','-i',str(src)]
            if end: cmd += ['-t',str(end)]
            cmd += ['-map','0:v:0','-map','0:a:0','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',str(dst)]
            subprocess.run(cmd,check=True)
    result=subprocess.run([str(FF),'-hide_banner','-i',str(dst),'-vf','blackdetect=d=0.1:pix_th=0.10','-f','null','NUL'],capture_output=True,text=True,encoding='utf8')
    (ROOT/f'video/review/20261018-integration/{id}-decode.log').write_text(result.stderr,encoding='utf8')
    if result.returncode: raise RuntimeError(result.stderr)
    records.append(dict(id=id,source=source,target=f'video/current/{target}',sourceIn=0,sourceOut=end,speed=1,audio='original; AAC compatibility encode' if not copy else 'unchanged',sha256=hashlib.sha256(dst.read_bytes()).hexdigest(),bytes=dst.stat().st_size,decodePassed=True))
prepare('EN02B-A','video/raw/01 - EN02B-A 次日问责 - 20261018231428.mp4','EN02B-A-accountability-20261018.mp4')
prepare('EN03-EN04','video/in-progress/edits/EN03-EN04-ending-complete-review.mp4','EN03-EN04-ending-20261018.mp4',copy=True)
prepare('LI02A','video/review-ready/第二章-可用成稿/07A_LI02A_粮仓听说苟安受罚_保留成稿.mp4','LI02A-granary-20261018.mp4')
# PR01A is prepared for review only until PR01B is available; do not publish an incomplete opening.
prepare('PR01A','video/raw/PR01A-手机揭示-20261018231045.mp4','PR01A-phone-20261018.mp4')
(ROOT/'video/review/20261018-integration/edit-list.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(records,ensure_ascii=False))
