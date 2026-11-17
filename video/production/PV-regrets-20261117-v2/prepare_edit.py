from pathlib import Path
import json
R=Path(__file__).resolve().parent
def shot(sid,dur,start=0,reason='',**kw):return dict(id=sid,edit_duration=dur,source_in=start,selection_reason=reason,**kw)
shots=[
shot('H01',1.5,reason='只取落手前的悬手；选定开场呼吸单独裁出后重做机器筛查。',audio_source_path=str(R/'H01/opening-audio.wav'),audio_in=0),
shot('A04',5,reason='原请求雨压火失败，改作雨灭之前仍在燃烧的火场建立镜头，不宣称此条已完成雨灭。'),
shot('A01',8,reason='前景焦木横移揭开谷地纵深，随后接余炭明确雨灭结果。'),
shot('A02',3.25,.75,'取实际火焰逐步收小到暗炭的过程，保留末段。'),
shot('A03R',2.25,.5,'本轮A03和修正A03R均出现加火与口型，全部排除。选用已有正确H3 R06的0.5—2.75秒；不沿用其旧审核状态。',source_path=str(R.parent/'PV-H3-20261115-v2.5/R06/source.mp4'),pre_crop='crop=1280:720:64:24,',exclude_native_audio=True),
shot('B01',7,reason='完整人物、长刀与远阵；保留真实摄影运动和风中衣料。'),
shot('B03',5,reason='选完整握柄到手指松开，下一镜承接落地。'),
shot('B02',2.75,reason='原片前段实际落刀可与松手相接，截在后续抬刀前；后段排除。不倒放、不伪造落刀。'),
shot('C01',1.5,reason='E07原构图，保留左侧刀斧手和马谡右上眼线，截去后段较明显嘴部活动。'),
shot('C02',8,reason='完整低扇到遮眼的连续动作。全片原速，保持监斩反打左下眼线；相机实际有推进，与固定机位原稿的差异记入抽查。'),
shot('C03',1.5,reason='独立新表演的前段反应，截去2秒后的疑似发声口型；不复用C01画面。'),
shot('D01',7.75,.25,'原全景有落手，改为整幅上半身取景，手不在画幅内。属于正常重新取景，不做局部遮盖，不伪称全景动作符合原稿。',pre_crop='crop=768:432:350:30,'),
shot('D03R',5,reason='改用实际H01悬手首帧与明确向上收手动作；须等实际回片后确认可用。'),
shot('D02',7,reason='保留灯焰收小、熄灭与余烟，以实际灯灭时刻决定最终选片。'),
]
value=dict(version='v2-work-edit',shots=shots,transitions=[dict(id=sid,kind=kind,duration=.25) for sid,kind in [('A04','light_match'),('B01','focus_bridge'),('D01','dark_occlusion'),('TITLE','lamp_to_black')]],user_review='待review',note='原速，不重复、不定格；整体取景裁切记录在各镜，音轨风险另记录。实际动作可用性仍需结合回片与抽查。')
(R/'edit-selection.json').write_text(json.dumps(value,ensure_ascii=False,indent=2),'utf-8')
print('Candidate duration:',sum(s['edit_duration'] for s in shots)+5-1)
