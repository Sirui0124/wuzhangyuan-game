from pathlib import Path
import json,datetime

OUT=Path(__file__).resolve().parent
path=OUT/'frame-review-notes.json'
doc=json.loads(path.read_text('utf-8'))
notes={
 'G02':['已查看2fps联系表及五点抽样；灰白马、山路向前移动、远山火光逐渐显出，第一视角持续。','新增了偶尔入镜的控缰手；尚未逐帧检查全14秒或完成实速视觉审阅。'],
 'G03':['当前采用经用户授权重提的v2，原520提交记录保留。','模型将原拟正面中景推进为掌心铜印特写，人物面部较早出画；这一机位变化与导演稿存在差异。','本片无声，口型不视为已与原台词同步。'],
 'G07':['已查看2fps联系表；两人身份与主要衣甲持续，末段转马背向镜头，非静态摆拍。','镜头自动靠近；原稿前路横列敌军的阻挡关系不够清楚，需结合后路镜头审阅。'],
 'G08':['已查看2fps联系表；木门后方敌军沿营路冲来，前景持矛者转向来敌。','前景人物脸型接近参考中的张南，与上一镜骑马状态和反打地理仍需连续性审阅。'],
 'G10':['已查看2fps联系表；傅肜有呼吸、持刀及拒降口型的动作，后段有抬头与兵器动作。','人物持刀高度、说话开始时刻与原稿预设不同；无声片不代表逐字口型已对齐。'],
 'G12':['已查看2fps联系表；旗布有风动、火场持续，旗沿焦裂可辨。','汉字随旗布折叠较大，整段字形稳定性仍待实速审阅，不以静态原图通过代替视频通过。'],
 'G13':['已查看2fps联系表；从谷底火区拉开露出左侧诸葛亮，峡谷空间仍可辨。','中段远处火光有短暂增强，后段回落；与原设定持续低火的差异需重点审核。'],
 'G14':['已查看2fps联系表；谷底木料、积水和局部火舌构成独立近景，末段火势降低。','不是所有火苗都熄灭，保留局部余火；未将其称为完全复原原图中所有细节。'],
 'G15':['已查看2fps联系表；侧面人物由低视线抬眼，雨景与冠袍基本连续。','后段嘴唇有张合，原设定为始终闭口无言；已记为待review差异。'],
 'G16':['已查看2fps联系表；关羽与完整长刀保持，人物和机位有真实运动。','采用范围末端仍握持长柄，是否足以接下一镜松手倒地需结合G17实际画面审核。'],
 'G18':['已查看2fps联系表；马谡被缚跪姿、前景刑刀和军营空间持续，未见行刑结果。','刀仅低位轻动，作为2秒工作剪辑候选，非完整动态通过结论。']
}
stamp=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
for uid,rows in notes.items():
    if not (OUT/uid/'contact.jpg').exists():continue
    doc['units'][uid]={'checked':True,'checked_at':stamp,'notes':rows}
    p=OUT/uid/'review.json'
    if p.exists():
        r=json.loads(p.read_text('utf-8'));r.update(motion_review='contact_frames_checked',method='查看2fps总览及采用范围五点抽样；未完整实速播放或听审。',notes=rows,user_review='待review')
        p.write_text(json.dumps(r,ensure_ascii=False,indent=2),'utf-8')
path.write_text(json.dumps(doc,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps({'reviewed_ids':list(doc['units']),'method':doc['method']},ensure_ascii=False))
