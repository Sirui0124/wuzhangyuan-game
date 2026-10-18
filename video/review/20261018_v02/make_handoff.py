# -*- coding: utf-8 -*-
from pathlib import Path
import json,csv,hashlib
B=Path(__file__).resolve().parents[3];O=Path(__file__).parent;V1=B/'video/review/20261018_v01';E=O/'evidence';M=json.loads((V1/'evidence/edit-manifest.json').read_text());LIB=json.loads((V1/'evidence/Library-delivery.json').read_text())['results'];byname={x['file_name']:x['library_file_id'] for x in LIB};F=json.loads((E/'PR01-clean-validation.json').read_text())
M[0].update({'file':'PR01-prologue-27s-clean-v02.mp4','absolutePath':str(O/'PR01-prologue-27s-clean-v02.mp4'),'visualTransform':F['crop'],'sha256':F['sha256'],'supersedesAsPreferred':'PR01-prologue-27s-review.mp4','audioPacketHash':F['audioPacketHash'],'audioExactlyMatchesV01':True})
for m in M[1:]:m['absolutePath']=str(V1/m['file']);m['library_file_id']=byname[m['file']]
(O/'实际6条剪辑清单.json').write_text(json.dumps(M,ensure_ascii=False,indent=2))
raw={k:json.loads((V1/'evidence'/(k+'-transcript.json')).read_text()) for k in ['PR01','LI01','LI02A','LI02B','SC01B','EN04','OLDEN03']}
(O/'离线识别全文.json').write_text(json.dumps({'notice':'未经人工校正的离线Whisper-tiny完整原始识别，含误识与幻觉；不等于已听准的游戏台词。time均为对应原视频秒数。','sources':raw},ensure_ascii=False,indent=2))
rows=['# PR01无字幕v02与实际6条成片交接','',f'推荐PR01改为`{O/"PR01-prologue-27s-clean-v02.mp4"}`，旧字幕版不再作为默认推荐。原片、current及第一轮review六条文件均已核对哈希保持不变。本轮不接入正式游戏，不删除或覆盖旧review。','', '## 无字幕修正与画面核对','', 'PR01全片每帧固定crop=1120:630:80:0，随后Lanczos缩放至1280×720，16:9，24fps。等效放大1.142857倍，去掉原底部90像素及左右各80像素。没有遮条、猜字重排、局部涂抹或生成内容。27秒/648帧不变，AAC压缩音轨逐包哈希与v01完全一致。','', '原片每半秒OCR与人工抽帧中，烧录对白字幕位于约y=636–688像素；裁切边界y=630保留安全余量。剪后同样每半秒核对，未发现对白字幕残留；显示器代码、NVDA/BTC/AI等场景内文字保留，不算对白字幕。3秒、6秒、9秒、24秒均确认字幕移除。手机13.5秒及24秒内容完整可辨，中央主灯黑芯保留。26秒后手机原本就在向画面下方收起，裁切使其更早接近边缘，保留了此前整段清楚展示，不另删动作或声音。','', '完成全片解码、无黑帧断口、1280×720 H.264/AAC验证；音画同为27.000000秒，主角最后愿望声段原封保留。浏览器检查另存evidence/browser-validation.json。','', '## 实际6条文件与时长','', '|ID|本地绝对路径|时长|','|---|---|---:|']
for m in M:rows.append(f"|{m['id']}|`{m['absolutePath']}`|{m['nominalDuration']:.6f}秒|")
rows+=['','## 逐段来源、入出点、速度与删减原因','','入出点均为对应原文件内秒数，左闭右开；输出区间已包含24fps末帧取整。机读版为`实际6条剪辑清单.json`，CSV为`实际6条时间线.csv`。']
for m in M:
 rows+=['',f"### {m['id']}",'','|输出区间|原文件|原入点–出点|速度|原因|','|---|---|---|---:|---|']
 for s in m['segments']:rows.append(f"|{s['outputIn']:.6f}–{s['outputOut']:.6f}|{s['source']}|{s['in']:.6f}–{s['outExclusive']:.6f}|{s['speed']}×|{s['reason']}|")
 rows+=['','删减：'+('无情节删减。' if not m['removed'] else '；'.join(f"{r['sourceId']} {r['in']:.6f}–{r['outExclusive']:.6f}：{r['reason']}" for r in m['removed']))]
rows+=['','## 末句与苟安相认覆盖摘要','','|核心声段|原片识别区间|实际成片区间|覆盖证据|','|---|---|---|---|','|PR01“要是……”|23.160000–24.120000|23.160000–24.120000|PR01 0–27完整保留，v02音轨逐包复制|','|PR01“能时光倒流就好了”|24.800000–26.480000|24.800000–26.480000|后留0.52秒，末句未截断|','|LI02B“原来……你就是苟安”（机器写成狗案）|8.640000–11.400000|合并片24.513333–26.966667|保留B 4.5–12秒@1.125×，之后还有反应|','|LI01“抓紧”|20.120000–20.920000|16.079333–16.719333|救援动作与声段都在连续区间|','|LI01救人两句|26.820000–29.800000|21.692424–24.401515|保留原片24.5–30.041667秒@1.1×|','|EN04主角画外回应（ASR未识出短哎声）|22.3附近起、机器22.86–24.1|末段完整保留16.000000–19.333333；机器句16.986667–18.088889|源21.75–25.5秒完整保留，含句前短声与句后余量|','|EN03+EN04主角最后回应|同EN04|末段28.625000–31.958333；机器句29.611667–30.713889|相同新EN04，不使用旧EN04台词|','','以上是时间区间/音轨存在性确认；机器中文字有错误，不能把它当人工逐字听准或声线鉴定。原声没有用TTS替换。','','## 其他5条：字幕、主角露脸及新旧台词冲突','','- LI01、LI02、SC01、EN04、EN03+EN04：原有半秒接触表已审看，本轮又逐秒本机Vision OCR扫描，共145帧，均没有检出文字/对白字幕。','- LI01/LI02主角以第一人称手脚或画外声出现；苟安、粮仓士卒的脸是叙事所需。SC01诸葛亮/魏延以及EN04姜维露脸是指定角色，未发现现代男主露脸、背影或倒影。PR01保留第一人称手部镜头。','- 已处理的明确重复：旧EN03开头0–3.375秒“七日期满，主灯未灭”与现有EN01重复，只在接EN01的组合版删除这句；北伐停滞、半月后病重、再次借寿均保留。','- LI02A只有打听苟安与伤帐去向，认出救命恩人的声段只在LI02B脸部已入画后。没有把相认提前接到粮仓段。','- 新EN04末句处姜维闭口听取，28秒后无声张嘴长尾已去掉，降低误把主角回应归给姜维的风险。没有混用旧EN04脸/对白。','- 仍保留听审限制：当前执行通道不能主观听原声；尤其LI02A数词/姓名、EN04三句逐字与声线、SC01B首个称呼需人工确认。下面回传完整未经校正识别，错误不隐去，也不据此改动台词。','','## 离线识别全文（原样，非人工订正）']
for key,d in raw.items():
 rows+=['',f'### {key}','',d['text'],'','|原片起点|原片终点|机器识别原文|','|---:|---:|---|']
 for s in d['segments']:
  rows.append(f"|{float(s['start']):.6f}|{float(s['end']):.6f}|{s['text'].replace('|','/')}|")
rows+=['','原始JSON含全部words、置信信息和空白/疑似幻觉分段，见`离线识别全文.json`。SC01B的surfaces等重复词是机器输出保留项，不作为真实对白。','', '## 保留与核验证据','',f'PR01 v02 SHA256：{F["sha256"]}',f'AAC压缩音轨：{F["audioPacketHash"]}','', 'v02证据：PR01-original/clean-ocr.json、PR01-clean-half-second-contact.jpg、PR01-clean-validation.json及其他5条OCR。v01原有edit-manifest.json、validation.json与全片音轨识别仍保留。']
(O/'收尾交接_实际剪辑与识别全文.md').write_text('\n'.join(rows)+'\n')
with (O/'实际6条时间线.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['成片','本地路径','原素材','原入点','原出点_不含','速度','输出入点','输出出点','处理原因'])
 for m in M:
  for s in m['segments']:w.writerow([m['id'],m['absolutePath'],s['source'],s['in'],s['outExclusive'],s['speed'],s['outputIn'],s['outputOut'],s['reason']])
(O/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>PR01无字幕v02</title><style>body{background:#171914;color:#eee;font:17px/1.6 system-ui;margin:30px auto;max-width:1100px}video{width:100%}a{color:#d7ba80}</style><h1>PR01 · 无字幕 v02 · 27秒</h1><p>固定轻微裁切，原声逐包复制，原片与v01保留。</p><video controls src="PR01-prologue-27s-clean-v02.mp4"></video><p><a href="收尾交接_实际剪辑与识别全文.md">6条实际剪辑与识别全文</a> · <a href="evidence/PR01-clean-half-second-contact.jpg">半秒接触表</a> · <a href="实际6条时间线.csv">时间线</a></p>')
print(O/'收尾交接_实际剪辑与识别全文.md')
