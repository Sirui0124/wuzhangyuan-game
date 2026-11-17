from pathlib import Path
import json, re, hashlib, unicodedata

O=Path(__file__).resolve().parent
R=O.parents[2]
P=json.loads((O/'audit/generation-plan.json').read_text(encoding='utf-8'))
I={x['index']:x for x in json.loads((O/'audit/inventory.json').read_text(encoding='utf-8'))}
S={x['id']:x for x in json.loads((R/'content/chapters/wuzhang/chapter-one.script.json').read_text(encoding='utf-8'))['rows']}
target=R/'video/raw/1028_视频更新'
target.mkdir(parents=True,exist_ok=True)
voice_source=R/'video/production/CH01-full-video-tight-20261023/02-全部21条生成Prompt正文.md'
voices=list(dict.fromkeys(x for x in voice_source.read_text(encoding='utf-8').splitlines() if re.match(r'^- [^：]+：V-',x)))

def norm(t):
 return ''.join(c for c in t if not c.isspace() and not unicodedata.category(c).startswith('P'))

def cues(t):
 return [x.strip() for x in t.splitlines() if x.strip() and x.strip()!='WEBVTT' and not x.strip().isdigit() and '-->' not in x]

report='# 第一章重拍台词、字幕与音色核对\n\n更新：2026-10-29。12条请求，按当前游戏绑定的14份VTT核对。对白文字没有优化改写；只保留策划原句标点并合并字幕断行。该核对验证文字对应，不代表新片已生成或已完成听审。\n\n'
report+='音色描述逐字取自[历史21条Prompt稿](<'+voice_source.as_posix()+'>)，仅为文字控制，不使用音频参考。声音编号不是锁声参数；新片仍须听验是否跨片一致。\n\n'+'\n'.join(voices)+'\n\n'
report+='R03 的 A-49 是原字幕已有的旁白，保留原句。R11 全片无人声；R12 仅姜维 E03 发声，E04/E04C 的报明、问清等演出说明不得念出。R07 仅保留原演出指定的一声非语言低咳。魏延转述敌军话语仍由魏延本人发声，不增加敌军声音。\n\n'
copy='# 第一章重拍：逐条复制的生成指令\n\n更新：2026-10-29。每个代码块均可单独复制。每条先准备并按顺序上传图片，等待用户确认后才提交生成。全部使用文字音色描述，不上传音频。当前状态为本地材料就绪；尚未上传至生成页面，未提交生成。文件名中的时间须在实际生成或下载保存时填写，不能把占位文字当真实时间。\n\n'
checks=[]; queue=[]
for p in P:
 ids=[rid for z in p['shots'] for rid in z['rows']]
 actual=''.join(S[rid]['text'] for rid in ids)
 paths=[R/'GameStarter/web-demo/public'/I[i]['subtitles'].lstrip('/') for i in p['indices']]
 subtitle=''.join(y for path in paths for y in cues(path.read_text(encoding='utf-8-sig')))
 assert norm(actual)==norm(subtitle),(p['code'],actual,subtitle)
 text=Path(p['file']).read_text(encoding='utf-8')
 emitted=re.findall(r'^唯一允许发声的原句：“(.*)”$',text,re.M)
 assert emitted==[S[rid]['text'] for rid in ids],p['code']
 used_voices=['我' if S[r]['speaker'].startswith('我') else S[r]['speaker'] for r in ids]
 for v in set(used_voices):
  desc=next(x for x in voices if x.startswith('- '+v+'：'))
  assert desc in text
 report+=f"## {p['code']} {p['name']}\n\n核对通过：所有可辨人声与原字幕逐字对应（忽略标点与分行）。\n\n"
 for path in paths:report+=f"字幕来源：[{path.name}](<{path.as_posix()}>)。\n\n"
 report+='| 原行 | 发声者 | 唯一允许发声的原句 |\n| --- | --- | --- |\n'
 for rid in ids:report+=f"| {rid} | {S[rid]['speaker']} | {S[rid]['text']} |\n"
 if not ids:report+='| 无 | 无 | 禁止新增对白、旁白和背景人声 |\n'
 report+='\n'
 intro=f'请你使用 seedance 2.5 生成视频，16:9，有声音，但没有 BGM，有自然音和音效，时长 {p["duration"]} 秒。文件保存到："{target}"。命名按照 {p["code"]}_{p["name"]}_更新时间（yyyymmddhhmmss）.mp4。请依次上传本文要求的参考图，按历史音色描述统一人物声线；只朗读指定原句，不朗读背景或拍摄说明，不上传音频参考。先准备好要生成的视频，等我确认后再进行生成。'
 copy+=f"## {p['code']} {p['name']}\n\n```text\n{intro}\n\n{p['file']}\n```\n\n[打开本条Prompt](<{Path(p['file']).as_posix()}>)\n\n"
 refs=[str(next((O/'references').glob(n+'.*'))) for n in p['refs']]
 queue.append(dict(code=p['code'],name=p['name'],promptFile=p['file'],imagePathsInUploadOrder=refs,model='seedance2.5',ratio='16:9',durationSeconds=p['duration'],sound=True,bgm=False,audioReferences=[],saveDirectory=str(target),filenameTemplate=f"{p['code']}_{p['name']}_{{yyyymmddhhmmss}}.mp4",status='prepared_locally_awaiting_user_confirmation',uploaded=False,submitted=False))
 checks.append(dict(code=p['code'],rowIds=ids,subtitleFiles=[str(x) for x in paths],textMatchesIgnoringPunctuationAndLineBreaks=True,voiceDescriptionsMatchHistoricalFile=True,promptSha256=hashlib.sha256(text.encode()).hexdigest()))
(O/'03-台词字幕与音色核对.md').write_text(report,encoding='utf-8')
(O/'04-逐条复制的生成指令.md').write_text(copy,encoding='utf-8')
(O/'audit/dialogue-verification-20261029.json').write_text(json.dumps(dict(date='2026-10-29',sourceVoiceFile=str(voice_source),checks=checks,dialogueRewritten=False,uploaded=False,submitted=False),ensure_ascii=False,indent=2),encoding='utf-8')
(O/'audit/prepared-requests-20261029.json').write_text(json.dumps(queue,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(prompts=len(P),spokenRows=sum(len(c['rowIds']) for c in checks),subtitleFiles=sum(len(c['subtitleFiles']) for c in checks),errors=[],uploaded=False,submitted=False),ensure_ascii=False))
