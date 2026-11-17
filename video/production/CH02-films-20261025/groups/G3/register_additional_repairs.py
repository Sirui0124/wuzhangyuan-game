from pathlib import Path
import json,datetime
O=Path(__file__).resolve().parent;p=O/'review/picture-usability.json';d=json.loads(p.read_text(encoding='utf-8'))
items={
'V21':[dict(id='V21-player-role-and-letter',subclips=['V21-01','V21-04','V21-07','V21-09','V21-11'],state='open',timeScope='玩家问句/心声及前景文书',problem='重看序列确认部分玩家句配苟安持续开口，且前景有模型乱字/非必要递纸。原有裁肩和裁字幕未关闭这些问题。',plannedRepair='用本组同昼夜足长闭口片段及自然前向观察镜重剪；不循环凑长，不生成假证据。')],
'V22':[dict(id='V22-player-role-and-wrong-prop',subclips=['V22-01','V22-04'],state='open',timeScope='玩家问句',problem='玩家问句段苟安开口，且问令牌却出现模型乱字信纸，需移除不适用前景物件。',plannedRepair='保留足长闭口/同场景观察镜，去不适用纸张，不把令牌当出营许可。')],
'V23':[dict(id='V23-return-silent-boundary',subclips=['V23-03'],state='open',timeScope='夜间回帐末段',problem='该段仅承担返回见苟安，无新增对白；后半明显说话表演不应承载模型自行新增语句。',plannedRepair='保留前段足够交代回到夜帐的闭口反应，不留无源长说话表演。')]
}
for r in d['clips']:
 if r['id'] in items:r['pictureUsability']='needs-repair';r['reviewState']='repair-registered';r['issues']+=items[r['id']]
d['updatedUTC']=datetime.datetime.now(datetime.timezone.utc).isoformat();p.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8');print('Registered additional V21–V23 picture repairs.')
