"""Build a review handoff from published versions; never grants approval."""
from pathlib import Path
import json, datetime

ROOT = Path(__file__).resolve().parents[1]
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
audit = read(ROOT/'audit/batch2/current.json')
snapshot = read(ROOT/'reviews/user-20261025-batch2/comments-and-versions.json')
saved = read(ROOT/'reviews/saved/review-state.json')['records']
dispatch = read(ROOT/'dispatch.json')['groups']
rows = {x['id']: x for x in audit['clips']}
observed = {x['id']: x for x in snapshot['rows']}
comment_diffs = [x['id'] for x in snapshot['rows'] if x['note'] and saved.get(x['id'],{}).get('note') != x['note']]
unseen = [x['id'] for x in snapshot['rows'] if not x['note'] and not x['approved']]
unmatched = [x['id'] for x in audit['clips'] if not x['ownerReportMatchesCurrentSha']]
now = datetime.datetime.now().astimezone().isoformat(timespec='seconds')
lines = ['# 第二章第二批返修与复审', '', f'更新：{now}', '',
 '[打开视频审片台](http://127.0.0.1:8894/)。点击“刷新视频”，选择“新版待复审”查看改过的已审片段；选择“尚未审过”查看尚未审的片段。', '',
 f'本轮范围63段，原始评论24条、旧版本通过观察15条，38段已审、25段未审。评论逐字符回读差异：{comment_diffs or "无"}。新版不继承旧版本通过。', '',
 f'与当前实际视频SHA对应的本轮记录：{sum(x["ownerReportMatchesCurrentSha"] for x in audit["clips"])}/63。此数表示记录与文件一致，不能代替实际听审或用户通过。', '',
 '## 尚未闭环', '',
 'V25 的“我去魏国，求他们放我回来，散布丞相要篡位的谣言，逼朝廷召军。”补音请求连接中断，结果未知。原请求记录已锁定，未重复提交；旧视频保留，缺句新版本没有发布。已完成的其他句单独保存。', '',
 f'当前还未与本轮新候选记录匹配的槽位：{", ".join(unmatched) or "无"}。', '',
 '所有新音频仍待实际听审：文本定位、完整解码及源文件核对不证明音色、发音、BGM或精细口型已通过。准确文书内容另存来源映射，未在本轮实现游戏信息层。', '',
 '## 分组交付', '',
 '| 场景 | 段数 | 当前SHA记录一致 |', '|---|---:|---:|']
for g in dispatch:
    lines.append(f'| {g["title"]} | {len(g["clips"])} | {sum(rows[i]["ownerReportMatchesCurrentSha"] for i in g["clips"])} |')
lines += ['', '## 本轮开始时尚未审过的片段', '', '、'.join(unseen), '',
 '这些片段也纳入相同的画面、误读和时长自查；“尚未审过”指用户未审，不表示制作方未处理。', '',
 '## 当前文件与时长', '', '| 片段 | 当前成片 | 对照时长 → 新时长（秒） | 本轮文件记录 |', '|---|---|---|---|']
for x in audit['clips']:
    old, new = x.get('oldDuration'), x.get('newDuration')
    dur = f'{old:.2f} → {new:.2f}' if isinstance(old,(int,float)) and isinstance(new,(int,float)) else '见拥有者记录'
    link = f'[{x["name"]}](<{Path(x["file"]).as_posix()}>)' if x.get('file') else x['name']
    state = '当前文件对应' if x['ownerReportMatchesCurrentSha'] else '待完成／旧版保留'
    lines.append(f'| {x["id"]} | {link} | {dur} | {state} |')
lines += ['', '对照时长来自各组报告（所评版本或进入本批时的制作版本），逐段来源、删改区间、原句、动作与分支条件见各组 user-review-batch2.json；不把旧版通过转移给新版。', '']
out = ROOT/'reviews/user-20261025-batch2/第二批返修与复审说明.md'
out.write_text('\n'.join(lines), encoding='utf-8')
print(json.dumps({'report':str(out),'commentDifferences':comment_diffs,'unseen':len(unseen),'currentVersionRecords':63-len(unmatched),'unmatched':unmatched},ensure_ascii=False))
