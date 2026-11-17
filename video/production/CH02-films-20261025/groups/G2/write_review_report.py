from pathlib import Path
import json
OUT=Path(__file__).parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
plan=read(OUT/'plan.json');obs=read(OUT/'review/observations.json');dec=read(OUT/'review/decisions.json');play=read(OUT/'review/browser-playback.json')
lines=['# G2 画面自查记录','范围：冻结纯对白rev7/逻辑rev11，12个逻辑槽，35条原计划请求；源33节点。原片、请求、任务ID和历次本地剪辑均保留。','方法分别记录：逐片每0.5秒的连续序列视觉检查；浏览器静音自然速度播放到结尾的可见ended日志；部分片段实时截图观察；成片无seek第一解码帧核验。抽帧、技术播放、主观听审和用户审核是不同事项。',f'当前有具体序列观察记录：{len(obs)}/35；自然速度播放完成：{len(play["completedIds"])}/35。','音频：本轮未完成主观逐字听审、音色听审或BGM听审。ASR只标额外人声/错词疑点，不能作为听审结论；按用户后续要求，纯音频问题不触发新付费视频，也不新增TTS。已成功生成的中央固定玩家音轨保留，少量可低成本复用。','所有R2–R5为本地剪辑版本，不代表额外付费生成。V14的R3/R4首帧问题已停用，R5按实际首解码帧核实，根任务另行独立复核确认为双手扶卷。','| 子片 | 画面观察 | 采用处理 |','| --- | --- | --- |']
for c in plan['clips']:
    d=dec.get(c['id'],{});changes=[]
    if 'trimStart' in d or 'trimEnd' in d:changes.append(f'取{d.get("trimStart",0)}–{d.get("trimEnd",c["duration"])}秒')
    if d.get('sourceClip'):changes.append('反应来源'+d['sourceClip'])
    if d.get('tailHold'):changes.append(f'闭口末帧延长{d["tailHold"]}秒；非嘴动循环')
    if d.get('evidencePanel'):changes.append('既有证据准确概览覆盖伪字')
    if d.get('knownReportPanel'):changes.append('已取得缺额报告正文覆盖烧入口头回答')
    if d.get('knownTextPanel'):changes.append('已取得正文覆盖烧入口头回答；来源'+d['knownTextPanel']['sourceNode'])
    if c['kind']=='document':changes.append('对应时点准确原文叠字；不朗读')
    if c['kind']=='map':changes.append('准确五阶段关系；不显示缺额答案')
    lines.append(f'| {c["id"]} | {obs.get(c["id"],"尚待画面序列检查，不宣称通过")} | {"；".join(changes) or "保留画面候选"} |')
lines += ['剩余限制：原生文书常有重复伪字，不能拿来作为独立数值证据；准确正文仅以本源时点叠字呈现。部分服饰、木牍/纸页形制、机位存在轻微差异。苟安提问段采用同场反应补时，须在用户review时确认自然度。NPC嘴动与最终配音尚未逐字匹配，不自动声称口型通过。','本轮结果为制作自查候选，待用户review；未改游戏、在线策划表或正式发布白名单。']
(OUT/'review/画面自查记录.md').write_text('\n\n'.join(lines),encoding='utf-8')
print('Review record',len(obs),'observed /',len(play['completedIds']),'played')
