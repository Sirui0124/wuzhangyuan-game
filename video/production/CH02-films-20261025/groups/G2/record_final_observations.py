from pathlib import Path
import json
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
obs=read(OUT/'review/observations.json');dec=read(OUT/'review/decisions.json')
obs.update({
'V20-01':'0–9.4秒核看旧账后地方经手人说明调度决定，未切李严或催征执行画面；纸与木牍取放接触可用，原生伪字不作额外证据。',
'V20-02':'0–9.4秒仓中经手人从案面取报告、翻看、放回并退手；与前镜纸页版式略异，未新增签认动作。',
'V20-03':'0–10秒报告落案并保留观察，手压下缘后退离；右侧近身衣袖遮挡部分案面，正文在本取得时点准确叠字，未提前展示签认结论。',
'V20-05':'0–7.29秒递看旧报告后仓中经手人回应；0–3.6秒纸面烧入口头回答，覆盖为此前已取得的缺额报告正文，保留完整回应时长。',
'V20-06':'0–10秒两份旧记录与木牍相邻，纸页取放与手部接触可用；后段再次翻开旧纸，未拍新签字，准确同日关系在本取得时点显示。'
})
dec['V20-05']=dict(version='-R2',knownReportPanel=True,review='0–3.6秒纸面出现口头回答，用已取得缺额报告原文覆盖；3.6秒后人物近景回应保留，完整7秒原句时长不缩短。',audioIssue='原轨与嘴动待统一配音核验，不因纯音频重拍')
save(OUT/'review/observations.json',obs);save(OUT/'review/decisions.json',dec)
print(len(obs),'observed')
